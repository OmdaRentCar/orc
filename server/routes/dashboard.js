import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const activeRentals = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'approved'").get().count;
  const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM bookings WHERE status = 'approved'").get().total;
  const inMaintenance = db.prepare('SELECT COUNT(*) as count FROM cars WHERE available = 0').get().count;
  const pendingCount = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").get().count;
  const totalCars = db.prepare('SELECT COUNT(*) as count FROM cars').get().count;
  const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;

  const bookingByStatus = db.prepare("SELECT status, COUNT(*) as count FROM bookings GROUP BY status").all();
  const carsByType = db.prepare("SELECT type, COUNT(*) as count FROM cars GROUP BY type").all();
  const carsByBrand = db.prepare("SELECT brand, COUNT(*) as count FROM cars GROUP BY brand ORDER BY count DESC").all();
  const monthlyBookings = db.prepare("SELECT strftime('%m', created_at) as month, COUNT(*) as count FROM bookings GROUP BY month ORDER BY month").all();

  res.json({ activeRentals, revenue, inMaintenance, pendingCount, totalCars, totalBookings, bookingByStatus, carsByType, carsByBrand, monthlyBookings });
});

router.get('/notifications', authMiddleware, (req, res) => {
  const notifs = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(notifs);
});

router.put('/notifications/:id/read', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marked as read' });
});

router.put('/notifications/read-all', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
  res.json({ message: 'All notifications marked as read' });
});

export default router;
