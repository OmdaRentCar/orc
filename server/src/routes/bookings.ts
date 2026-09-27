import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { isoDate, timeOfDay, todayISO } from '../lib/dates';
import { normalizePhone } from '../lib/phone';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { uploadDocument, deleteAsset, signedDocumentUrl } from '../services/cloudinary';
import { emitBookingUpdate } from '../socket';
import { sendBookingEmail, EmailKind } from '../services/email';
import { computeQuote, Quote } from '../services/pricing';
import { getSettings } from '../services/settings';
import { generateReference } from '../services/reference';
import { verifyCaptcha } from '../services/captcha';
import { driverProblem, documentsExpiringDuring } from '../services/rules';
import { audit } from '../services/audit';

const router = Router();

// Statuses that hold the car for their dates
export const BLOCKING_STATUSES = ['approved', 'picked_up'];

const TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'declined', 'cancelled'],
  approved: ['picked_up', 'cancelled', 'pending'],
  picked_up: ['completed'],
  declined: ['pending'],
  cancelled: ['pending'],
  completed: [],
};

const STATUS_EMAIL: Partial<Record<string, EmailKind>> = { approved: 'approved', declined: 'declined', cancelled: 'cancelled' };

const inTests = process.env.NODE_ENV === 'test';
const limiter = (windowMinutes: number, max: number, error: string) =>
  rateLimit({ windowMs: windowMinutes * 60_000, max, skip: () => inTests, message: { error } });

const bookingLimiter = limiter(60, 10, 'Too many booking requests, please try again later');
const statusLimiter = limiter(15, 30, 'Too many lookups, please try again later');
const quoteLimiter = limiter(15, 300, 'Too many requests, please try again later');

type Db = Prisma.TransactionClient | typeof prisma;

async function hasConflict(db: Db, carId: number, startDate: string, endDate: string, excludeId?: number): Promise<boolean> {
  const conflict = await db.booking.findFirst({
    where: {
      carId,
      status: { in: BLOCKING_STATUSES },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !!conflict;
}

// Locks the car row so two admins approving overlapping bookings at the same moment
// run one after the other, and the second one sees the first one's approval
function withCarLock<T>(carId: number, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM cars WHERE id = ${carId} FOR UPDATE`;
    return fn(tx);
  });
}

// Retries on the (very unlikely) chance of a duplicate reference code
async function createWithReference<T>(create: (reference: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await create(generateReference());
    } catch (err) {
      const duplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!duplicate || attempt >= 4) throw err;
    }
  }
}

function quoteFields(quote: Quote) {
  return {
    extras: quote.extras as unknown as Prisma.InputJsonValue,
    subtotal: quote.subtotal,
    discount: quote.discount,
    extrasTotal: quote.extrasTotal,
    deliveryFee: quote.deliveryFee,
    total: quote.total,
    deposit: quote.deposit,
  };
}

function emailData(booking: { reference: string; guestName: string; startDate: string; endDate: string; pickupTime: string; returnTime: string; total: number; deposit: number; locale: string }, car: string) {
  return {
    reference: booking.reference,
    name: booking.guestName,
    car,
    start: booking.startDate,
    end: booking.endDate,
    pickupTime: booking.pickupTime,
    returnTime: booking.returnTime,
    total: booking.total,
    deposit: booking.deposit,
    locale: booking.locale,
  };
}

async function notify(type: string, message: string, bookingId: number): Promise<void> {
  await prisma.notification.create({ data: { message, type, bookingId } });
  emitBookingUpdate({ type, message, bookingId });
}

// FormData sends extras as "a,b" or repeated fields; JSON sends an array
const extrasField = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v ?? []),
  z.array(z.string().max(50)).max(20),
);
const phoneField = z.string().trim().regex(/^\+?[\d\s\-()]{7,20}$/, 'invalid phone number');
const emailField = z.union([z.literal(''), z.email().max(200)]).optional();

const quoteSchema = z.object({
  carId: z.coerce.number().int().positive(),
  startDate: isoDate,
  endDate: isoDate,
  extras: extrasField,
  deliveryType: z.enum(['agency', 'delivery']).default('agency'),
}).refine((b) => b.endDate >= b.startDate, { message: 'return date must be on or after pick-up date', path: ['endDate'] });

const optionalDate = z.preprocess((v) => (v === '' || v === null ? undefined : v), isoDate.optional());
const driverFields = {
  birthDate: optionalDate,
  licenseIssueDate: optionalDate,
  licenseExpiry: optionalDate,
  licenseNumber: z.string().trim().max(40).optional(),
  idNumber: z.string().trim().max(40).optional(),
  customerAddress: z.string().trim().max(300).optional(),
};

// A car can't be out while its insurance, vignette or technical inspection has run out
function assertDocumentsValid(car: { brand: string; model: string; insuranceExpiry: string | null; vignetteExpiry: string | null; inspectionExpiry: string | null }, endDate: string) {
  const expiring = documentsExpiringDuring(car, endDate);
  if (expiring.length) {
    throw new HttpError(409, `${car.brand} ${car.model}: ${expiring.map((d) => `${d.label} expires ${d.expiry}`).join(', ')}, before the end of this rental. Renew it first.`);
  }
}

const publicBookingSchema = z.object({
  car_id: z.coerce.number().int().positive(),
  guest_name: z.string().trim().min(2).max(100),
  phone: phoneField,
  email: emailField,
  start_date: isoDate,
  end_date: isoDate,
  pickup_time: timeOfDay.default('10:00'),
  return_time: timeOfDay.default('10:00'),
  delivery_type: z.enum(['agency', 'delivery']).default('agency'),
  delivery_address: z.string().trim().max(300).optional(),
  extras: extrasField,
  locale: z.enum(['en', 'fr', 'ar']).default('en'),
  birth_date: isoDate,
  license_issue_date: isoDate,
  license_expiry: z.preprocess((v) => (v === '' ? undefined : v), isoDate.optional()),
})
  .refine((b) => b.end_date >= b.start_date, { message: 'return date must be on or after pick-up date', path: ['end_date'] })
  .refine((b) => b.delivery_type !== 'delivery' || !!b.delivery_address, { message: 'delivery address is required', path: ['delivery_address'] });

const adminBookingSchema = z.object({
  carId: z.number().int().positive(),
  guestName: z.string().trim().min(2).max(100),
  phone: phoneField,
  email: emailField,
  startDate: isoDate,
  endDate: isoDate,
  pickupTime: timeOfDay.default('10:00'),
  returnTime: timeOfDay.default('10:00'),
  deliveryType: z.enum(['agency', 'delivery']).default('agency'),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  extras: extrasField,
  status: z.enum(['pending', 'approved']).default('approved'),
  notes: z.string().trim().max(2000).optional().nullable(),
  locale: z.enum(['en', 'fr', 'ar']).default('en'),
  ...driverFields,
})
  .refine((b) => b.endDate >= b.startDate, { message: 'return date must be on or after pick-up date', path: ['endDate'] })
  .refine((b) => b.deliveryType !== 'delivery' || !!b.deliveryAddress, { message: 'delivery address is required', path: ['deliveryAddress'] });

const bookingEditSchema = z.object({
  carId: z.number().int().positive().optional(),
  guestName: z.string().trim().min(2).max(100).optional(),
  phone: phoneField.optional(),
  email: emailField.nullable(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  pickupTime: timeOfDay.optional(),
  returnTime: timeOfDay.optional(),
  deliveryType: z.enum(['agency', 'delivery']).optional(),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  extras: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  locale: z.enum(['en', 'fr', 'ar']).optional(),
  ...driverFields,
});

const statusSchema = z.object({ status: z.enum(['pending', 'approved', 'declined', 'cancelled', 'picked_up', 'completed']) });
const paymentSchema = z.object({
  paymentStatus: z.enum(['unpaid', 'deposit', 'paid']),
  amountPaid: z.number().min(0).max(1_000_000),
});

const carSummary = { select: { brand: true, model: true, image: true } } as const;

// ─── Public ───────────────────────────────────────────────────────────────

router.post('/quote', quoteLimiter, async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(quoteSchema, req.body);
  const car = await prisma.car.findUnique({ where: { id: input.carId } });
  if (!car) throw new HttpError(404, 'Car not found');
  const quote = computeQuote(
    { pricePerDay: car.price, startDate: input.startDate, endDate: input.endDate, extraIds: input.extras, deliveryType: input.deliveryType },
    await getSettings(),
  );
  res.json(quote);
});

router.get('/car/:carId', async (req: Request, res: Response): Promise<void> => {
  const bookings = await prisma.booking.findMany({
    where: { carId: parseId(req.params.carId), status: { in: BLOCKING_STATUSES }, endDate: { gte: todayISO() } },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  });
  res.json(bookings);
});

// The CAPTCHA token travels in a header so it is checked before any file reaches Cloudinary
async function captchaGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!(await verifyCaptcha(req.header('x-captcha-token'), req.ip))) {
    throw new HttpError(400, 'Please complete the security check');
  }
  next();
}

router.post('/public', bookingLimiter, captchaGuard, uploadDocument.single('document'), async (req: Request, res: Response): Promise<void> => {
  const uploadedDoc = (req.file as Express.Multer.File & { path?: string } | undefined)?.path ?? null;
  try {
    const input = parseBody(publicBookingSchema, req.body);
    if (input.start_date < todayISO()) throw new HttpError(400, 'Pick-up date cannot be in the past');

    const blocked = await prisma.blockedCustomer.findUnique({ where: { phone: normalizePhone(input.phone) } });
    if (blocked) throw new HttpError(403, 'We cannot accept online bookings from this phone number. Please contact us directly.');

    const car = await prisma.car.findUnique({ where: { id: input.car_id } });
    if (!car) throw new HttpError(404, 'Car not found');
    if (!car.available) throw new HttpError(400, 'This car is currently unavailable for booking');
    if (documentsExpiringDuring(car, input.end_date).length) throw new HttpError(400, 'This car is not available for these dates');
    const settings = await getSettings();
    const problem = driverProblem(
      { birthDate: input.birth_date, licenseIssueDate: input.license_issue_date, licenseExpiry: input.license_expiry },
      input.start_date, input.end_date, settings,
    );
    if (problem) throw new HttpError(400, problem);
    if (await hasConflict(prisma, car.id, input.start_date, input.end_date)) {
      throw new HttpError(409, 'Car is already booked for these dates');
    }

    const quote = computeQuote(
      { pricePerDay: car.price, startDate: input.start_date, endDate: input.end_date, extraIds: input.extras, deliveryType: input.delivery_type },
      await getSettings(),
    );

    const booking = await createWithReference((reference) => prisma.booking.create({
      data: {
        reference,
        carId: car.id,
        guestName: input.guest_name,
        phone: input.phone,
        email: input.email || null,
        startDate: input.start_date,
        endDate: input.end_date,
        pickupTime: input.pickup_time,
        returnTime: input.return_time,
        deliveryType: input.delivery_type,
        deliveryAddress: input.delivery_type === 'delivery' ? input.delivery_address : null,
        status: 'pending',
        documentImage: uploadedDoc,
        locale: input.locale,
        source: 'online',
        birthDate: input.birth_date,
        licenseIssueDate: input.license_issue_date,
        licenseExpiry: input.license_expiry ?? null,
        ...quoteFields(quote),
      },
      include: { car: carSummary },
    }));

    await notify('new_booking', `New booking ${booking.reference} from ${booking.guestName} for ${car.brand} ${car.model}`, booking.id);
    await sendBookingEmail('received', booking.email, emailData(booking, `${car.brand} ${car.model}`));

    // The public response leaves out the private document link
    const { documentImage: _doc, ...publicBooking } = booking;
    res.status(201).json(publicBooking);
  } catch (err) {
    // A rejected booking must not leave the customer's ID document behind
    await deleteAsset(uploadedDoc);
    throw err;
  }
});

router.get('/status', statusLimiter, async (req: Request, res: Response): Promise<void> => {
  const { reference, phone } = parseBody(
    z.object({ reference: z.string().trim().toUpperCase().max(20), phone: z.string().max(30) }),
    req.query,
  );
  const booking = await prisma.booking.findUnique({ where: { reference }, include: { car: carSummary } });
  // Same answer for a wrong reference and a wrong phone, so references can't be probed
  if (!booking || normalizePhone(booking.phone) !== normalizePhone(phone)) {
    throw new HttpError(404, 'No booking found with this reference and phone number');
  }
  res.json({
    reference: booking.reference,
    status: booking.status,
    guestName: booking.guestName,
    car: booking.car,
    startDate: booking.startDate,
    endDate: booking.endDate,
    pickupTime: booking.pickupTime,
    returnTime: booking.returnTime,
    deliveryType: booking.deliveryType,
    deliveryAddress: booking.deliveryAddress,
    extras: booking.extras,
    subtotal: booking.subtotal,
    discount: booking.discount,
    extrasTotal: booking.extrasTotal,
    deliveryFee: booking.deliveryFee,
    total: booking.total,
    deposit: booking.deposit,
    paymentStatus: booking.paymentStatus,
    amountPaid: booking.amountPaid,
    extraCharges: booking.extraCharges,
    extraChargesTotal: booking.extraChargesTotal,
    createdAt: booking.createdAt,
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────

router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const bookings = await prisma.booking.findMany({
    include: { car: carSummary },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

router.get('/pending', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const bookings = await prisma.booking.findMany({
    where: { status: 'pending' },
    include: { car: carSummary },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(adminBookingSchema, req.body);
  const car = await prisma.car.findUnique({ where: { id: input.carId } });
  if (!car) throw new HttpError(404, 'Car not found');
  if (input.status === 'approved') assertDocumentsValid(car, input.endDate);
  const settings = await getSettings();
  const problem = driverProblem(input, input.startDate, input.endDate, settings);
  if (problem) throw new HttpError(400, problem);

  const quote = computeQuote(
    { pricePerDay: car.price, startDate: input.startDate, endDate: input.endDate, extraIds: input.extras, deliveryType: input.deliveryType },
    settings,
  );

  const booking = await withCarLock(car.id, async (tx) => {
    if (input.status === 'approved' && await hasConflict(tx, car.id, input.startDate, input.endDate)) {
      throw new HttpError(409, 'Car is already booked for these dates');
    }
    return createWithReference((reference) => tx.booking.create({
      data: {
        reference,
        carId: car.id,
        guestName: input.guestName,
        phone: input.phone,
        email: input.email || null,
        startDate: input.startDate,
        endDate: input.endDate,
        pickupTime: input.pickupTime,
        returnTime: input.returnTime,
        deliveryType: input.deliveryType,
        deliveryAddress: input.deliveryType === 'delivery' ? input.deliveryAddress : null,
        status: input.status,
        notes: input.notes || null,
        locale: input.locale,
        source: 'admin',
        birthDate: input.birthDate ?? null,
        licenseIssueDate: input.licenseIssueDate ?? null,
        licenseExpiry: input.licenseExpiry ?? null,
        licenseNumber: input.licenseNumber || null,
        idNumber: input.idNumber || null,
        customerAddress: input.customerAddress || null,
        ...quoteFields(quote),
      },
      include: { car: carSummary },
    }));
  });

  await audit(req, 'create', 'booking', booking.id, `${booking.reference} for ${booking.guestName} (${booking.status})`);
  await notify('new_booking', `Booking ${booking.reference} added by ${req.user!.username}`, booking.id);
  if (booking.status === 'approved') {
    await sendBookingEmail('approved', booking.email, emailData(booking, `${car.brand} ${car.model}`));
  }
  res.status(201).json(booking);
});

router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: parseId(req.params.id) }, include: { car: carSummary } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  res.json(booking);
});

router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const input = parseBody(bookingEditSchema, req.body);
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Booking not found');

  const next = {
    carId: input.carId ?? existing.carId,
    startDate: input.startDate ?? existing.startDate,
    endDate: input.endDate ?? existing.endDate,
    deliveryType: input.deliveryType ?? existing.deliveryType,
    extras: input.extras ?? (existing.extras as { id: string }[]).map((e) => e.id),
  };
  if (next.endDate < next.startDate) throw new HttpError(400, 'endDate: return date must be on or after pick-up date');
  const deliveryAddress = input.deliveryAddress !== undefined ? input.deliveryAddress : existing.deliveryAddress;
  if (next.deliveryType === 'delivery' && !deliveryAddress) throw new HttpError(400, 'deliveryAddress: delivery address is required');

  // Only re-price when something that affects the price changed, so old bookings keep their agreed price
  const repricing = input.carId !== undefined || input.startDate !== undefined || input.endDate !== undefined
    || input.deliveryType !== undefined || input.extras !== undefined;

  const car = await prisma.car.findUnique({ where: { id: next.carId } });
  if (!car) throw new HttpError(404, 'Car not found');
  const quote = repricing
    ? computeQuote({ pricePerDay: car.price, startDate: next.startDate, endDate: next.endDate, extraIds: next.extras, deliveryType: next.deliveryType as 'agency' | 'delivery' }, await getSettings())
    : null;

  if (existing.status === 'approved' && (input.carId !== undefined || input.endDate !== undefined)) assertDocumentsValid(car, next.endDate);

  const updated = await withCarLock(next.carId, async (tx) => {
    if (BLOCKING_STATUSES.includes(existing.status) && await hasConflict(tx, next.carId, next.startDate, next.endDate, id)) {
      throw new HttpError(409, 'Date conflict with another approved booking');
    }
    return tx.booking.update({
      where: { id },
      data: {
        carId: next.carId,
        guestName: input.guestName,
        phone: input.phone,
        email: input.email === undefined ? undefined : input.email || null,
        startDate: next.startDate,
        endDate: next.endDate,
        pickupTime: input.pickupTime,
        returnTime: input.returnTime,
        deliveryType: next.deliveryType,
        deliveryAddress: next.deliveryType === 'delivery' ? deliveryAddress : null,
        notes: input.notes === undefined ? undefined : input.notes || null,
        locale: input.locale,
        birthDate: input.birthDate,
        licenseIssueDate: input.licenseIssueDate,
        licenseExpiry: input.licenseExpiry,
        licenseNumber: input.licenseNumber,
        idNumber: input.idNumber,
        customerAddress: input.customerAddress,
        ...(quote ? quoteFields(quote) : {}),
      },
      include: { car: carSummary },
    });
  });

  await audit(req, 'update', 'booking', id, `${updated.reference}: ${Object.keys(input).join(', ')}`);
  emitBookingUpdate({ type: 'booking_updated', message: `Booking ${updated.reference} updated`, bookingId: id });
  res.json(updated);
});

router.put('/:id/status', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const { status } = parseBody(statusSchema, req.body);

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.status === status) throw new HttpError(400, `Booking is already ${status}`);
  if (!TRANSITIONS[booking.status]?.includes(status)) {
    throw new HttpError(400, `Cannot change a ${booking.status} booking to ${status}`);
  }

  if (status === 'approved') assertDocumentsValid(booking.car, booking.endDate);

  const updated = await withCarLock(booking.carId, async (tx) => {
    if (BLOCKING_STATUSES.includes(status) && await hasConflict(tx, booking.carId, booking.startDate, booking.endDate, id)) {
      throw new HttpError(409, 'Date conflict with another approved booking');
    }
    return tx.booking.update({ where: { id }, data: { status }, include: { car: carSummary } });
  });

  const carLabel = `${booking.car.brand} ${booking.car.model}`;
  await audit(req, `status:${status}`, 'booking', id, `${booking.reference}: ${booking.status} -> ${status}`);
  await notify(`booking_${status}`, `Booking ${booking.reference} for ${carLabel} is now ${status.replace('_', ' ')}`, id);

  const emailKind = STATUS_EMAIL[status];
  if (emailKind) await sendBookingEmail(emailKind, booking.email, emailData(booking, carLabel));

  res.json(updated);
});

router.put('/:id/payment', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const input = parseBody(paymentSchema, req.body);
  const updated = await prisma.booking.update({ where: { id }, data: input, include: { car: carSummary } });
  await audit(req, 'payment', 'booking', id, `${updated.reference}: ${input.paymentStatus}, ${input.amountPaid} DT paid`);
  emitBookingUpdate({ type: 'booking_updated', message: `Payment updated for ${updated.reference}`, bookingId: id });
  res.json(updated);
});

router.get('/:id/document', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: parseId(req.params.id) }, select: { id: true, reference: true, documentImage: true } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (!booking.documentImage) throw new HttpError(404, 'This booking has no document');
  await audit(req, 'view-document', 'booking', booking.id, booking.reference);
  res.json({ url: signedDocumentUrl(booking.documentImage), expiresInSeconds: 600 });
});

router.delete('/:id', authMiddleware, requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const booking = await prisma.booking.findUnique({ where: { id }, include: { inspections: true, onlineContract: true } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  await prisma.booking.delete({ where: { id } });
  await Promise.all([
    deleteAsset(booking.documentImage),
    ...booking.inspections.flatMap((i) => [...i.photos, i.signature].map(deleteAsset)),
    deleteAsset(booking.onlineContract?.signature),
    deleteAsset(booking.onlineContract?.pdfUrl),
  ]);
  await audit(req, 'delete', 'booking', id, `${booking.reference} (${booking.guestName})`);
  res.json({ message: 'Booking deleted' });
});

export default router;
