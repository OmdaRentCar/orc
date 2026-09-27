import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { addDaysISO, isoDate, localInstant, timeOfDay } from '../lib/dates';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { chargesTotal, ExtraCharge } from '../services/handover';
import { audit } from '../services/audit';

// Traffic fines arrive weeks later with only a plate, a date and a time: find who had the car
const router = Router();
router.use(authMiddleware);

const HELD_STATUSES = ['approved', 'picked_up', 'completed'];

const lookupSchema = z.object({
  carId: z.coerce.number().int().positive().optional(),
  plate: z.string().trim().max(30).optional(),
  date: isoDate,
  time: timeOfDay,
}).refine((q) => q.carId || q.plate, 'carId or plate is required');

const fineSchema = z.object({
  carId: z.number().int().positive(),
  bookingId: z.number().int().positive().nullable().optional(),
  date: isoDate,
  time: timeOfDay,
  amount: z.number().positive().max(100_000),
  description: z.string().trim().max(300).optional(),
  chargeCustomer: z.boolean().default(true),
});

const normalizePlate = (p: string) => p.replace(/[^0-9a-z؀-ۿ]/gi, '').toLowerCase();

async function findCar(carId?: number, plate?: string) {
  if (carId) return prisma.car.findUnique({ where: { id: carId } });
  const cars = await prisma.car.findMany({ where: { plateNumber: { not: null } } });
  return cars.find((c) => normalizePlate(c.plateNumber!) === normalizePlate(plate!)) ?? null;
}

router.get('/lookup', async (req: Request, res: Response): Promise<void> => {
  const q = parseBody(lookupSchema, req.query);
  const car = await findCar(q.carId, q.plate);
  if (!car) throw new HttpError(404, 'No car with this plate number');
  const at = localInstant(q.date, q.time);

  const candidates = await prisma.booking.findMany({
    where: { carId: car.id, status: { in: HELD_STATUSES }, startDate: { lte: addDaysISO(q.date, 1) }, endDate: { gte: addDaysISO(q.date, -1) } },
    include: { inspections: true },
  });

  // Actual hand-over times when the car went through pick-up/return, otherwise the booked times
  const matches = candidates.map((b) => {
    const out = b.inspections.find((i) => i.type === 'checkout');
    const back = b.inspections.find((i) => i.type === 'checkin');
    const from = out?.createdAt ?? localInstant(b.startDate, b.pickupTime);
    const to = back?.createdAt ?? (b.status === 'picked_up' ? new Date() : localInstant(b.endDate, b.returnTime));
    return { booking: b, from, to, exact: !!out };
  }).filter((m) => at >= m.from && at <= m.to);

  res.json({
    car: { id: car.id, brand: car.brand, model: car.model, plateNumber: car.plateNumber },
    at: at.toISOString(),
    matches: matches.map((m) => ({
      id: m.booking.id,
      reference: m.booking.reference,
      guestName: m.booking.guestName,
      phone: m.booking.phone,
      email: m.booking.email,
      idNumber: m.booking.idNumber,
      licenseNumber: m.booking.licenseNumber,
      status: m.booking.status,
      from: m.from.toISOString(),
      to: m.to.toISOString(),
      basedOn: m.exact ? 'handover' : 'booking',
    })),
  });
});

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const fines = await prisma.fine.findMany({
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
    include: { car: { select: { brand: true, model: true, plateNumber: true } }, booking: { select: { reference: true, guestName: true, phone: true } } },
  });
  res.json(fines);
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(fineSchema, req.body);
  const car = await prisma.car.findUnique({ where: { id: input.carId } });
  if (!car) throw new HttpError(404, 'Car not found');
  const booking = input.bookingId ? await prisma.booking.findUnique({ where: { id: input.bookingId } }) : null;
  if (input.bookingId && (!booking || booking.carId !== car.id)) throw new HttpError(400, 'This booking is not for this car');

  const charge = booking && input.chargeCustomer;
  const fine = await prisma.$transaction(async (tx) => {
    const created = await tx.fine.create({
      data: {
        carId: car.id,
        bookingId: booking?.id ?? null,
        date: input.date,
        time: input.time,
        amount: input.amount,
        description: input.description || null,
        status: charge ? 'charged' : 'open',
      },
    });
    if (charge) {
      const charges = [...((booking!.extraCharges as unknown as ExtraCharge[]) ?? []), {
        kind: 'fine' as const,
        label: `Amende du ${input.date.split('-').reverse().join('/')} ${input.time}${input.description ? ` (${input.description})` : ''}`,
        amount: input.amount,
      }];
      await tx.booking.update({
        where: { id: booking!.id },
        data: { extraCharges: charges as unknown as Prisma.InputJsonValue, extraChargesTotal: chargesTotal(charges) },
      });
    }
    return created;
  });

  await audit(req, 'create', 'fine', fine.id, `${car.brand} ${car.model} ${input.date} ${input.time}, ${input.amount} DT${booking ? ` -> ${booking.reference}` : ''}`);
  res.status(201).json(fine);
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const { status } = parseBody(z.object({ status: z.enum(['open', 'charged', 'paid']) }), req.body);
  const fine = await prisma.fine.update({ where: { id }, data: { status } });
  await audit(req, `fine:${status}`, 'fine', id);
  res.json(fine);
});

router.delete('/:id', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  await prisma.fine.delete({ where: { id } });
  await audit(req, 'delete', 'fine', id);
  res.json({ message: 'Fine deleted' });
});

export default router;
