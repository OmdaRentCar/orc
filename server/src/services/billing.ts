import prisma from '../lib/prisma';
import { HttpError } from '../lib/http';
import { agencySiteUrl, runUnscoped } from '../lib/tenant';
import { Cycle, PlanId, cycleMonths, getPlan, price } from '../lib/plans';
import { platform } from '../lib/platform';
import { forgetAgency } from '../middleware/agency';
import { paymentProvider, providerById } from './payments';
import { invoicePdf } from './invoicePdf';
import { sendPlatformEmail } from './platformEmail';

export async function platformEvent(actor: string, action: string, agencyId: number | null, details?: string): Promise<void> {
  await runUnscoped(() => prisma.platformEvent.create({ data: { actor, action, agencyId, details: details ?? null } }));
}

const addMonths = (d: Date, n: number) => {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + n);
  return out;
};

// Opens a payment for the next period of the current agency; returns where to send the owner
export async function startCheckout(agencyId: number, planId: PlanId, cycle: Cycle, owner: { name: string; email: string }): Promise<{ invoiceId: number; payUrl: string }> {
  const plan = getPlan(planId);
  const provider = paymentProvider();
  const agency = await runUnscoped(() => prisma.agency.findUniqueOrThrow({ where: { id: agencyId } }));
  // An unpaid checkout left open is replaced, so the list only shows one pending invoice
  await prisma.invoice.updateMany({ where: { status: 'pending' }, data: { status: 'cancelled' } });
  const invoice = await prisma.invoice.create({
    data: { plan: plan.id, cycle, months: cycleMonths(cycle), amount: price(plan, cycle), provider: provider.id },
  });
  const site = agencySiteUrl(agency);
  try {
    const { ref, payUrl } = await provider.init({
      invoiceId: invoice.id,
      amount: invoice.amount,
      description: `${platform().name} ${plan.name} - ${agency.name}`,
      successUrl: `${site}/admin/billing?invoice=${invoice.id}`,
      failUrl: `${site}/admin/billing?invoice=${invoice.id}&failed=1`,
      webhookUrl: `${platform().apiUrl}/api/platform/payments/${provider.id}/webhook`,
      customer: { name: owner.name, email: owner.email, phone: agency.phone },
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { providerRef: ref, payUrl } });
    return { invoiceId: invoice.id, payUrl };
  } catch (err) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'failed', note: (err as Error).message.slice(0, 300) } });
    console.error('[BILLING] Could not open the payment:', (err as Error).message);
    throw new HttpError(502, 'The payment page could not be opened. Please try again in a moment.');
  }
}

// Marks an invoice paid and extends the agency's subscription. Safe to call twice (webhook + redirect).
export async function markPaid(invoiceId: number, how: { provider?: string; note?: string; actor: string }): Promise<boolean> {
  const result = await runUnscoped(() => prisma.$transaction(async (tx) => {
    // Lock the invoice row so two confirmations at the same moment cannot both extend the period
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { agency: true } });
    if (!inv || inv.status === 'paid') return null;
    const now = new Date();
    const a = inv.agency;
    // Paying early adds to the time already paid; otherwise the new period starts today
    const start = a.status === 'active' && a.currentPeriodEnd && a.currentPeriodEnd > now ? a.currentPeriodEnd : now;
    const end = addMonths(start, inv.months);
    const paid = await tx.invoice.update({
      where: { id: inv.id },
      data: {
        status: 'paid', paidAt: now, periodStart: start, periodEnd: end,
        number: `INV-${now.getUTCFullYear()}-${String(inv.id).padStart(5, '0')}`,
        provider: how.provider ?? inv.provider, note: how.note ?? inv.note,
      },
    });
    const agency = await tx.agency.update({
      where: { id: a.id },
      data: { plan: inv.plan, billingCycle: inv.cycle, status: 'active', currentPeriodEnd: end, pastDueSince: null },
    });
    return { paid, agency };
  }));
  if (!result) return false;
  forgetAgency();
  const { paid, agency } = result;
  await platformEvent(how.actor, 'payment', agency.id, `${paid.number} · ${paid.amount} DT · ${getPlan(paid.plan).name} ${paid.cycle}`);
  const pdf = await invoicePdf(paid, agency).catch(() => null);
  await sendPlatformEmail(agency.ownerEmail, 'Paiement reçu, merci', {
    heading: 'Votre abonnement est prolongé',
    paragraphs: [
      `Nous avons bien reçu ${paid.amount} DT pour l’abonnement ${getPlan(paid.plan).name} de ${agency.name}.`,
      `Votre abonnement est actif jusqu’au ${paid.periodEnd!.toISOString().slice(0, 10).split('-').reverse().join('/')}. La facture ${paid.number} est jointe.`,
    ],
    action: { label: 'Voir mon abonnement', url: `${agencySiteUrl(agency)}/admin/billing` },
    attachments: pdf ? [{ filename: `${paid.number}.pdf`, content: pdf }] : [],
  });
  return true;
}

// Asks the gateway whether this invoice was paid, and applies it if so
export async function confirmInvoice(invoiceId: number, actor: string): Promise<'paid' | 'pending' | 'failed'> {
  const inv = await runUnscoped(() => prisma.invoice.findUnique({ where: { id: invoiceId } }));
  if (!inv) throw new HttpError(404, 'Invoice not found');
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'cancelled' || inv.status === 'failed') return 'failed';
  const provider = providerById(inv.provider);
  if (!provider || !inv.providerRef) return 'pending';
  const { state, amount } = await provider.verify(inv.providerRef);
  if (state === 'paid') {
    if (amount !== null && Math.abs(amount - inv.amount) > 0.001) {
      await platformEvent('system', 'payment-mismatch', inv.agencyId, `invoice ${inv.id}: paid ${amount} DT, expected ${inv.amount} DT`);
      return 'pending';
    }
    await markPaid(inv.id, { actor });
    return 'paid';
  }
  if (state === 'failed') {
    await runUnscoped(() => prisma.invoice.update({ where: { id: inv.id }, data: { status: 'failed' } }));
  }
  return state;
}
