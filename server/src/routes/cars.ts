import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { uploadCarImage, cloudinary } from '../services/cloudinary';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const cars = await prisma.car.findMany({ orderBy: { id: 'desc' } });
  res.json(cars);
});

router.get('/brands', async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.car.findMany({
    select: { brand: true },
    distinct: ['brand'],
    orderBy: { brand: 'asc' },
  });
  res.json(rows.map((r) => r.brand));
});

router.get('/types', async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.car.findMany({
    select: { type: true },
    distinct: ['type'],
    orderBy: { type: 'asc' },
  });
  res.json(rows.map((r) => r.type));
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const car = await prisma.car.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!car) {
    res.status(404).json({ error: 'Car not found' });
    return;
  }
  res.json(car);
});

router.post('/', authMiddleware, uploadCarImage.single('image'), async (req: Request, res: Response): Promise<void> => {
  const { brand, model, type, year, price, available, seats, fuel, transmission, description, features } = req.body;
  if (!brand || !model || !type || !year || !price) {
    res.status(400).json({ error: 'brand, model, type, year, price are required' });
    return;
  }

  const imageUrl = (req.file as Express.Multer.File & { path?: string; secure_url?: string })?.path ?? null;

  const parsedFeatures: string[] = features
    ? (Array.isArray(features) ? features : (typeof features === 'string' ? features.split(',').map((f: string) => f.trim()).filter(Boolean) : []))
    : [];

  const car = await prisma.car.create({
    data: {
      brand,
      model,
      type,
      year: parseInt(year),
      price: parseFloat(price),
      image: imageUrl,
      available: available !== undefined ? available === 'true' || available === true : true,
      seats: seats ? parseInt(seats) : 5,
      fuel: fuel || 'Petrol',
      transmission: transmission || 'Auto',
      description: description || null,
      features: parsedFeatures,
    },
  });

  res.status(201).json(car);
});

router.put('/:id', authMiddleware, uploadCarImage.single('image'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const existing = await prisma.car.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Car not found' });
    return;
  }

  const { brand, model, type, year, price, available, seats, fuel, transmission, description, features, image } = req.body;

  let imageUrl: string | null = existing.image;
  if (req.file) {
    imageUrl = (req.file as Express.Multer.File & { path?: string })?.path ?? null;
    if (existing.image?.includes('cloudinary.com')) {
      const publicId = existing.image.split('/').slice(-2).join('/').replace(/\.[^.]+$/, '');
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }
  } else if (image === '' || image === 'null' || image === 'undefined') {
    imageUrl = null;
  } else if (image !== undefined) {
    imageUrl = image;
  }

  const parsedFeatures: string[] | undefined = features !== undefined
    ? (Array.isArray(features) ? features : features.split(',').map((f: string) => f.trim()).filter(Boolean))
    : undefined;

  const car = await prisma.car.update({
    where: { id },
    data: {
      brand: brand ?? existing.brand,
      model: model ?? existing.model,
      type: type ?? existing.type,
      year: year ? parseInt(year) : existing.year,
      price: price ? parseFloat(price) : existing.price,
      image: imageUrl,
      available: available !== undefined ? (available === 'true' || available === true) : existing.available,
      seats: seats ? parseInt(seats) : existing.seats,
      fuel: fuel ?? existing.fuel,
      transmission: transmission ?? existing.transmission,
      description: description !== undefined ? description : existing.description,
      features: parsedFeatures ?? existing.features,
    },
  });

  res.json(car);
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) {
    res.status(404).json({ error: 'Car not found' });
    return;
  }

  if (car.image?.includes('cloudinary.com')) {
    const publicId = car.image.split('/').slice(-2).join('/').replace(/\.[^.]+$/, '');
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }

  await prisma.car.delete({ where: { id } });
  res.json({ message: 'Car deleted' });
});

export default router;
