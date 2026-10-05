import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { addDaysISO, isoDate, rentalDays, todayISO } from '../lib/dates';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { audit } from '../services/audit';

// Car expenses, and which cars earn money once those costs are taken out
const router = Router();
// Login is required per route: this router is mounted on /api, so a router-wide check would block public requests

export const EXPENSE_CATEGORIES = ['repair', 'service', 'tyres', 'insurance', 'documents', 'cleaning', 'other'] as const;
const REVENUE_STATUSES = ['approved', 'picked_up', 'completed'];

const expenseSchema = z.object({
  carId: z.number().int().positive(),
  date: isoDate,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive().max(1_000_000),
  note: z.string().trim().max(300).optional(),
});

const rangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

router.get('/expenses', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { carId } = parseBody(z.object({ carId: z.coerce.number().int().positive().optional() }), req.query);
  const expenses = await prisma.expense.findMany({
    where: carId ? { carId } : {},
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    include: { car: { select: { brand: true, model: true, plateNumber: true } } },
  });
  res.json(expenses);
});

router.post('/expenses', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(expenseSchema, req.body);
  const car = await prisma.car.findUnique({ where: { id: input.carId } });
  if (!car) throw new HttpError(404, 'Car not found');
  const expense = await prisma.expense.create({ data: { ...input, note: input.note || null } });
  await audit(req, 'create', 'expense', expense.id, `${car.brand} ${car.model}: ${input.category} ${input.amount} DT`);
  res.status(201).json(expense);
});

router.delete('/expenses/:id', authMiddleware, requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const expense = await prisma.expense.delete({ where: { id } });
  await audit(req, 'delete', 'expense', id, `${expense.category} ${expense.amount} DT`);
  res.json({ message: 'Expense deleted' });
});

// Per car, over a date range: revenue, expenses, profit and how busy the car was
router.get('/reports/cars', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const today = todayISO();
  const q = parseBody(rangeSchema, req.query);
  const to = q.to ?? today;
  const from = q.from ?? addDaysISO(to, -364);
  if (from > to) throw new HttpError(400, 'from must be before to');
  const periodDays = rentalDays(from, to) + 1;

  const [cars, bookings, expenses] = await Promise.all([
    prisma.car.findMany({ orderBy: { id: 'asc' } }),
    prisma.booking.findMany({
      where: { status: { in: REVENUE_STATUSES }, startDate: { lte: to }, endDate: { gte: from } },
      select: { carId: true, startDate: true, endDate: true, total: true, extraChargesTotal: true },
    }),
    prisma.expense.findMany({ where: { date: { gte: from, lte: to } } }),
  ]);

  const rows = cars.map((car) => {
    // A booking's revenue counts in the period where it starts; busy days count only inside the period
    const carBookings = bookings.filter((b) => b.carId === car.id);
    const revenue = carBookings.filter((b) => b.startDate >= from && b.startDate <= to).reduce((s, b) => s + b.total + b.extraChargesTotal, 0);
    const bookedDays = carBookings.reduce((s, b) => {
      const start = b.startDate > from ? b.startDate : from;
      const end = b.endDate < to ? b.endDate : to;
      return s + (end >= start ? rentalDays(start, end) : 0);
    }, 0);
    const carExpenses = expenses.filter((e) => e.carId === car.id);
    const expenseTotal = carExpenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, carExpenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0)]));
    return {
      carId: car.id,
      car: `${car.brand} ${car.model}`,
      plateNumber: car.plateNumber,
      bookings: carBookings.length,
      bookedDays,
      utilization: Math.round((Math.min(bookedDays, periodDays) / periodDays) * 1000) / 10,
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(expenseTotal * 100) / 100,
      profit: Math.round((revenue - expenseTotal) * 100) / 100,
      byCategory,
    };
  });

  const totals = rows.reduce((t, r) => ({ revenue: t.revenue + r.revenue, expenses: t.expenses + r.expenses, profit: t.profit + r.profit }), { revenue: 0, expenses: 0, profit: 0 });
  res.json({ from, to, periodDays, totals, cars: rows.sort((a, b) => b.profit - a.profit) });
});

export default router;
