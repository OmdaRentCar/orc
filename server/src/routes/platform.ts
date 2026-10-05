import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { HttpError, parseBody } from '../lib/http';
import { agencySiteUrl, runAsAgency, runUnscoped, AGENCY_SELECT } from '../lib/tenant';
import { isPlanId, plans, TRIAL_DAYS, getPlan } from '../lib/plans';
import { platform, RESERVED_SLUGS } from '../lib/platform';
import { effectiveStatus } from '../lib/subscription';
import { createHandoff } from '../lib/handoff';
import { verifyCaptcha } from '../services/captcha';
import { DEFAULT_SETTINGS } from '../services/settings';
import { confirmInvoice, platformEvent } from '../services/billing';
import { sendPlatformEmail } from '../services/platformEmail';
import consoleRouter, { sign as signConsole } from './console';

// The platform itself (no agency): plans, sign-up, login, agency directory, payment webhooks, and the console
const router = Router();
router.use('/console', consoleRouter);

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many sign-ups from this connection, try again later' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many login attempts, try again later' },
});

// One login for everyone: finds every agency where this email (or username) and password open an account,
// plus the console for the platform team. No need to remember an agency's address.
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { login, password } = parseBody(z.object({
    login: z.string().trim().min(1, 'Enter your email or username').max(200),
    password: z.string().min(1, 'Enter your password').max(200),
  }), req.body);

  const [accounts, consoleAdmin] = await runUnscoped(() => Promise.all([
    prisma.adminUser.findMany({
      where: { OR: [{ email: { equals: login, mode: 'insensitive' } }, { username: login }], agency: { status: { not: 'cancelled' } } },
      include: { agency: { select: { ...AGENCY_SELECT, logoUrl: true } } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    }),
    prisma.platformAdmin.findUnique({ where: { email: login.toLowerCase() } }),
  ]));

  const agencies = [];
  for (const a of accounts) {
    if (!(await bcrypt.compare(password, a.passwordHash))) continue;
    agencies.push({
      name: a.agency.name,
      slug: a.agency.slug,
      logoUrl: a.agency.logoUrl,
      color: a.agency.primaryColor,
      role: a.role,
      status: effectiveStatus(a.agency),
      siteUrl: agencySiteUrl(a.agency),
      loginUrl: `${agencySiteUrl(a.agency)}/login#handoff=${createHandoff(a.agency.id, a.id, 'self')}`,
    });
  }
  const consoleOk = !!consoleAdmin && await bcrypt.compare(password, consoleAdmin.passwordHash);
  if (!agencies.length && !consoleOk) throw new HttpError(401, 'Wrong email/username or password');
  res.json({
    agencies,
    console: consoleOk ? { token: signConsole({ id: consoleAdmin!.id, email: consoleAdmin!.email, name: consoleAdmin!.name }) } : null,
  });
});

router.get('/info', (_req: Request, res: Response): void => {
  const p = platform();
  res.json({
    name: p.name,
    email: p.email,
    trialDays: TRIAL_DAYS,
    plans: plans(),
    domain: process.env.PLATFORM_DOMAIN || 'localhost',
    agencyUrlTemplate: process.env.AGENCY_URL_TEMPLATE || null,
  });
});

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
}

async function slugProblem(slug: string): Promise<string | null> {
  if (!SLUG.test(slug)) return 'Use 3 to 40 lowercase letters, digits or dashes';
  if (RESERVED_SLUGS.has(slug)) return 'This address is reserved';
  const taken = await runUnscoped(() => prisma.agency.findUnique({ where: { slug }, select: { id: true } }));
  return taken ? 'This address is already taken' : null;
}

router.get('/slug', async (req: Request, res: Response): Promise<void> => {
  const wanted = slugify(String(req.query.slug ?? req.query.name ?? ''));
  const problem = wanted ? await slugProblem(wanted) : 'Choose an address';
  let suggestion: string | null = null;
  if (problem && wanted.length >= 3) {
    for (let n = 2; n < 50 && !suggestion; n++) {
      const candidate = `${wanted.slice(0, 36)}-${n}`;
      if (!(await slugProblem(candidate))) suggestion = candidate;
    }
  }
  res.json({ slug: wanted, available: !problem, problem, suggestion });
});

const signupSchema = z.object({
  agencyName: z.string().trim().min(2, 'Agency name is required').max(80),
  slug: z.string().trim().toLowerCase(),
  city: z.string().trim().min(2, 'City is required').max(60),
  phone: z.string().trim().min(8, 'Phone is required').max(30),
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_.-]+$/, 'letters, numbers, dot, dash and underscore only'),
  email: z.email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  plan: z.string().refine(isPlanId, 'Unknown plan'),
  acceptTerms: z.literal(true, 'Please accept the terms'),
});

// Creates an agency on a free trial with its owner account, then hands the owner over to their new dashboard
router.post('/signup', signupLimiter, async (req: Request, res: Response): Promise<void> => {
  if (!(await verifyCaptcha(req.header('x-captcha-token'), req.ip))) throw new HttpError(400, 'Please complete the security check');
  const input = parseBody(signupSchema, req.body);
  const problem = await slugProblem(input.slug);
  if (problem) throw new HttpError(409, `${input.slug}: ${problem}`);

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  let agency;
  try {
    agency = await runUnscoped(() => prisma.agency.create({
      data: {
        slug: input.slug, name: input.agencyName, city: input.city, phone: input.phone, ownerEmail: input.email,
        plan: input.plan, status: 'trial', trialEndsAt, listed: true,
      },
      select: { ...AGENCY_SELECT, logoUrl: true },
    }));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new HttpError(409, `${input.slug}: This address is already taken`);
    throw err;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const owner = await runAsAgency(agency, async () => {
    await prisma.businessSettings.create({
      data: {
        agencyId: agency.id,
        data: {
          ...DEFAULT_SETTINGS,
          contactEmail: input.email,
          contactPhone: input.phone,
          whatsappNumber: input.phone.replace(/\D/g, '').replace(/^(?!216)(\d{8})$/, '216$1'),
          companyName: input.agencyName,
          companyAddress: input.city,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return prisma.adminUser.create({ data: { username: input.username, email: input.email, role: 'owner', passwordHash } });
  });

  const siteUrl = agencySiteUrl(agency);
  await platformEvent(`agency: ${agency.slug}`, 'signup', agency.id, `${getPlan(input.plan).name} trial · ${input.city}`);
  await sendPlatformEmail(input.email, 'Bienvenue, votre agence est en ligne', {
    heading: `Bienvenue ${input.agencyName} !`,
    paragraphs: [
      `Votre site de réservation est prêt : ${siteUrl}`,
      `Vous profitez de ${TRIAL_DAYS} jours d’essai gratuit de la formule ${getPlan(input.plan).name}, sans engagement. Pour commencer : ajoutez vos voitures, votre logo et vos tarifs, puis partagez le lien de votre site.`,
      `Votre identifiant : ${input.username}`,
    ],
    action: { label: 'Ouvrir mon tableau de bord', url: `${siteUrl}/login` },
  });

  res.status(201).json({
    slug: agency.slug,
    siteUrl,
    trialEndsAt,
    loginUrl: `${siteUrl}/login#handoff=${createHandoff(agency.id, owner.id, 'signup')}`,
  });
});

// Agencies shown on the general page: active ones that chose to be listed
async function listedAgencies() {
  const rows = await runUnscoped(() => prisma.agency.findMany({
    where: { listed: true, status: { in: ['trial', 'active', 'past_due'] } },
    select: { ...AGENCY_SELECT, city: true, logoUrl: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  }));
  return rows.filter((a) => {
    const s = effectiveStatus(a);
    return s !== 'suspended' && s !== 'cancelled';
  });
}

// Figures for the general page's hero
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const agencies = await listedAgencies();
  res.json({
    agencies: agencies.length,
    cities: new Set(agencies.map((a) => a.city?.trim().toLowerCase()).filter(Boolean)).size,
    cars: await runUnscoped(() => prisma.car.count({ where: { agencyId: { in: agencies.map((a) => a.id) }, available: true } })),
    trialDays: TRIAL_DAYS,
  });
});

// Directory of agencies on the general page: each card links to the agency's own booking site
router.get('/agencies', async (_req: Request, res: Response): Promise<void> => {
  const agencies = await listedAgencies();
  const counts = await runUnscoped(() => prisma.car.groupBy({ by: ['agencyId'], where: { agencyId: { in: agencies.map((a) => a.id) }, available: true }, _count: { _all: true } }));
  const cars = new Map(counts.map((c) => [c.agencyId, c._count._all]));
  res.json(agencies
    .filter((a) => (cars.get(a.id) ?? 0) > 0) // an agency without cars yet has nothing to show
    .map((a) => ({ name: a.name, slug: a.slug, city: a.city, logoUrl: a.logoUrl, color: a.primaryColor, siteUrl: agencySiteUrl(a), cars: cars.get(a.id) ?? 0 })));
});

// Payment gateways call this when a payment ends; the payment is then checked with the gateway itself
async function webhook(req: Request, res: Response): Promise<void> {
  const ref = String(req.query.payment_ref ?? req.query.payment_id ?? req.body?.payment_ref ?? req.body?.payment_id ?? '');
  if (!ref) {
    res.status(400).json({ error: 'Missing payment reference' });
    return;
  }
  const inv = await runUnscoped(() => prisma.invoice.findUnique({ where: { providerRef: ref } }));
  if (!inv || inv.provider !== req.params.provider) {
    res.status(404).json({ error: 'Unknown payment' });
    return;
  }
  try {
    res.json({ state: await confirmInvoice(inv.id, `webhook: ${inv.provider}`) });
  } catch (err) {
    console.error('[BILLING] Webhook check failed:', (err as Error).message);
    res.status(502).json({ error: 'Could not check the payment' });
  }
}
router.get('/payments/:provider/webhook', webhook);
router.post('/payments/:provider/webhook', webhook);

export default router;
