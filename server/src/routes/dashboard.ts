import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const [
    activeRentals,
    revenueAgg,
    inMaintenance,
    pendingCount,
    totalCars,
    totalBookings,
    bookingByStatus,
    carsByType,
    carsByBrand,
  ] = await Promise.all([
    prisma.booking.count({ where: { status: 'approved' } }),
    prisma.booking.aggregate({ where: { status: 'approved' }, _sum: { total: true } }),
    prisma.car.count({ where: { available: false } }),
    prisma.booking.count({ where: { status: 'pending' } }),
    prisma.car.count(),
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.car.groupBy({ by: ['type'], _count: { type: true } }),
    prisma.car.groupBy({ by: ['brand'], _count: { brand: true }, orderBy: { _count: { brand: 'desc' } } }),
  ]);

  const monthlyBookings: { month: string; count: number }[] = await prisma.$queryRaw`
    SELECT TO_CHAR("created_at", 'MM') AS month, COUNT(*)::int AS count
    FROM bookings
    GROUP BY month
    ORDER BY month
  `;

  res.json({
    activeRentals,
    revenue: revenueAgg._sum.total ?? 0,
    inMaintenance,
    pendingCount,
    totalCars,
    totalBookings,
    bookingByStatus: bookingByStatus.map((r) => ({ status: r.status, count: r._count.status })),
    carsByType: carsByType.map((r) => ({ type: r.type, count: r._count.type })),
    carsByBrand: carsByBrand.map((r) => ({ brand: r.brand, count: r._count.brand })),
    monthlyBookings,
  });
});

router.get('/notifications', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.put('/notifications/:id/read', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  await prisma.notification.update({
    where: { id: parseInt(req.params.id) },
    data: { read: true },
  });
  res.json({ message: 'Marked as read' });
});

router.put('/notifications/read-all', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });
  res.json({ message: 'All notifications marked as read' });
});

export default router;
