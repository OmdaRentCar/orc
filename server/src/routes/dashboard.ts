import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parseId } from '../lib/http';
import { addDaysISO, todayISO } from '../lib/dates';
import { authMiddleware } from '../middleware/auth';
import { carAlerts } from '../services/jobs';
import { requireAgency } from '../lib/tenant';
import { localInstant } from '../lib/dates';

const router = Router();

const REVENUE_STATUSES = ['approved', 'picked_up', 'completed'];

// The 12 months ending with the current one, as YYYY-MM
function lastTwelveMonths(today: string): string[] {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 12 + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const today = todayISO();
  const months = lastTwelveMonths(today);
  const [
    activeRentals,
    revenueAgg,
    paidAgg,
    inMaintenance,
    pendingCount,
    totalCars,
    totalBookings,
    bookingByStatus,
    carsByType,
    carsByBrand,
    upcoming,
    monthlyRows,
  ] = await Promise.all([
    // Out with a customer, or approved and due to be out today
    prisma.booking.count({
      where: {
        OR: [
          { status: 'picked_up' },
          { status: 'approved', startDate: { lte: today }, endDate: { gte: today } },
        ],
      },
    }),
    prisma.booking.aggregate({ where: { status: { in: REVENUE_STATUSES } }, _sum: { total: true } }),
    prisma.booking.aggregate({ _sum: { amountPaid: true } }),
    prisma.car.count({ where: { available: false } }),
    prisma.booking.count({ where: { status: 'pending' } }),
    prisma.car.count(),
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.car.groupBy({ by: ['type'], _count: { type: true } }),
    prisma.car.groupBy({ by: ['brand'], _count: { brand: true }, orderBy: { _count: { brand: 'desc' } } }),
    prisma.booking.findMany({
      where: {
        OR: [
          { status: 'approved', startDate: { gte: today, lte: addDaysISO(today, 7) } },
          { status: 'picked_up', endDate: { gte: today, lte: addDaysISO(today, 7) } },
        ],
      },
      include: { car: { select: { brand: true, model: true } } },
      orderBy: { startDate: 'asc' },
      take: 10,
    }),
    // Grouped by rental start month, which is when the money is earned
    prisma.$queryRaw<{ month: string; bookings: number; revenue: number }[]>`
      SELECT substr(start_date, 1, 7) AS month,
             COUNT(*) FILTER (WHERE status NOT IN ('declined', 'cancelled'))::int AS bookings,
             COALESCE(SUM(total) FILTER (WHERE status IN ('approved', 'picked_up', 'completed')), 0)::float AS revenue
      FROM bookings
      WHERE agency_id = ${requireAgency().id}
        AND substr(start_date, 1, 7) >= ${months[0]} AND substr(start_date, 1, 7) <= ${months[11]}
      GROUP BY month
    `,
  ]);

  const byMonth = new Map(monthlyRows.map((r) => [r.month, r]));

  const [alerts, outNow, finished] = await Promise.all([
    carAlerts(),
    prisma.booking.findMany({ where: { status: 'picked_up', endDate: { lte: today } }, include: { car: { select: { brand: true, model: true } } } }),
    prisma.booking.findMany({ where: { status: 'completed' }, select: { id: true, reference: true, guestName: true, phone: true, total: true, extraChargesTotal: true, amountPaid: true } }),
  ]);
  const now = Date.now();
  const lateReturns = outNow
    .filter((b) => localInstant(b.endDate, b.returnTime).getTime() < now)
    .map((b) => ({ id: b.id, reference: b.reference, guestName: b.guestName, phone: b.phone, locale: b.locale, car: `${b.car.brand} ${b.car.model}`, due: `${b.endDate} ${b.returnTime}` }));
  const unpaid = finished
    .map((b) => ({ ...b, balance: Math.round((b.total + b.extraChargesTotal - b.amountPaid) * 100) / 100 }))
    .filter((b) => b.balance > 0.001)
    .sort((a, b) => b.balance - a.balance);

  res.json({
    activeRentals,
    revenue: revenueAgg._sum.total ?? 0,
    collected: paidAgg._sum.amountPaid ?? 0,
    inMaintenance,
    pendingCount,
    totalCars,
    totalBookings,
    bookingByStatus: bookingByStatus.map((r) => ({ status: r.status, count: r._count.status })),
    carsByType: carsByType.map((r) => ({ type: r.type, count: r._count.type })),
    carsByBrand: carsByBrand.map((r) => ({ brand: r.brand, count: r._count.brand })),
    // Pick-ups and returns due in the next 7 days
    upcoming: upcoming.map((b) => ({
      id: b.id,
      reference: b.reference,
      guestName: b.guestName,
      phone: b.phone,
      locale: b.locale,
      car: `${b.car.brand} ${b.car.model}`,
      kind: b.status === 'approved' ? 'pickup' : 'return',
      date: b.status === 'approved' ? b.startDate : b.endDate,
      time: b.status === 'approved' ? b.pickupTime : b.returnTime,
    })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    alerts,
    lateReturns,
    unpaid: unpaid.slice(0, 10),
    unpaidTotal: Math.round(unpaid.reduce((s, b) => s + b.balance, 0) * 100) / 100,
    monthly: months.map((month) => ({
      month,
      bookings: byMonth.get(month)?.bookings ?? 0,
      revenue: byMonth.get(month)?.revenue ?? 0,
    })),
  });
});

router.get('/notifications', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.put('/notifications/read-all', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });
  res.json({ message: 'All notifications marked as read' });
});

router.put('/notifications/:id/read', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  // A missing id makes Prisma throw P2025, which the error handler turns into a 404
  await prisma.notification.update({
    where: { id: parseId(req.params.id) },
    data: { read: true },
  });
  res.json({ message: 'Marked as read' });
});

export default router;
