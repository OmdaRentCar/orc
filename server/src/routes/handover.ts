import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { isoDate } from '../lib/dates';
import { authMiddleware } from '../middleware/auth';
import { uploadHandoverPhotos, uploadPrivateImage, deleteAsset, signedImageUrl } from '../services/cloudinary';
import { getSettings } from '../services/settings';
import { returnCharges, chargesTotal, ExtraCharge } from '../services/handover';
import { driverProblem } from '../services/rules';
import { contractPdf, returnReportPdf } from '../services/pdf';
import { sendBookingEmail } from '../services/email';
import { emitBookingUpdate } from '../socket';
import { audit } from '../services/audit';

// Pick-up and return of the car: inspection, signature, contract and return report
const router = Router();
// Login is required per route: this router is mounted on /api/bookings next to public routes, so a router-wide check would block public requests

const optionalDate = z.preprocess((v) => (v === '' ? undefined : v), isoDate.optional());

const inspectionSchema = z.object({
  type: z.enum(['checkout', 'checkin']),
  mileage: z.coerce.number().int().min(0).max(2_000_000),
  fuelLevel: z.coerce.number().int().min(0).max(8),
  damages: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  }, z.array(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), note: z.string().trim().max(200).optional() })).max(40)).default([]),
  notes: z.string().trim().max(2000).optional(),
  signerName: z.string().trim().min(2).max(100),
  signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'signature is required').max(1_500_000),
  // Driver details, completed at pick-up for the contract
  idNumber: z.string().trim().max(40).optional(),
  licenseNumber: z.string().trim().max(40).optional(),
  birthDate: optionalDate,
  licenseIssueDate: optionalDate,
  licenseExpiry: optionalDate,
  customerAddress: z.string().trim().max(300).optional(),
  sendEmail: z.preprocess((v) => v !== 'false' && v !== false, z.boolean()).default(true),
});

const chargeSchema = z.object({
  label: z.string().trim().min(2).max(120),
  amount: z.number().positive().max(100_000),
  kind: z.enum(['damage', 'fine', 'other']).default('other'),
});

const fullBooking = (id: number) => prisma.booking.findUnique({ where: { id }, include: { car: true, inspections: true } });

function emailData(b: NonNullable<Awaited<ReturnType<typeof fullBooking>>>, total = b.total) {
  return {
    reference: b.reference, name: b.guestName, car: `${b.car.brand} ${b.car.model}`,
    start: b.startDate, end: b.endDate, pickupTime: b.pickupTime, returnTime: b.returnTime,
    total, deposit: b.deposit, locale: b.locale,
  };
}

function withSignedMedia<T extends { photos: string[]; signature: string | null }>(inspection: T) {
  return {
    ...inspection,
    photos: inspection.photos.map((p) => ({ url: p, view: signedImageUrl(p, 1200), thumb: signedImageUrl(p, 360) })),
    signature: inspection.signature ? signedImageUrl(inspection.signature, 600) : null,
  };
}

router.get('/:id/inspections', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const inspections = await prisma.inspection.findMany({ where: { bookingId: parseId(req.params.id) }, orderBy: { createdAt: 'asc' } });
  res.json(inspections.map(withSignedMedia));
});

router.post('/:id/inspections', authMiddleware, uploadHandoverPhotos, async (req: Request, res: Response): Promise<void> => {
  const uploaded = ((req.files as (Express.Multer.File & { path: string })[]) ?? []).map((f) => f.path);
  let signatureUrl: string | null = null;
  try {
    const id = parseId(req.params.id);
    const input = parseBody(inspectionSchema, req.body);
    const booking = await fullBooking(id);
    if (!booking) throw new HttpError(404, 'Booking not found');
    const settings = await getSettings();
    const checkout = booking.inspections.find((i) => i.type === 'checkout');

    if (input.type === 'checkout') {
      if (checkout) throw new HttpError(409, 'The pick-up inspection was already done');
      if (booking.status !== 'approved') throw new HttpError(400, 'Only an approved booking can be handed over');
      if (uploaded.length < 4) throw new HttpError(400, 'Take at least 4 photos (front, back and both sides)');
      const driver = {
        birthDate: input.birthDate ?? booking.birthDate,
        licenseIssueDate: input.licenseIssueDate ?? booking.licenseIssueDate,
        licenseExpiry: input.licenseExpiry ?? booking.licenseExpiry,
      };
      const problem = driverProblem(driver, booking.startDate, booking.endDate, settings);
      if (problem) throw new HttpError(400, problem);
    } else {
      if (booking.inspections.some((i) => i.type === 'checkin')) throw new HttpError(409, 'The return inspection was already done');
      if (booking.status !== 'picked_up') throw new HttpError(400, 'The car has not been picked up yet');
      if (!checkout) throw new HttpError(400, 'There is no pick-up inspection to compare with');
      if (input.mileage < checkout.mileage) throw new HttpError(400, `Mileage can't be lower than at pick-up (${checkout.mileage} km)`);
      if (uploaded.length < 4) throw new HttpError(400, 'Take at least 4 photos (front, back and both sides)');
    }

    signatureUrl = await uploadPrivateImage(input.signature, 'handover');
    const now = new Date();

    const newCharges: ExtraCharge[] = input.type === 'checkin'
      ? returnCharges(
        { startDate: booking.startDate, endDate: booking.endDate, returnTime: booking.returnTime, dailyRate: booking.car.price },
        checkout!, { mileage: input.mileage, fuelLevel: input.fuelLevel }, now, settings,
      )
      : [];
    const charges = [...((booking.extraCharges as unknown as ExtraCharge[]) ?? []), ...newCharges];

    await prisma.$transaction([
      prisma.inspection.create({
        data: {
          bookingId: id,
          type: input.type,
          mileage: input.mileage,
          fuelLevel: input.fuelLevel,
          damages: input.damages as Prisma.InputJsonValue,
          photos: uploaded,
          signature: signatureUrl,
          signerName: input.signerName,
          notes: input.notes || null,
          staffName: req.user!.username,
        },
      }),
      prisma.booking.update({
        where: { id },
        data: {
          status: input.type === 'checkout' ? 'picked_up' : 'completed',
          ...(input.type === 'checkout' ? {
            idNumber: input.idNumber || booking.idNumber,
            licenseNumber: input.licenseNumber || booking.licenseNumber,
            birthDate: input.birthDate ?? booking.birthDate,
            licenseIssueDate: input.licenseIssueDate ?? booking.licenseIssueDate,
            licenseExpiry: input.licenseExpiry ?? booking.licenseExpiry,
            customerAddress: input.customerAddress || booking.customerAddress,
          } : {
            extraCharges: charges as unknown as Prisma.InputJsonValue,
            extraChargesTotal: chargesTotal(charges),
          }),
        },
      }),
      prisma.car.update({
        where: { id: booking.carId },
        data: { mileage: Math.max(booking.car.mileage, input.mileage) },
      }),
    ]);

    const label = input.type === 'checkout' ? 'picked up' : 'returned';
    await audit(req, input.type, 'booking', id, `${booking.reference}: ${label} at ${input.mileage} km, fuel ${input.fuelLevel}/8, ${input.damages.length} damage mark(s)${newCharges.length ? `, charges ${chargesTotal(newCharges)} DT` : ''}`);
    await prisma.notification.create({ data: { type: `booking_${input.type === 'checkout' ? 'picked_up' : 'completed'}`, message: `${booking.reference}: car ${label} (${booking.car.brand} ${booking.car.model})`, bookingId: id } });
    emitBookingUpdate({ type: `booking_${input.type}`, message: `${booking.reference} ${label}`, bookingId: id });

    const updated = (await fullBooking(id))!;
    let emailed = false;
    if (input.sendEmail && updated.email) {
      if (input.type === 'checkout') {
        const pdf = await contractPdf(updated, settings);
        emailed = await sendBookingEmail('contract', updated.email, emailData(updated), [{ filename: `contrat-${updated.reference}.pdf`, content: pdf }]);
      } else {
        const pdf = await returnReportPdf(updated, settings);
        emailed = await sendBookingEmail('return_report', updated.email, emailData(updated, updated.total + updated.extraChargesTotal), [{ filename: `retour-${updated.reference}.pdf`, content: pdf }]);
      }
    }

    res.status(201).json({ booking: updated, charges: newCharges, emailed });
  } catch (err) {
    await Promise.all([...uploaded, signatureUrl].map(deleteAsset));
    throw err;
  }
});

async function sendPdf(res: Response, filename: string, pdf: Buffer) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(pdf);
}

router.get('/:id/contract.pdf', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const b = await fullBooking(parseId(req.params.id));
  if (!b) throw new HttpError(404, 'Booking not found');
  await sendPdf(res, `contrat-${b.reference}.pdf`, await contractPdf(b, await getSettings()));
});

router.get('/:id/return-report.pdf', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const b = await fullBooking(parseId(req.params.id));
  if (!b) throw new HttpError(404, 'Booking not found');
  if (!b.inspections.some((i) => i.type === 'checkin')) throw new HttpError(404, 'The car has not been returned yet');
  await sendPdf(res, `retour-${b.reference}.pdf`, await returnReportPdf(b, await getSettings()));
});

// Manual charges, e.g. a new scratch found at return
router.post('/:id/charges', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const input = parseBody(chargeSchema, req.body);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  const charges = [...((booking.extraCharges as unknown as ExtraCharge[]) ?? []), input as ExtraCharge];
  const updated = await prisma.booking.update({
    where: { id },
    data: { extraCharges: charges as unknown as Prisma.InputJsonValue, extraChargesTotal: chargesTotal(charges) },
    include: { car: { select: { brand: true, model: true, image: true } } },
  });
  await audit(req, 'add-charge', 'booking', id, `${booking.reference}: ${input.label} ${input.amount} DT`);
  emitBookingUpdate({ type: 'booking_updated', message: `Charge added to ${booking.reference}`, bookingId: id });
  res.status(201).json(updated);
});

router.delete('/:id/charges/:index', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const index = Number(req.params.index);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  const charges = [...((booking.extraCharges as unknown as ExtraCharge[]) ?? [])];
  if (!Number.isInteger(index) || index < 0 || index >= charges.length) throw new HttpError(404, 'Charge not found');
  const [removed] = charges.splice(index, 1);
  const updated = await prisma.booking.update({
    where: { id },
    data: { extraCharges: charges as unknown as Prisma.InputJsonValue, extraChargesTotal: chargesTotal(charges) },
    include: { car: { select: { brand: true, model: true, image: true } } },
  });
  // A charge that came from a fine sends the fine back to "open"
  if (removed.kind === 'fine') await prisma.fine.updateMany({ where: { bookingId: id, status: 'charged', amount: removed.amount }, data: { status: 'open', bookingId: null } });
  await audit(req, 'remove-charge', 'booking', id, `${booking.reference}: ${removed.label} ${removed.amount} DT`);
  emitBookingUpdate({ type: 'booking_updated', message: `Charge removed from ${booking.reference}`, bookingId: id });
  res.json(updated);
});

export default router;
