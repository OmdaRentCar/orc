import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { dt, frDate, platformJSON, Plan } from '../api';
import { card, inputCls, StatusPill } from './ConsoleLayout';
import { useToast } from '../../components/ui/Toast';

interface Event { id: number; actor: string; action: string; agencyId: number | null; details: string | null; createdAt: string }
interface AgencyRow {
  id: number; slug: string; name: string; city: string | null; plan: string; planName: string; cycle: string; status: string;
  trialEndsAt: string | null; currentPeriodEnd: string | null; suspendsAt: string | null; customDomain: string | null;
  ownerEmail: string | null; listed: boolean; createdAt: string; siteUrl: string; counts?: { cars: number; bookings: number; adminUsers: number };
}
interface Invoice { id: number; number: string | null; plan: string; cycle: string; amount: number; status: string; provider: string; paidAt: string | null; periodEnd: string | null; createdAt: string; note: string | null; agency?: { id: number; name: string; slug: string } }

const month = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

function Bars({ data, value, format }: { data: { month: string }[]; value: (d: never) => number; format: (n: number) => string }) {
  const values = data.map((d) => value(d as never));
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((d, i) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
          <span className="text-[10px] text-brand-muted opacity-0 group-hover:opacity-100">{format(values[i])}</span>
          <div className="w-full rounded-t-md bg-brand-red/70 group-hover:bg-brand-red transition-colors" style={{ height: `${Math.max(2, (values[i] / max) * 120)}px` }} />
          <span className="text-[10px] text-brand-muted">{month(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-xs text-brand-muted">{label}</p>
      <p className="font-display text-3xl font-extrabold text-brand-text mt-1">{value}</p>
      {sub && <p className="text-[11px] text-brand-muted mt-1">{sub}</p>}
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  signup: 'Signed up', payment: 'Payment', 'past-due': 'Payment overdue', suspended: 'Suspended', update: 'Updated',
  'extend-trial': 'Trial extended', 'open-dashboard': 'Opened dashboard', delete: 'Deleted', 'custom-domain': 'Own domain connected',
  'add-console-admin': 'Console account added', 'payment-mismatch': 'Payment amount mismatch',
};

export function EventList({ events }: { events: Event[] }) {
  if (!events.length) return <p className="text-sm text-brand-muted">Nothing yet.</p>;
  return (
    <ul className="divide-y divide-white/5">
      {events.map((e) => (
        <li key={e.id} className="py-2.5 flex items-start justify-between gap-4 text-sm">
          <div className="min-w-0">
            <span className="text-brand-text font-medium">{EVENT_LABEL[e.action] ?? e.action}</span>
            {e.details && <span className="text-brand-muted"> · {e.details}</span>}
            <p className="text-[11px] text-brand-muted truncate">{e.actor}{e.agencyId ? <> · <Link to={`/console/agencies/${e.agencyId}`} className="hover:text-brand-text">agency #{e.agencyId}</Link></> : null}</p>
          </div>
          <span className="text-[11px] text-brand-muted whitespace-nowrap">{new Date(e.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </li>
      ))}
    </ul>
  );
}

export function Overview() {
  const [d, setD] = useState<{ total: number; byStatus: Record<string, number>; mrr: number; revenue: { month: string; amount: number }[]; signups: { month: string; count: number }[]; trialsEnding: { id: number; name: string; slug: string; plan: string; trialEndsAt: string }[]; events: Event[] } | null>(null);
  useEffect(() => { platformJSON<typeof d>('/console/overview').then(setD).catch(() => {}); }, []);
  if (!d) return <p className="text-sm text-brand-muted">Loading…</p>;
  const yearRevenue = d.revenue.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-brand-text">Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Monthly recurring revenue" value={dt(d.mrr)} sub="paying agencies, yearly plans spread over 12 months" />
        <Kpi label="Agencies" value={d.total} sub={`${d.byStatus.active} active · ${d.byStatus.trial} on trial`} />
        <Kpi label="Need attention" value={d.byStatus.past_due + d.byStatus.suspended} sub={`${d.byStatus.past_due} past due · ${d.byStatus.suspended} suspended`} />
        <Kpi label="Revenue, last 12 months" value={dt(yearRevenue)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className={`${card} p-5`}><p className="text-sm font-semibold text-brand-text mb-4">Revenue per month</p><Bars data={d.revenue} value={(r: { amount: number }) => r.amount} format={(n) => `${Math.round(n)}`} /></div>
        <div className={`${card} p-5`}><p className="text-sm font-semibold text-brand-text mb-4">New agencies per month</p><Bars data={d.signups} value={(r: { count: number }) => r.count} format={(n) => String(n)} /></div>
      </div>
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-brand-text mb-3">Trials ending within 7 days</p>
          {d.trialsEnding.length === 0 ? <p className="text-sm text-brand-muted">None.</p> : (
            <ul className="space-y-2">
              {d.trialsEnding.map((t) => (
                <li key={t.id}><Link to={`/console/agencies/${t.id}`} className="flex justify-between text-sm hover:text-brand-red"><span className="text-brand-text">{t.name}</span><span className="text-brand-muted">{frDate(t.trialEndsAt)}</span></Link></li>
              ))}
            </ul>
          )}
        </div>
        <div className={`${card} p-5`}><p className="text-sm font-semibold text-brand-text mb-2">Latest activity</p><EventList events={d.events} /></div>
      </div>
    </div>
  );
}

export function Agencies() {
  const [rows, setRows] = useState<AgencyRow[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    const t = setTimeout(() => platformJSON<AgencyRow[]>(`/console/agencies?q=${encodeURIComponent(q)}&status=${status}`).then(setRows).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, status]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand-text">Agencies</h1>
        <div className="flex gap-2">
          <input className={`${inputCls} w-56`} placeholder="Search name, address, email, city" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${inputCls} w-36`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Closed</option>
          </select>
        </div>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-brand-muted border-b border-white/5">
            <th className="px-5 py-3 font-medium">Agency</th><th className="px-3 py-3 font-medium">Plan</th><th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Until</th><th className="px-3 py-3 font-medium text-right">Cars</th><th className="px-3 py-3 font-medium text-right">Bookings</th><th className="px-5 py-3 font-medium">Joined</th>
          </tr></thead>
          <tbody>
            {rows?.map((a) => (
              <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-5 py-3"><Link to={`/console/agencies/${a.id}`} className="text-brand-text font-medium hover:text-brand-red">{a.name}</Link><p className="text-[11px] text-brand-muted font-mono">{a.customDomain ?? a.slug}{a.city ? ` · ${a.city}` : ''}</p></td>
                <td className="px-3 py-3 text-brand-muted">{a.planName}{a.cycle === 'yearly' ? ' · yearly' : ''}</td>
                <td className="px-3 py-3"><StatusPill status={a.status} /></td>
                <td className="px-3 py-3 text-brand-muted text-xs">{a.status === 'trial' ? frDate(a.trialEndsAt) : a.currentPeriodEnd ? frDate(a.currentPeriodEnd) : '—'}</td>
                <td className="px-3 py-3 text-right text-brand-text">{a.counts?.cars}</td>
                <td className="px-3 py-3 text-right text-brand-text">{a.counts?.bookings}</td>
                <td className="px-5 py-3 text-brand-muted text-xs">{frDate(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows?.length === 0 && <p className="p-5 text-sm text-brand-muted">No agency matches.</p>}
      </div>
    </div>
  );
}

type Detail = AgencyRow & { phone: string | null; logoUrl: string | null; primaryColor: string; pendingDomain: string | null; lastBookingAt: string | null; totalPaid: number; invoices: Invoice[]; admins: { id: number; username: string; email: string; role: string }[]; events: Event[] };

export function AgencyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [a, setA] = useState<Detail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ plan: 'pro', cycle: 'monthly', method: 'transfer', amount: '', note: '' });
  const [edit, setEdit] = useState({ plan: '', status: '', customDomain: '' });
  const [trialDays, setTrialDays] = useState('7');
  const [confirmDelete, setConfirmDelete] = useState('');

  const load = useCallback(() => platformJSON<Detail>(`/console/agencies/${id}`).then((d) => {
    setA(d);
    setEdit({ plan: d.plan, status: d.status, customDomain: d.customDomain ?? '' });
    setPay((p) => ({ ...p, plan: d.plan, cycle: d.cycle }));
  }), [id]);
  useEffect(() => { load().catch((e) => showToast(e.message, 'error')); platformJSON<Plan[]>('/console/plans').then(setPlans).catch(() => {}); }, [load, showToast]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); showToast(ok, 'success'); await load(); } catch (e) { showToast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (!a) return <p className="text-sm text-brand-muted">Loading…</p>;
  const planPrice = plans.find((p) => p.id === pay.plan)?.monthly ?? 0;

  return (
    <div className="space-y-5">
      <Link to="/console/agencies" className="text-xs text-brand-muted hover:text-brand-text">← Agencies</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: a.primaryColor }}>
            {a.logoUrl ? <img src={a.logoUrl} alt="" className="w-full h-full object-contain bg-white" /> : <span className="text-white font-bold text-xl">{a.name[0]}</span>}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-text flex items-center gap-3">{a.name} <StatusPill status={a.status} /></h1>
            <a href={a.siteUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-muted font-mono hover:text-brand-red">{a.siteUrl.replace(/^https?:\/\//, '')}</a>
          </div>
        </div>
        <button disabled={busy} onClick={() => act(async () => { const { url } = await platformJSON<{ url: string }>(`/console/agencies/${a.id}/impersonate`, { method: 'POST' }); window.open(url, '_blank'); }, 'Dashboard opened in a new tab')}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-brand-text hover:bg-white/10">Open their dashboard ↗</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Plan', `${a.planName}${a.cycle === 'yearly' ? ' (yearly)' : ''}`], [a.status === 'trial' ? 'Trial ends' : 'Paid until', a.status === 'trial' ? frDate(a.trialEndsAt) : a.currentPeriodEnd ? frDate(a.currentPeriodEnd) : 'No end'], ['Cars / bookings', `${a.counts?.cars} / ${a.counts?.bookings}`], ['Total paid', dt(a.totalPaid)], ['Last booking', frDate(a.lastBookingAt)]].map(([k, v]) => (
          <div key={k} className={`${card} p-4`}><p className="text-[11px] text-brand-muted">{k}</p><p className="text-sm font-semibold text-brand-text mt-1">{v}</p></div>
        ))}
      </div>
      {a.suspendsAt && a.status === 'past_due' && <p className="text-sm text-orange-300">Will be suspended on {frDate(a.suspendsAt)} unless paid.</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Record a payment received outside the gateway */}
        <form className={`${card} p-5 space-y-3`} onSubmit={(e: FormEvent) => { e.preventDefault(); act(() => platformJSON(`/console/agencies/${a.id}/payment`, { method: 'POST', body: JSON.stringify({ plan: pay.plan, cycle: pay.cycle, method: pay.method, amount: pay.amount ? Number(pay.amount) : undefined, note: pay.note || undefined }) }), 'Payment recorded, subscription extended'); }}>
          <p className="text-sm font-semibold text-brand-text">Record a payment (transfer, cash)</p>
          <div className="grid grid-cols-3 gap-2">
            <select className={inputCls} value={pay.plan} onChange={(e) => setPay({ ...pay, plan: e.target.value })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select className={inputCls} value={pay.cycle} onChange={(e) => setPay({ ...pay, cycle: e.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
            <select className={inputCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="transfer">Transfer</option><option value="cash">Cash</option></select>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <input className={inputCls} type="number" step="0.001" min="0" placeholder={`${pay.cycle === 'yearly' ? planPrice * 10 : planPrice} DT`} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <input className={inputCls} placeholder="Note (bank reference…)" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} maxLength={300} />
          </div>
          <button disabled={busy} className="px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-semibold disabled:opacity-50">Record payment</button>
        </form>

        {/* Subscription controls */}
        <div className={`${card} p-5 space-y-4`}>
          <p className="text-sm font-semibold text-brand-text">Subscription</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-brand-muted space-y-1.5"><span>Plan</span>
              <select className={inputCls} value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label className="text-xs text-brand-muted space-y-1.5"><span>Status</span>
              <select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Closed</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-brand-muted space-y-1.5"><span>Own domain (Business plan)</span>
            <input className={inputCls} placeholder="location-sfax.tn" value={edit.customDomain} onChange={(e) => setEdit({ ...edit, customDomain: e.target.value })} />
          </label>
          <button disabled={busy} onClick={() => act(() => platformJSON(`/console/agencies/${a.id}`, { method: 'PUT', body: JSON.stringify({ plan: edit.plan, ...(edit.status !== a.status ? { status: edit.status } : {}), customDomain: edit.customDomain.trim() || null }) }), 'Saved')} className="px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-semibold disabled:opacity-50">Save changes</button>

          <div className="border-t border-white/5 pt-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-brand-text">Extend the trial by</span>
              <input className={`${inputCls} w-20`} type="number" min="1" max="365" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} aria-label="Days" />
              <span className="text-sm text-brand-text">days</span>
              <button disabled={busy} onClick={() => act(() => platformJSON(`/console/agencies/${a.id}/extend-trial`, { method: 'POST', body: JSON.stringify({ days: Number(trialDays) }) }), 'Trial extended')} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-brand-text hover:bg-white/10">Extend</button>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-brand-text">{a.listed ? 'Shown in the agency directory on the home page' : 'Hidden from the home page directory'}</span>
              <button disabled={busy} onClick={() => act(() => platformJSON(`/console/agencies/${a.id}`, { method: 'PUT', body: JSON.stringify({ listed: !a.listed }) }), a.listed ? 'Hidden from the home page directory' : 'Shown in the home page directory')} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-brand-text hover:bg-white/10">{a.listed ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <p className="text-[11px] text-brand-muted">Owner: {a.ownerEmail ?? '—'}{a.phone ? ` · ${a.phone}` : ''}{a.pendingDomain ? ` · domain waiting for DNS: ${a.pendingDomain}` : ''}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-brand-text mb-3">Invoices</p>
          <InvoiceTable invoices={a.invoices} />
        </div>
        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-brand-text mb-2">Accounts</p>
          <ul className="text-sm divide-y divide-white/5 mb-4">{a.admins.map((u) => <li key={u.id} className="py-2 flex justify-between"><span className="text-brand-text">{u.username} <span className="text-brand-muted text-xs">{u.email}</span></span><span className="text-[11px] uppercase text-brand-muted">{u.role}</span></li>)}</ul>
          <p className="text-sm font-semibold text-brand-text mb-1">History</p>
          <EventList events={a.events} />
        </div>
      </div>

      <div className={`${card} p-5 border-red-500/20`}>
        <p className="text-sm font-semibold text-red-300">Delete this agency</p>
        <p className="text-xs text-brand-muted mt-1 mb-3">Removes the agency and all its cars, bookings, customers and invoices for good. Prefer “Closed” to keep the history. Type <b className="font-mono text-brand-text">{a.slug}</b> to confirm.</p>
        <div className="flex gap-2">
          <input className={`${inputCls} max-w-xs`} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder={a.slug} />
          <button disabled={busy || confirmDelete !== a.slug} onClick={() => act(async () => { await platformJSON(`/console/agencies/${a.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: confirmDelete }) }); navigate('/console/agencies'); }, 'Agency deleted')} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40">Delete</button>
        </div>
      </div>
    </div>
  );
}

const PROVIDER: Record<string, string> = { konnect: 'Konnect', flouci: 'Flouci', manual: 'Test', transfer: 'Transfer', cash: 'Cash' };

function InvoiceTable({ invoices, withAgency = false }: { invoices: Invoice[]; withAgency?: boolean }) {
  if (!invoices.length) return <p className="text-sm text-brand-muted">No invoices.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-wider text-brand-muted border-b border-white/5">
          <th className="py-2 pr-3 font-medium">Invoice</th>{withAgency && <th className="py-2 pr-3 font-medium">Agency</th>}<th className="py-2 pr-3 font-medium">Plan</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Paid</th><th className="py-2 font-medium text-right">Amount</th>
        </tr></thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className="border-b border-white/5 last:border-0">
              <td className="py-2 pr-3 font-mono text-xs text-brand-text">{i.number ?? `#${i.id}`}</td>
              {withAgency && <td className="py-2 pr-3">{i.agency && <Link to={`/console/agencies/${i.agency.id}`} className="text-brand-text hover:text-brand-red">{i.agency.name}</Link>}</td>}
              <td className="py-2 pr-3 text-brand-muted">{i.plan} · {i.cycle}</td>
              <td className="py-2 pr-3"><span className={`text-xs ${i.status === 'paid' ? 'text-emerald-300' : i.status === 'pending' ? 'text-orange-300' : 'text-brand-muted'}`}>{i.status}</span></td>
              <td className="py-2 pr-3 text-xs text-brand-muted">{i.paidAt ? `${frDate(i.paidAt)} · ${PROVIDER[i.provider] ?? i.provider}` : '—'}</td>
              <td className="py-2 text-right text-brand-text">{dt(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Invoices() {
  const [rows, setRows] = useState<Invoice[] | null>(null);
  const [status, setStatus] = useState('paid');
  useEffect(() => { platformJSON<Invoice[]>(`/console/invoices?status=${status}`).then(setRows).catch(() => {}); }, [status]);
  const total = rows?.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0) ?? 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand-text">Invoices</h1>
        <select className={`${inputCls} w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="">All</option>
        </select>
      </div>
      {status === 'paid' && rows && <p className="text-sm text-brand-muted">{rows.length} invoices · {dt(total)}</p>}
      <div className={`${card} p-5`}>{rows ? <InvoiceTable invoices={rows} withAgency /> : <p className="text-sm text-brand-muted">Loading…</p>}</div>
    </div>
  );
}

export function Events() {
  const [rows, setRows] = useState<Event[] | null>(null);
  useEffect(() => { platformJSON<Event[]>('/console/events').then(setRows).catch(() => {}); }, []);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-brand-text">Activity</h1>
      <div className={`${card} p-5`}>{rows ? <EventList events={rows} /> : <p className="text-sm text-brand-muted">Loading…</p>}</div>
    </div>
  );
}

export function Admins() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<{ id: number; email: string; name: string; createdAt: string }[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const load = () => platformJSON<typeof rows>('/console/admins').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await platformJSON('/console/admins', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', password: '' });
      showToast('Console account added', 'success');
      load();
    } catch (err) { showToast((err as Error).message, 'error'); }
  }
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-brand-text">Console team</h1>
      <div className={`${card} p-5`}>
        <ul className="divide-y divide-white/5">{rows.map((r) => <li key={r.id} className="py-2.5 flex justify-between text-sm"><span className="text-brand-text">{r.name} <span className="text-brand-muted">{r.email}</span></span><span className="text-xs text-brand-muted">{frDate(r.createdAt)}</span></li>)}</ul>
      </div>
      <form onSubmit={add} className={`${card} p-5 space-y-3`}>
        <p className="text-sm font-semibold text-brand-text">Add someone to the console</p>
        <p className="text-xs text-brand-muted">They will see and manage every agency. Use a long password.</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputCls} type="password" placeholder="Password (10+)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} />
        </div>
        <button className="px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-semibold">Add</button>
      </form>
    </div>
  );
}
