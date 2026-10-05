import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody } from '../lib/http';
import { agencySiteUrl, requireAgency } from '../lib/tenant';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { forgetAgency } from '../middleware/agency';
import { uploadAgencyLogo, deleteAsset } from '../services/cloudinary';
import { audit } from '../services/audit';
import { subscriptionSummary } from '../services/subscription';
import { platform } from '../lib/platform';

// The current agency's public profile (name, logo, colour) and its editing by the owner
const router = Router();

type AgencyRow = Awaited<ReturnType<typeof prisma.agency.findUniqueOrThrow>>;
const profile = (a: AgencyRow) => {
  const subscription = subscriptionSummary(a);
  return {
    slug: a.slug,
    name: a.name,
    logoUrl: a.logoUrl,
    primaryColor: a.primaryColor,
    customDomain: a.customDomain,
    siteUrl: agencySiteUrl(a),
    city: a.city,
    listed: a.listed,
    status: subscription.status,
    plan: a.plan,
    subscription,
    platform: { name: platform().name, url: platform().url },
  };
};

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const agency = await prisma.agency.findUnique({ where: { id: requireAgency().id } });
  if (!agency) throw new HttpError(404, 'Unknown agency');
  // Real figures for the website's hero, instead of the same numbers for every agency
  const [cars, rentals, customers] = await Promise.all([
    prisma.car.count({ where: { available: true } }),
    prisma.booking.count({ where: { status: { in: ['picked_up', 'completed'] } } }),
    prisma.booking.groupBy({ by: ['phone'], where: { status: { in: ['picked_up', 'completed'] } } }).then((g) => g.length),
  ]);
  res.json({ ...profile(agency), stats: { cars, rentals, customers, since: agency.createdAt.getUTCFullYear() } });
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'use a colour like #e72526').optional(),
  removeLogo: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  city: z.string().trim().max(60).optional(),
  listed: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true), z.boolean().optional()),
});

router.put('/', authMiddleware, requireOwner, uploadAgencyLogo, async (req: Request, res: Response): Promise<void> => {
  const uploaded = (req.file as (Express.Multer.File & { path: string }) | undefined)?.path ?? null;
  try {
    const input = parseBody(updateSchema, req.body);
    const id = requireAgency().id;
    const current = await prisma.agency.findUniqueOrThrow({ where: { id } });
    const logoUrl = uploaded ?? (input.removeLogo ? null : current.logoUrl);
    const updated = await prisma.agency.update({
      where: { id },
      data: { name: input.name, primaryColor: input.primaryColor, logoUrl, city: input.city === undefined ? undefined : input.city || null, listed: input.listed },
    });
    if (current.logoUrl && current.logoUrl !== logoUrl) await deleteAsset(current.logoUrl);
    forgetAgency();
    await audit(req, 'update', 'agency', id, Object.keys(input).concat(uploaded ? ['logo'] : []).join(', '));
    res.json(profile(updated));
  } catch (err) {
    await deleteAsset(uploaded);
    throw err instanceof multer.MulterError ? new HttpError(400, err.message) : err;
  }
});

export default router;
