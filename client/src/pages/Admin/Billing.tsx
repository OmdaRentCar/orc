import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiJSON, openAuthedPdf } from '../../services/api';
import { useAgency } from '../../context/AgencyContext';
import { useToast } from '../../components/ui/Toast';
import type { Subscription } from '../../services/agency';
import { money } from '../../utils/format';

interface Plan {
  id: string;
  name: string;
  monthly: number;
  maxCars: number | null;
  maxUsers: number | null;
  highlightsEn: string[];
}

interface Invoice {
  id: number;
  number: string | null;
  planName: string;
  cycle: 'monthly' | 'yearly';
  amount: number;
  status: 'paid' | 'pending';
  provider: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface BillingData {
  subscription: Subscription;
  usage: { cars: number; users: number };
  plans: Plan[];
  invoices: Invoice[];
  provider: string;
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

export const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  trial: { label: 'Free trial', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  active: { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  past_due: { label: 'Payment due', cls: 'bg-orange-500/10 text-orange-300 border-orange-500/20' },
  suspended: { label: 'Suspended', cls: 'bg-red-500/10 text-red-300 border-red-500/20' },
  cancelled: { label: 'Closed', cls: 'bg-white/5 text-brand-muted border-white/10' },
};

const PROVIDER_LABEL: Record<string, string> = { konnect: 'Konnect', flouci: 'Flouci', manual: 'Test payment', transfer: 'Bank transfer', cash: 'Cash' };

function Usage({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-brand-muted">{label}</span>
        <span className="text-brand-text font-medium">{used} / {max ?? '∞'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-orange-400' : 'bg-brand-red'}`} style={{ width: max ? `${pct}%` : '8%' }} />
      </div>
    </div>
  );
}

// The owner's subscription: where it stands, what it includes, how to pay, and the invoices
export default function Billing() {
  const { refresh } = useAgency();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<BillingData | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paying, setPaying] = useState<string | null>(null);
  const checked = useRef(false);

  const load = useCallback(async () => {
    const next = await apiJSON<BillingData>('/billing');
    setData(next);
    setCycle((c) => (next.subscription.status === 'active' ? next.subscription.cycle : c));
  }, []);

  useEffect(() => { load().catch((e) => showToast(e.message, 'error')); }, [load, showToast]);

  // Back from the payment page: ask the server, which asks the gateway
  useEffect(() => {
    const invoice = params.get('invoice');
    if (!invoice || checked.current) return;
    checked.current = true;
    const failed = params.has('failed');
    setParams({}, { replace: true });
    if (failed) {
      showToast('The payment was not completed. You can try again.', 'error');
      return;
    }
    apiJSON<{ state: string }>(`/billing/invoices/${invoice}/verify`, { method: 'POST' })
      .then(async ({ state }) => {
        if (state === 'paid') showToast('Payment received — thank you! Your subscription is active.', 'success');
        else if (state === 'pending') showToast('Payment is being confirmed. This page will update in a moment.', 'success');
        else showToast('The payment was not completed. You can try again.', 'error');
        await Promise.all([load(), refresh()]);
      })
      .catch((e) => showToast(e.message, 'error'));
  }, [params, setParams, load, refresh, showToast]);

  async function choose(plan: Plan) {
    setPaying(plan.id);
    try {
      const { payUrl } = await apiJSON<{ payUrl: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: plan.id, cycle }) });
      window.location.href = payUrl;
    } catch (e) {
      showToast((e as Error).message, 'error');
      setPaying(null);
    }
  }

  if (!data) return <p className="text-sm text-brand-muted">Loading…</p>;
  const s = data.subscription;
  const st = STATUS_STYLE[s.status];
  const price = (p: Plan) => (cycle === 'yearly' ? p.monthly * 10 : p.monthly);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-text mb-1">Subscription</h1>
        <p className="text-sm text-brand-muted">Your plan, what it includes, and your invoices.</p>
      </div>

      {/* Where the subscription stands */}
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
        <div className="bg-brand-surface border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <p className="font-display text-3xl font-extrabold text-brand-text">{s.planName}</p>
            <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-sm text-brand-muted leading-relaxed">
            {s.status === 'trial' && <>Your free trial ends on <b className="text-brand-text">{day(s.trialEndsAt)}</b> ({s.trialDaysLeft} day{s.trialDaysLeft === 1 ? '' : 's'} left). Choose a plan below to continue without interruption.</>}
            {s.status === 'active' && (s.currentPeriodEnd
              ? <>Paid until <b className="text-brand-text">{day(s.currentPeriodEnd)}</b> ({s.cycle}). Paying again now adds to this date.</>
              : <>Your subscription has no end date.</>)}
            {s.status === 'past_due' && <>Payment is due. Everything keeps working until <b className="text-orange-300">{day(s.suspendsAt)}</b>; after that your booking site is paused until payment.</>}
            {s.status === 'suspended' && <>Your booking site is paused because the subscription was not paid. <b className="text-brand-text">All your data is kept</b>: pay below and everything reopens immediately.</>}
            {s.status === 'cancelled' && <>This agency is closed. Contact support to reopen it.</>}
          </p>
        </div>
        <div className="bg-brand-surface border border-white/5 rounded-2xl p-6 space-y-4">
          <p className="text-sm font-semibold text-brand-text">Usage</p>
          <Usage label="Cars" used={data.usage.cars} max={s.limits.cars} />
          <Usage label="Team accounts" used={data.usage.users} max={s.limits.users} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {([['onlineSignature', 'Online signature'], ['customDomain', 'Own domain'], ['hideBranding', 'No platform mention']] as const).map(([k, label]) => (
              <span key={k} className={`px-2 py-1 rounded-md text-[11px] ${s.features[k] ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-brand-muted line-through'}`}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Plans */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <p className="text-sm font-semibold text-brand-text">Plans</p>
          <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button key={c} onClick={() => setCycle(c)} className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${cycle === c ? 'bg-brand-red text-white' : 'text-brand-muted hover:text-brand-text'}`}>
                {c === 'monthly' ? 'Monthly' : 'Yearly · 2 months free'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {data.plans.map((p) => {
            const current = s.plan === p.id && s.status === 'active' && s.cycle === cycle;
            const tooSmall = (p.maxCars !== null && data.usage.cars > p.maxCars) || (p.maxUsers !== null && data.usage.users > p.maxUsers);
            return (
              <div key={p.id} className={`relative rounded-2xl p-6 border flex flex-col ${p.id === 'pro' ? 'bg-brand-red/[0.06] border-brand-red/30' : 'bg-brand-surface border-white/5'}`}>
                {p.id === 'pro' && <span className="absolute -top-2.5 left-6 px-2 py-0.5 rounded-full bg-brand-red text-white text-[10px] font-bold uppercase tracking-wider">Most popular</span>}
                <p className="text-lg font-bold text-brand-text">{p.name}</p>
                <p className="mt-2 mb-4">
                  <span className="font-display text-4xl font-extrabold text-brand-text">{price(p)}</span>
                  <span className="text-sm text-brand-muted"> DT / {cycle === 'yearly' ? 'year' : 'month'}</span>
                </p>
                <ul className="space-y-2 mb-6 flex-1">
                  {p.highlightsEn.map((h) => (
                    <li key={h} className="text-xs text-brand-muted flex gap-2"><span className="text-brand-red">✓</span>{h}</li>
                  ))}
                </ul>
                <button
                  disabled={!!paying || current || tooSmall || s.status === 'cancelled'}
                  onClick={() => choose(p)}
                  title={tooSmall ? 'You use more cars or accounts than this plan allows' : undefined}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${p.id === 'pro' ? 'bg-brand-red text-white hover:brightness-110' : 'bg-white/5 text-brand-text border border-white/10 hover:bg-white/10'}`}
                >
                  {paying === p.id ? 'Opening payment…' : current ? 'Current plan' : tooSmall ? 'Too small for your fleet' : s.status === 'active' && s.plan === p.id ? 'Renew' : `Pay ${price(p)} DT`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-brand-muted mt-3">
          Prices include VAT. Secure payment by bank card, e-Dinar or wallet{data.provider !== 'manual' ? ` with ${PROVIDER_LABEL[data.provider] ?? data.provider}` : ''}. A plan change applies immediately; paying early adds to your current end date.
          {data.provider === 'manual' && <span className="text-orange-300"> Test mode: no real money is taken.</span>}
        </p>
      </div>

      {/* Invoices */}
      <div className="bg-brand-surface border border-white/5 rounded-2xl overflow-hidden">
        <p className="text-sm font-semibold text-brand-text px-6 pt-5 pb-3">Invoices</p>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-brand-muted px-6 pb-6">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-brand-muted border-b border-white/5">
                  <th className="px-6 py-2 font-medium">Invoice</th><th className="px-3 py-2 font-medium">Plan</th><th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Paid with</th><th className="px-3 py-2 font-medium text-right">Amount</th><th className="px-6 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id} className="border-b border-white/5 last:border-0">
                    <td className="px-6 py-3 text-brand-text font-mono text-xs">{i.number ?? <span className="text-orange-300 font-sans">Waiting for payment</span>}</td>
                    <td className="px-3 py-3 text-brand-muted">{i.planName} · {i.cycle}</td>
                    <td className="px-3 py-3 text-brand-muted text-xs">{i.periodStart ? `${day(i.periodStart)} → ${day(i.periodEnd)}` : '—'}</td>
                    <td className="px-3 py-3 text-brand-muted">{i.status === 'paid' ? PROVIDER_LABEL[i.provider] ?? i.provider : '—'}</td>
                    <td className="px-3 py-3 text-brand-text text-right font-medium">{money(i.amount)}</td>
                    <td className="px-6 py-3 text-right">
                      {i.status === 'paid' && (
                        <button onClick={() => openAuthedPdf(`/billing/invoices/${i.id}/pdf`).catch((e) => showToast(e.message, 'error'))} className="text-xs text-brand-red hover:underline">PDF</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
