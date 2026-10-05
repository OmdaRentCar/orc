import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { agencySiteUrl, runUnscoped } from '../lib/tenant';
import { cycleMonths, getPlan, isPlanId, plans, price, PlanId, Cycle } from '../lib/plans';
import { effectiveStatus, suspensionDate } from '../lib/subscription';
import { createHandoff } from '../lib/handoff';
import { forgetAgency } from '../middleware/agency';
import { markPaid, platformEvent } from '../services/billing';

// The platform console: the people running the platform see and manage every agency.
// Its logins are separate from agency logins (own table, own token audience).
const router = Router();

interface ConsoleUser { id: number; email: string; name: string }
declare global {
  namespace Express {
    interface Request {
      consoleUser?: ConsoleUser;
    }
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many login attempts, try again later' },
});

export const sign = (u: ConsoleUser) => jwt.sign({ pid: u.id }, process.env.JWT_SECRET!, { audience: 'platform', expiresIn: '12h' });

// Every console query reads across agencies on purpose
const all = <T>(fn: () => T): T => runUnscoped(fn);

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = parseBody(z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().min(1).max(200) }), req.body);
  const admin = await all(() => prisma.platformAdmin.findUnique({ where: { email } }));
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) throw new HttpError(401, 'Invalid credentials');
  const user = { id: admin.id, email: admin.email, name: admin.name };
  res.json({ token: sign(user), user });
});

async function consoleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  try {
    const { pid } = jwt.verify(header?.slice(7) ?? '', process.env.JWT_SECRET!, { audience: 'platform' }) as { pid: number };
    const admin = await all(() => prisma.platformAdmin.findUnique({ where: { id: pid }, select: { id: true, email: true, name: true } }));
    if (!admin) throw new Error('gone');
    req.consoleUser = admin;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  // Console handlers run outside any agency, reading across all of them
  runUnscoped(() => next());
}
router.use(consoleAuth);

const actor = (req: Request) => `console: ${req.consoleUser!.email}`;

router.get('/me', (req: Request, res: Response): void => {
  res.json(req.consoleUser);
});

const DAY = 86_400_000;
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

router.get('/overview', async (_req: Request, res: Response): Promise<void> => {
  const [agencies, paid, events] = await Promise.all([
    prisma.agency.findMany({ select: { id: true, slug: true, name: true, plan: true, billingCycle: true, status: true, trialEndsAt: true, currentPeriodEnd: true, pastDueSince: true, createdAt: true, city: true } }),
    prisma.invoice.findMany({ where: { status: 'paid', paidAt: { gte: new Date(Date.now() - 400 * DAY) } }, select: { amount: true, paidAt: true } }),
    prisma.platformEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);
  const byStatus: Record<string, number> = { trial: 0, active: 0, past_due: 0, suspended: 0, cancelled: 0 };
  let mrr = 0;
  for (const a of agencies) {
    const s = effectiveStatus(a);
    byStatus[s]++;
    // Monthly recurring revenue: paying agencies only (an active agency without end date is a free grant)
    if ((s === 'active' || s === 'past_due') && a.currentPeriodEnd) {
      const p = getPlan(a.plan);
      mrr += a.billingCycle === 'yearly' ? price(p, 'yearly') / 12 : p.monthly;
    }
  }
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(monthKey(d));
  }
  const revenue = months.map((m) => ({ month: m, amount: paid.filter((p) => p.paidAt && monthKey(p.paidAt) === m).reduce((s, p) => s + p.amount, 0) }));
  const signups = months.map((m) => ({ month: m, count: agencies.filter((a) => monthKey(a.createdAt) === m).length }));
  const soon = Date.now() + 7 * DAY;
  const trialsEnding = agencies
    .filter((a) => effectiveStatus(a) === 'trial' && a.trialEndsAt && a.trialEndsAt.getTime() < soon)
    .map((a) => ({ id: a.id, name: a.name, slug: a.slug, plan: a.plan, trialEndsAt: a.trialEndsAt }));
  res.json({ total: agencies.length, byStatus, mrr: Math.round(mrr * 1000) / 1000, revenue, signups, trialsEnding, events });
});

const agencyRow = (a: { id: number; slug: string; name: string; city: string | null; plan: string; billingCycle: string; status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; pastDueSince: Date | null; customDomain: string | null; ownerEmail: string | null; createdAt: Date; listed: boolean; _count?: { cars: number; bookings: number; adminUsers: number } }) => ({
  id: a.id, slug: a.slug, name: a.name, city: a.city, plan: a.plan, planName: getPlan(a.plan).name, cycle: a.billingCycle,
  status: effectiveStatus(a), storedStatus: a.status, trialEndsAt: a.trialEndsAt, currentPeriodEnd: a.currentPeriodEnd,
  suspendsAt: suspensionDate(a), customDomain: a.customDomain, ownerEmail: a.ownerEmail, listed: a.listed, createdAt: a.createdAt,
  siteUrl: agencySiteUrl(a), counts: a._count,
});

router.get('/agencies', async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? '').trim();
  const status = String(req.query.status ?? '');
  const rows = await prisma.agency.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q.toLowerCase() } }, { ownerEmail: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] } : {},
    include: { _count: { select: { cars: true, bookings: true, adminUsers: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(agencyRow).filter((a) => !status || a.status === status));
});

router.get('/agencies/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const a = await prisma.agency.findUnique({ where: { id }, include: { _count: { select: { cars: true, bookings: true, adminUsers: true } } } });
  if (!a) throw new HttpError(404, 'Agency not found');
  const [invoices, admins, events, lastBooking, revenue] = await Promise.all([
    prisma.invoice.findMany({ where: { agencyId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.adminUser.findMany({ where: { agencyId: id }, select: { id: true, username: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    prisma.platformEvent.findMany({ where: { agencyId: id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.booking.findFirst({ where: { agencyId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.invoice.aggregate({ where: { agencyId: id, status: 'paid' }, _sum: { amount: true } }),
  ]);
  res.json({
    ...agencyRow(a), phone: a.phone, logoUrl: a.logoUrl, primaryColor: a.primaryColor, pendingDomain: a.pendingDomain,
    lastBookingAt: lastBooking?.createdAt ?? null, totalPaid: revenue._sum.amount ?? 0,
    invoices, admins, events,
  });
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  plan: z.string().refine(isPlanId, 'Unknown plan').optional(),
  cycle: z.enum(['monthly', 'yearly']).optional(),
  status: z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled']).optional(),
  trialEndsAt: z.coerce.date().nullable().optional(),
  currentPeriodEnd: z.coerce.date().nullable().optional(),
  customDomain: z.string().trim().toLowerCase().max(200).nullable().optional(),
  listed: z.boolean().optional(),
  ownerEmail: z.email().nullable().optional(),
});

router.put('/agencies/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const input = parseBody(updateSchema, req.body);
  const { cycle, customDomain, ...rest } = input;
  const updated = await prisma.agency.update({
    where: { id },
    data: {
      ...rest,
      ...(cycle ? { billingCycle: cycle } : {}),
      ...(customDomain !== undefined ? { customDomain: customDomain || null, domainVerifiedAt: customDomain ? new Date() : null, pendingDomain: null } : {}),
      ...(input.status && input.status !== 'past_due' ? { pastDueSince: null } : {}),
      ...(input.status === 'past_due' ? { pastDueSince: new Date() } : {}),
    },
  });
  forgetAgency();
  await platformEvent(actor(req), 'update', id, JSON.stringify(input));
  res.json(agencyRow(updated));
});

router.post('/agencies/:id/extend-trial', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const { days } = parseBody(z.object({ days: z.number().int().min(1).max(365) }), req.body);
  const a = await prisma.agency.findUnique({ where: { id } });
  if (!a) throw new HttpError(404, 'Agency not found');
  const from = a.trialEndsAt && a.trialEndsAt > new Date() ? a.trialEndsAt : new Date();
  const updated = await prisma.agency.update({ where: { id }, data: { status: 'trial', trialEndsAt: new Date(from.getTime() + days * DAY), pastDueSince: null } });
  forgetAgency();
  await platformEvent(actor(req), 'extend-trial', id, `+${days} days`);
  res.json(agencyRow(updated));
});

// Payment received outside the gateways (bank transfer, cash): recorded and applied like an online one
router.post('/agencies/:id/payment', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const input = parseBody(z.object({
    plan: z.string().refine(isPlanId, 'Unknown plan'),
    cycle: z.enum(['monthly', 'yearly']),
    method: z.enum(['transfer', 'cash']),
    amount: z.number().positive().optional(),
    note: z.string().trim().max(300).optional(),
  }), req.body);
  if (!await prisma.agency.findUnique({ where: { id }, select: { id: true } })) throw new HttpError(404, 'Agency not found');
  const plan = getPlan(input.plan as PlanId);
  const inv = await prisma.invoice.create({
    data: { agencyId: id, plan: plan.id, cycle: input.cycle, months: cycleMonths(input.cycle as Cycle), amount: input.amount ?? price(plan, input.cycle as Cycle), provider: input.method, note: input.note ?? null },
  });
  await markPaid(inv.id, { actor: actor(req), provider: input.method, note: input.note });
  res.status(201).json(await prisma.invoice.findUnique({ where: { id: inv.id } }));
});

// Opens the agency's dashboard as its first owner, for support. Logged on both sides.
router.post('/agencies/:id/impersonate', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const a = await prisma.agency.findUnique({ where: { id } });
  const owner = await prisma.adminUser.findFirst({ where: { agencyId: id, role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!a || !owner) throw new HttpError(404, 'This agency has no owner account');
  await platformEvent(actor(req), 'open-dashboard', id, `as ${owner.username}`);
  res.json({ url: `${agencySiteUrl(a)}/login#handoff=${createHandoff(id, owner.id, req.consoleUser!.email)}` });
});

// Deletes an agency and everything it owns. The exact address must be typed to confirm.
router.delete('/agencies/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const { confirm } = parseBody(z.object({ confirm: z.string() }), req.body ?? {});
  const a = await prisma.agency.findUnique({ where: { id } });
  if (!a) throw new HttpError(404, 'Agency not found');
  if (confirm !== a.slug) throw new HttpError(400, `Type "${a.slug}" to confirm`);
  await prisma.agency.delete({ where: { id } });
  forgetAgency();
  await platformEvent(actor(req), 'delete', null, `${a.name} (${a.slug}, #${a.id})`);
  res.json({ message: 'Agency deleted' });
});

router.get('/invoices', async (req: Request, res: Response): Promise<void> => {
  const status = String(req.query.status ?? '');
  const rows = await prisma.invoice.findMany({
    where: status ? { status } : {},
    include: { agency: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(rows);
});

router.get('/events', async (_req: Request, res: Response): Promise<void> => {
  res.json(await prisma.platformEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }));
});

router.get('/plans', (_req: Request, res: Response): void => {
  res.json(plans());
});

router.get('/admins', async (_req: Request, res: Response): Promise<void> => {
  res.json(await prisma.platformAdmin.findMany({ select: { id: true, email: true, name: true, createdAt: true }, orderBy: { createdAt: 'asc' } }));
});

router.post('/admins', async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(z.object({ email: z.email().max(200).transform((e) => e.toLowerCase()), name: z.string().trim().min(2).max(80), password: z.string().min(10, 'At least 10 characters').max(200) }), req.body);
  const created = await prisma.platformAdmin.create({ data: { email: input.email, name: input.name, passwordHash: await bcrypt.hash(input.password, 10) }, select: { id: true, email: true, name: true, createdAt: true } });
  await platformEvent(actor(req), 'add-console-admin', null, input.email);
  res.status(201).json(created);
});

export default router;
