import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody } from '../lib/http';
import { normalizePhone } from '../lib/phone';
import { authMiddleware } from '../middleware/auth';
import { audit } from '../services/audit';

// Customers are not stored separately: they are the bookings grouped by phone number
const router = Router();
router.use(authMiddleware);

const REVENUE_STATUSES = ['approved', 'picked_up', 'completed'];

interface CustomerRow {
  phone: string;
  normalizedPhone: string;
  name: string;
  email: string | null;
  bookings: number;
  completed: number;
  cancelledOrDeclined: number;
  totalSpent: number;
  lastBookingAt: string | null;
  blocked: boolean;
  blockReason: string | null;
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const [bookings, blocked] = await Promise.all([
    prisma.booking.findMany({
      select: { guestName: true, phone: true, email: true, status: true, total: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.blockedCustomer.findMany(),
  ]);
  const blockedByPhone = new Map(blocked.map((b) => [b.phone, b]));

  const customers = new Map<string, CustomerRow>();
  for (const b of bookings) {
    const key = normalizePhone(b.phone);
    let row = customers.get(key);
    if (!row) {
      // Bookings are newest first, so the first one seen holds the latest name and email
      row = {
        phone: b.phone, normalizedPhone: key, name: b.guestName, email: b.email,
        bookings: 0, completed: 0, cancelledOrDeclined: 0, totalSpent: 0,
        lastBookingAt: b.createdAt.toISOString(),
        blocked: blockedByPhone.has(key), blockReason: blockedByPhone.get(key)?.reason ?? null,
      };
      customers.set(key, row);
    }
    row.email ??= b.email;
    row.bookings++;
    if (b.status === 'completed') row.completed++;
    if (b.status === 'declined' || b.status === 'cancelled') row.cancelledOrDeclined++;
    if (REVENUE_STATUSES.includes(b.status)) row.totalSpent += b.total;
  }

  // Blocked numbers with no bookings still show up, so they can be unblocked
  for (const b of blocked) {
    if (!customers.has(b.phone)) {
      customers.set(b.phone, {
        phone: b.phone, normalizedPhone: b.phone, name: b.name ?? '-', email: null,
        bookings: 0, completed: 0, cancelledOrDeclined: 0, totalSpent: 0, lastBookingAt: null,
        blocked: true, blockReason: b.reason,
      });
    }
  }

  res.json([...customers.values()]);
});

const blockSchema = z.object({
  phone: z.string().trim().min(7).max(30),
  name: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(300).optional(),
});

router.post('/block', async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(blockSchema, req.body);
  const phone = normalizePhone(input.phone);
  if (phone.length < 7) throw new HttpError(400, 'phone: invalid phone number');

  const existing = await prisma.blockedCustomer.findFirst({ where: { phone } });
  const entry = existing
    ? await prisma.blockedCustomer.update({ where: { id: existing.id }, data: { name: input.name || undefined, reason: input.reason || null } })
    : await prisma.blockedCustomer.create({ data: { phone, name: input.name || null, reason: input.reason || null } });
  await audit(req, 'block', 'customer', entry.id, `${input.phone}${input.reason ? `: ${input.reason}` : ''}`);
  res.status(201).json(entry);
});

router.delete('/block/:phone', async (req: Request, res: Response): Promise<void> => {
  const phone = normalizePhone(req.params.phone);
  const entry = await prisma.blockedCustomer.findFirst({ where: { phone } });
  if (!entry) throw new HttpError(404, 'This phone number is not blocked');
  await prisma.blockedCustomer.delete({ where: { id: entry.id } });
  await audit(req, 'unblock', 'customer', entry.id, phone);
  res.json({ message: 'Customer unblocked' });
});

export default router;
