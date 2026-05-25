import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `car-${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get('/', (req, res) => {
  const cars = db.prepare('SELECT * FROM cars ORDER BY id DESC').all();
  const parsed = cars.map(c => ({ ...c, features: JSON.parse(c.features || '[]'), available: Boolean(c.available) }));
  res.json(parsed);
});

router.get('/brands', (req, res) => {
  const brands = db.prepare('SELECT DISTINCT brand FROM cars ORDER BY brand').all().map(b => b.brand);
  res.json(brands);
});

router.get('/types', (req, res) => {
  const types = db.prepare('SELECT DISTINCT type FROM cars ORDER BY type').all().map(t => t.type);
  res.json(types);
});

router.get('/:id', (req, res) => {
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });
  car.features = JSON.parse(car.features || '[]');
  car.available = Boolean(car.available);
  res.json(car);
});

router.post('/', authMiddleware, upload.single('image'), (req, res) => {
  const { brand, model, type, year, price, available, seats, fuel, transmission, description, features } = req.body;
  if (!brand || !model || !type || !year || !price) {
    return res.status(400).json({ error: 'Brand, model, type, year, price are required' });
  }

  let image = req.body.image || null;
  if (req.file) {
    image = `/uploads/${req.file.filename}`;
  }

  const result = db.prepare(`
    INSERT INTO cars (brand, model, type, year, price, image, available, seats, fuel, transmission, description, features)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    brand, model, type, year, price, image,
    available !== undefined ? (available === 'true' || available === true ? 1 : 0) : 1,
    seats || 5, fuel || 'Petrol', transmission || 'Auto',
    description || null, JSON.stringify(features ? (typeof features === 'string' ? JSON.parse(features) : features) : [])
  );

  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(result.lastInsertRowid);
  car.features = JSON.parse(car.features || '[]');
  car.available = Boolean(car.available);
  res.status(201).json(car);
});

router.put('/:id', authMiddleware, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Car not found' });

  let image = req.body.image;
  if (req.file) {
    image = `/uploads/${req.file.filename}`;
  } else if (image === '' || image === 'null' || image === 'undefined') {
    image = null;
  } else if (image === undefined) {
    image = existing.image;
  }

  const brand = req.body.brand || existing.brand;
  const model = req.body.model || existing.model;
  const type = req.body.type || existing.type;
  const year = req.body.year || existing.year;
  const price = req.body.price || existing.price;
  const available = req.body.available !== undefined ? (req.body.available === 'true' || req.body.available === true ? 1 : 0) : existing.available;
  const seats = req.body.seats || existing.seats;
  const fuel = req.body.fuel || existing.fuel;
  const transmission = req.body.transmission || existing.transmission;
  const description = req.body.description !== undefined ? req.body.description : existing.description;
  let features = existing.features;
  if (req.body.features) {
    features = JSON.stringify(typeof req.body.features === 'string' ? JSON.parse(req.body.features) : req.body.features);
  }

  db.prepare(`
    UPDATE cars SET brand=?, model=?, type=?, year=?, price=?, image=?, available=?, seats=?, fuel=?, transmission=?, description=?, features=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(brand, model, type, year, price, image, available, seats, fuel, transmission, description, features, req.params.id);

  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  car.features = JSON.parse(car.features || '[]');
  car.available = Boolean(car.available);
  res.json(car);
});

router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Car not found' });

  db.prepare('DELETE FROM cars WHERE id = ?').run(req.params.id);
  res.json({ message: 'Car deleted' });
});

export default router;
