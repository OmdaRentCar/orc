import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { requireAgency } from '../lib/tenant';
import { isPlanId, plans, PlanId, getPlan } from '../lib/plans';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { paymentProvider, testPaymentsAllowed } from '../services/payments';
import { confirmInvoice, markPaid, startCheckout } from '../services/billing';
import { invoicePdf } from '../services/invoicePdf';
import { subscriptionSummary } from '../services/subscription';
import { audit } from '../services/audit';

// The agency's own subscription: plan, usage, payment and invoices (owner only)
const router = Router();
router.use(authMiddleware, requireOwner);

const invoiceView = (i: { id: number; number: string | null; plan: string; cycle: string; amount: number; status: string; provider: string; periodStart: Date | null; periodEnd: Date | null; paidAt: Date | null; createdAt: Date }) => ({
  id: i.id, number: i.number, plan: i.plan, planName: getPlan(i.plan).name, cycle: i.cycle, amount: i.amount, status: i.status,
  provider: i.provider, periodStart: i.periodStart, periodEnd: i.periodEnd, paidAt: i.paidAt, createdAt: i.createdAt,
});

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const agency = await (prisma.agency.findUniqueOrThrow({ where: { id: requireAgency().id } }));
  const [cars, users, invoices] = await Promise.all([
    prisma.car.count(),
    prisma.adminUser.count(),
    prisma.invoice.findMany({ where: { status: { in: ['paid', 'pending'] } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  let provider = 'manual';
  try { provider = paymentProvider().id; } catch { provider = 'none'; }
  res.json({
    subscription: subscriptionSummary(agency),
    usage: { cars, users },
    plans: plans(),
    invoices: invoices.map(invoiceView),
    provider,
  });
});

const checkoutSchema = z.object({
  plan: z.string().refine(isPlanId, 'Unknown plan'),
  cycle: z.enum(['monthly', 'yearly']),
});

router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(checkoutSchema, req.body);
  const result = await startCheckout(requireAgency().id, input.plan as PlanId, input.cycle, { name: req.user!.username, email: req.user!.email });
  await audit(req, 'checkout', 'subscription', result.invoiceId, `${input.plan} ${input.cycle}`);
  res.json(result);
});

// Called when the owner comes back from the payment page: the gateway is asked directly
router.post('/invoices/:id/verify', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  if (!await prisma.invoice.findUnique({ where: { id } })) throw new HttpError(404, 'Invoice not found');
  res.json({ state: await confirmInvoice(id, `agency: ${requireAgency().slug}`) });
});

// Test mode only: the fake checkout page reports its result here
router.post('/invoices/:id/test-pay', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const { outcome } = parseBody(z.object({ outcome: z.enum(['paid', 'failed']) }), req.body);
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) throw new HttpError(404, 'Invoice not found');
  if (inv.provider !== 'manual' || !testPaymentsAllowed()) throw new HttpError(403, 'Test payments are disabled');
  if (inv.status !== 'pending') throw new HttpError(409, 'This invoice is no longer waiting for payment');
  if (outcome === 'paid') await markPaid(id, { actor: `agency: ${requireAgency().slug}`, note: 'Test payment, no real money' });
  else await prisma.invoice.update({ where: { id }, data: { status: 'failed' } });
  res.json({ state: outcome });
});

router.get('/invoices/:id/pdf', async (req: Request, res: Response): Promise<void> => {
  const inv = await prisma.invoice.findUnique({ where: { id: parseId(req.params.id) }, include: { agency: true } });
  if (!inv || inv.status !== 'paid') throw new HttpError(404, 'Invoice not found');
  const pdf = await invoicePdf(inv, inv.agency);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${inv.number}.pdf"`);
  res.send(pdf);
});

export default router;
