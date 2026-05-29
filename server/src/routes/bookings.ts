import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { uploadDocument } from '../services/cloudinary';
import { emitBookingUpdate } from '../socket';
import { sendBookingConfirmation } from '../services/email';

const router = Router();

async function hasConflict(carId: number, startDate: string, endDate: string, excludeId?: number): Promise<boolean> {
  const conflict = await prisma.booking.findFirst({
    where: {
      carId,
      status: 'approved',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return !!conflict;
}

router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const bookings = await prisma.booking.findMany({
    include: { car: { select: { brand: true, model: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

router.get('/pending', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const bookings = await prisma.booking.findMany({
    where: { status: 'pending' },
    include: { car: { select: { brand: true, model: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

router.get('/car/:carId', async (req: Request, res: Response): Promise<void> => {
  const bookings = await prisma.booking.findMany({
    where: { carId: parseInt(req.params.carId), status: 'approved' },
    select: { id: true, startDate: true, endDate: true },
  });
  res.json(bookings);
});

router.post('/public', uploadDocument.single('document'), async (req: Request, res: Response): Promise<void> => {
  const { car_id, guest_name, phone, email, start_date, end_date } = req.body;

  if (!car_id || !guest_name || !phone || !start_date || !end_date) {
    res.status(400).json({ error: 'car_id, guest_name, phone, start_date, end_date are required' });
    return;
  }

  if (end_date < start_date) {
    res.status(400).json({ error: 'end_date must be >= start_date' });
    return;
  }

  const car = await prisma.car.findUnique({ where: { id: parseInt(car_id) } });
  if (!car) {
    res.status(404).json({ error: 'Car not found' });
    return;
  }

  if (!car.available) {
    res.status(400).json({ error: 'This car is currently unavailable for booking' });
    return;
  }

  if (await hasConflict(car.id, start_date, end_date)) {
    res.status(409).json({ error: 'Car is already booked for these dates' });
    return;
  }

  const days = Math.max(1, Math.ceil((new Date(end_date).getTime() - new Date(start_date).getTime()) / 86400000));
  const total = days * car.price;
  const documentImage = (req.file as Express.Multer.File & { path?: string })?.path ?? null;

  const booking = await prisma.booking.create({
    data: {
      carId: car.id,
      guestName: guest_name,
      phone,
      email: email || null,
      startDate: start_date,
      endDate: end_date,
      status: 'pending',
      documentImage,
      total,
    },
    include: { car: { select: { brand: true, model: true } } },
  });

  await prisma.notification.create({
    data: {
      message: `New booking request from ${guest_name} for ${car.brand} ${car.model}`,
      type: 'new_booking',
      bookingId: booking.id,
    },
  });

  emitBookingUpdate({
    type: 'new_booking',
    message: `New booking from ${guest_name}`,
    bookingId: booking.id,
  });

  res.status(201).json(booking);
});

router.put('/:id/status', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status } = req.body;

  if (!['pending', 'approved', 'declined'].includes(status)) {
    res.status(400).json({ error: 'status must be pending, approved, or declined' });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { car: true },
  });
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  if (status === 'approved' && await hasConflict(booking.carId, booking.startDate, booking.endDate, id)) {
    res.status(409).json({ error: 'Date conflict with another approved booking' });
    return;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status },
    include: { car: { select: { brand: true, model: true } } },
  });

  const carLabel = `${booking.car.brand} ${booking.car.model}`;
  await prisma.notification.create({
    data: {
      message: `Booking #${id} for ${carLabel} has been ${status}`,
      type: `booking_${status}`,
      bookingId: id,
    },
  });

  emitBookingUpdate({
    type: `booking_${status}`,
    message: `Booking #${id} ${status}`,
    bookingId: id,
  });

  if (status === 'approved' && booking.email) {
    await sendBookingConfirmation(booking.email, {
      id: booking.id,
      name: booking.guestName,
      car: carLabel,
      start: booking.startDate,
      end: booking.endDate,
      total: booking.total,
    });
  }

  res.json(updated);
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  await prisma.booking.delete({ where: { id } });
  res.json({ message: 'Booking deleted' });
});

export default router;
