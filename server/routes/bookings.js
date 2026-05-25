import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendBookingConfirmation } from '../email.js';
import { notifyBookingUpdate } from '../socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

function findDateConflict(carId, startDate, endDate, excludeId = null) {
  let query = `
    SELECT * FROM bookings
    WHERE car_id = ? AND status = 'approved'
      AND start_date <= ? AND end_date >= ?
  `;
  const params = [carId, endDate, startDate];
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  return db.prepare(query).get(...params);
}

router.get('/', authMiddleware, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, c.brand as car_brand, c.model as car_model
    FROM bookings b
    LEFT JOIN cars c ON b.car_id = c.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(bookings);
});

router.get('/pending', authMiddleware, (req, res) => {
  const pending = db.prepare(`
    SELECT b.*, c.brand as car_brand, c.model as car_model
    FROM bookings b
    LEFT JOIN cars c ON b.car_id = c.id
    WHERE b.status = 'pending'
    ORDER BY b.created_at DESC
  `).all();
  res.json(pending);
});

router.get('/car/:carId', (req, res) => {
  const approved = db.prepare(`
    SELECT id, start_date, end_date FROM bookings
    WHERE car_id = ? AND status = 'approved'
    ORDER BY start_date ASC
  `).all(req.params.carId);
  res.json(approved);
});

router.post('/public', upload.single('document'), (req, res) => {
  const { car_id, guest_name, phone, email, start_date, end_date } = req.body;

  if (!car_id || !guest_name || !phone || !start_date || !end_date) {
    return res.status(400).json({ error: 'Car ID, name, phone, start and end dates are required' });
  }

  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(car_id);
  if (!car) return res.status(404).json({ error: 'Car not found' });

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (end < start) return res.status(400).json({ error: 'End date must be after start date' });

  const conflict = findDateConflict(car_id, start_date, end_date);
  if (conflict) {
    return res.status(409).json({
      error: `${car.brand} ${car.model} is already booked from ${conflict.start_date} to ${conflict.end_date}. It will be available from ${conflict.end_date}.`,
      availableFrom: conflict.end_date,
    });
  }

  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  const total = days * car.price;
  const documentImage = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO bookings (car_id, guest_name, phone, email, start_date, end_date, status, document_image, total)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(car_id, guest_name, phone, email || null, start_date, end_date, documentImage, total);

  const message = `New booking request from ${guest_name} for ${car.brand} ${car.model}`;
  db.prepare('INSERT INTO notifications (message, type, booking_id) VALUES (?, ?, ?)').run(message, 'new_booking', result.lastInsertRowid);

  notifyBookingUpdate({ type: 'new_booking', message, bookingId: result.lastInsertRowid });

  const booking = db.prepare(`
    SELECT b.*, c.brand as car_brand, c.model as car_model
    FROM bookings b
    LEFT JOIN cars c ON b.car_id = c.id
    WHERE b.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(booking);
});

router.put('/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const booking = db.prepare(`
    SELECT b.*, c.brand as car_brand, c.model as car_model
    FROM bookings b
    LEFT JOIN cars c ON b.car_id = c.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (status === 'approved') {
    const conflict = findDateConflict(booking.car_id, booking.start_date, booking.end_date, booking.id);
    if (conflict) {
      return res.status(409).json({
        error: `Cannot approve — ${booking.car_brand} ${booking.car_model} is already booked from ${conflict.start_date} to ${conflict.end_date} for this period.`,
      });
    }
  }

  db.prepare('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);

  const message = `Booking #${booking.id} for ${booking.car_brand} ${booking.car_model} has been ${status}`;
  db.prepare('INSERT INTO notifications (message, type, booking_id) VALUES (?, ?, ?)').run(message, `booking_${status}`, booking.id);

  notifyBookingUpdate({ type: `booking_${status}`, message, bookingId: booking.id });

  if (status === 'approved' && booking.email) {
    sendBookingConfirmation(booking.email, {
      id: booking.id,
      car: `${booking.car_brand} ${booking.car_model}`,
      start: booking.start_date,
      end: booking.end_date,
      total: booking.total,
      name: booking.guest_name,
    });
  }

  res.json({ ...booking, status });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Booking not found' });

  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  res.json({ message: 'Booking deleted' });
});

export default router;
