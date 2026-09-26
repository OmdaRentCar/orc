import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { uploadCarImages, deleteAsset } from '../services/cloudinary';
import { audit } from '../services/audit';

const router = Router();

const MAX_GALLERY = 12;

type UploadedFiles = Record<string, (Express.Multer.File & { path: string })[]> | undefined;

const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());
// Comma-separated from the admin form, or an array from JSON
const features = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map((f) => f.trim()).filter(Boolean) : v),
  z.array(z.string().trim().min(1).max(60)).max(30),
);
const optionalUrl = z.preprocess((v) => (v === '' || v === 'null' || v === 'undefined' ? null : v), z.url().max(1000).nullable());

const carFields = {
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40),
  year: z.coerce.number().int().min(1950).max(2100),
  price: z.coerce.number().positive().max(100_000),
  available: bool,
  seats: z.coerce.number().int().min(1).max(60),
  fuel: z.string().trim().min(1).max(30),
  transmission: z.string().trim().min(1).max(30),
  description: z.string().trim().max(2000).nullable(),
  features,
  image: optionalUrl,
};

const createCarSchema = z.object({
  brand: carFields.brand,
  model: carFields.model,
  type: carFields.type,
  year: carFields.year,
  price: carFields.price,
  available: carFields.available.default(true),
  seats: carFields.seats.default(5),
  fuel: carFields.fuel.default('Petrol'),
  transmission: carFields.transmission.default('Auto'),
  description: carFields.description.optional(),
  features: carFields.features.default([]),
  image: carFields.image.optional(),
});

const updateCarSchema = z.object({
  ...Object.fromEntries(Object.entries(carFields).map(([k, v]) => [k, v.optional()])) as {
    [K in keyof typeof carFields]: z.ZodOptional<(typeof carFields)[K]>
  },
  // JSON list of existing gallery URLs to keep; the rest are deleted
  gallery_keep: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  }, z.array(z.string()).max(MAX_GALLERY)).optional(),
});

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const cars = await prisma.car.findMany({ orderBy: { id: 'desc' } });
  res.json(cars);
});

router.get('/brands', async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.car.findMany({ select: { brand: true }, distinct: ['brand'], orderBy: { brand: 'asc' } });
  res.json(rows.map((r) => r.brand));
});

router.get('/types', async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.car.findMany({ select: { type: true }, distinct: ['type'], orderBy: { type: 'asc' } });
  res.json(rows.map((r) => r.type));
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const car = await prisma.car.findUnique({ where: { id: parseId(req.params.id) } });
  if (!car) throw new HttpError(404, 'Car not found');
  res.json(car);
});

router.post('/', authMiddleware, uploadCarImages, async (req: Request, res: Response): Promise<void> => {
  const files = req.files as UploadedFiles;
  const uploaded = [...(files?.image ?? []), ...(files?.gallery ?? [])].map((f) => f.path);
  try {
    const input = parseBody(createCarSchema, req.body);
    const car = await prisma.car.create({
      data: {
        ...input,
        description: input.description || null,
        image: files?.image?.[0]?.path ?? input.image ?? null,
        images: (files?.gallery ?? []).map((f) => f.path),
      },
    });
    await audit(req, 'create', 'car', car.id, `${car.brand} ${car.model}`);
    res.status(201).json(car);
  } catch (err) {
    await Promise.all(uploaded.map(deleteAsset));
    throw err;
  }
});

router.put('/:id', authMiddleware, uploadCarImages, async (req: Request, res: Response): Promise<void> => {
  const files = req.files as UploadedFiles;
  const uploaded = [...(files?.image ?? []), ...(files?.gallery ?? [])].map((f) => f.path);
  try {
    const id = parseId(req.params.id);
    const existing = await prisma.car.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Car not found');
    const { gallery_keep, image, ...input } = parseBody(updateCarSchema, req.body);

    const toDelete: string[] = [];

    let imageUrl = existing.image;
    if (files?.image?.[0]) imageUrl = files.image[0].path;
    else if (image !== undefined) imageUrl = image;
    if (imageUrl !== existing.image && existing.image) toDelete.push(existing.image);

    const kept = gallery_keep ? existing.images.filter((url) => gallery_keep.includes(url)) : existing.images;
    toDelete.push(...existing.images.filter((url) => !kept.includes(url)));
    const images = [...kept, ...(files?.gallery ?? []).map((f) => f.path)];
    if (images.length > MAX_GALLERY) throw new HttpError(400, `A car can have at most ${MAX_GALLERY} gallery photos`);

    const car = await prisma.car.update({
      where: { id },
      data: {
        ...input,
        description: input.description === undefined ? undefined : input.description || null,
        image: imageUrl,
        images,
      },
    });
    await Promise.all(toDelete.map(deleteAsset));

    const changed = [...Object.keys(input), ...(imageUrl !== existing.image ? ['image'] : []), ...(files?.gallery?.length || gallery_keep ? ['gallery'] : [])];
    await audit(req, 'update', 'car', id, `${car.brand} ${car.model}: ${changed.join(', ') || 'no changes'}`);
    res.json(car);
  } catch (err) {
    await Promise.all(uploaded.map(deleteAsset));
    throw err;
  }
});

router.delete('/:id', authMiddleware, requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const car = await prisma.car.findUnique({
    where: { id },
    include: { bookings: { select: { documentImage: true } } },
  });
  if (!car) throw new HttpError(404, 'Car not found');

  // Bookings are removed by the database cascade; their files have to be removed here
  await prisma.car.delete({ where: { id } });
  await Promise.all([
    deleteAsset(car.image),
    ...car.images.map(deleteAsset),
    ...car.bookings.map((b) => deleteAsset(b.documentImage)),
  ]);
  await audit(req, 'delete', 'car', id, `${car.brand} ${car.model} and ${car.bookings.length} booking(s)`);
  res.json({ message: 'Car deleted' });
});

export default router;
