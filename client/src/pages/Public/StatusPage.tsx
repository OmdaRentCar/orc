import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import type { BookingStatusView } from '../../types';
import { api } from '../../services/api';
import { useI18n, TKey } from '../../i18n';

const STEPS: { key: TKey; reached: string[] }[] = [
  { key: 'status.steps.requested', reached: ['pending', 'approved', 'picked_up', 'completed'] },
  { key: 'status.steps.confirmed', reached: ['approved', 'picked_up', 'completed'] },
  { key: 'status.steps.pickedUp', reached: ['picked_up', 'completed'] },
  { key: 'status.steps.returned', reached: ['completed'] },
];

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-yellow-400',
  approved: 'text-green-400',
  picked_up: 'text-sky-400',
  completed: 'text-green-400',
  declined: 'text-red-400',
  cancelled: 'text-orange-400',
};

const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50 transition-colors';

export default function StatusPage() {
  const { t, formatDate, money } = useI18n();
  const [params] = useSearchParams();
  const [reference, setReference] = useState(params.get('ref') ?? '');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<BookingStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const query = new URLSearchParams({ reference: reference.trim(), phone: phone.trim() });
      const res = await api(`/bookings/status?${query}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 404 ? t('status.notFound') : data.error || t('booking.errors.network'));
        return;
      }
      setResult(data);
    } catch {
      setError(t('booking.errors.network'));
    } finally {
      setLoading(false);
    }
  }

  const stopped = result && (result.status === 'declined' || result.status === 'cancelled');

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 pt-32 pb-16">
        <p className="section-tag">{t('nav.myBooking')}</p>
        <h1 className="font-display text-5xl font-extrabold uppercase tracking-tight text-brand-text mb-3">{t('status.title')}</h1>

        {!result ? (
          <>
            <p className="text-sm text-brand-muted mb-8">{t('status.subtitle')}</p>
            <form onSubmit={lookup} className="glass-card p-6 space-y-4">
              <div>
                <label htmlFor="ref" className="block text-xs text-brand-muted mb-1.5">{t('status.reference')}</label>
                <input id="ref" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} placeholder="RC-XXXXXX" required maxLength={20} dir="ltr" className={`${inputClass} tracking-[0.15em] font-semibold`} />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs text-brand-muted mb-1.5">{t('status.phone')}</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 12 345 678" required autoComplete="tel" dir="ltr" className={inputClass} />
              </div>
              {error && <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50 transition-colors">
                {loading ? t('status.looking') : t('status.lookup')}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-6 mt-6">
            <div className="glass-card p-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-brand-muted">{t('status.reference')}</p>
                  <p className="font-display text-2xl font-bold tracking-[0.1em] text-brand-text" dir="ltr">{result.reference}</p>
                </div>
                <p className={`text-sm font-semibold text-end ${STATUS_COLOR[result.status]}`}>{t(`status.labels.${result.status}`)}</p>
              </div>
              <p className="text-sm text-brand-muted">{t(`status.descriptions.${result.status}`)}</p>

              {!stopped && (
                <ol className="grid grid-cols-4 gap-2 mt-6">
                  {STEPS.map((step) => {
                    const done = step.reached.includes(result.status);
                    return (
                      <li key={step.key} className="text-center">
                        <div className={`h-1.5 rounded-full mb-2 ${done ? 'bg-brand-red' : 'bg-white/10'}`} />
                        <span className={`text-[11px] ${done ? 'text-brand-text' : 'text-brand-muted/60'}`}>{t(step.key)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="glass-card p-6">
              <div className="flex gap-4 items-center mb-5">
                {result.car.image && <img src={result.car.image} alt="" className="w-24 h-16 rounded-lg object-cover" />}
                <div>
                  <p className="text-xs text-brand-muted">{t('status.car')}</p>
                  <p className="font-display text-xl font-bold text-brand-text"><bdi>{result.car.brand} {result.car.model}</bdi></p>
                </div>
              </div>
              <dl className="text-sm">
                <div className="spec-row"><dt className="spec-name">{t('status.pickup')}</dt><dd className="text-brand-text">{formatDate(result.startDate)} · <span dir="ltr">{result.pickupTime}</span></dd></div>
                <div className="spec-row"><dt className="spec-name">{t('status.return')}</dt><dd className="text-brand-text">{formatDate(result.endDate)} · <span dir="ltr">{result.returnTime}</span></dd></div>
                <div className="spec-row">
                  <dt className="spec-name">{t('status.method')}</dt>
                  <dd className="text-brand-text text-end">{result.deliveryType === 'delivery' ? t('status.deliveryTo', { address: result.deliveryAddress ?? '' }) : t('status.agency')}</dd>
                </div>
                {result.extras.length > 0 && (
                  <div className="spec-row"><dt className="spec-name">{t('status.extras')}</dt><dd className="text-brand-text text-end">{result.extras.map((e) => e.name).join(', ')}</dd></div>
                )}
              </dl>

              <div className="mt-5 space-y-1.5 text-sm">
                <div className="flex justify-between text-brand-muted"><span>{t('status.subtotal')}</span><span>{money(result.subtotal)}</span></div>
                {result.discount > 0 && <div className="flex justify-between text-green-400"><span>{t('status.discount')}</span><span>−{money(result.discount)}</span></div>}
                {result.extrasTotal > 0 && <div className="flex justify-between text-brand-muted"><span>{t('status.extras')}</span><span>{money(result.extrasTotal)}</span></div>}
                {result.deliveryFee > 0 && <div className="flex justify-between text-brand-muted"><span>{t('status.deliveryFee')}</span><span>{money(result.deliveryFee)}</span></div>}
                <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
                  <span className="font-semibold text-brand-text">{t('status.total')}</span>
                  <span className="font-display text-2xl font-bold text-brand-red">{money(result.total)}</span>
                </div>
                {result.deposit > 0 && <div className="flex justify-between text-brand-muted"><span>{t('status.deposit')}</span><span>{money(result.deposit)}</span></div>}
                <div className="flex justify-between text-brand-muted">
                  <span>{t('status.payment')}</span>
                  <span>
                    {t(`status.paymentStatus.${result.paymentStatus}`)}
                    {result.amountPaid > 0 && ` · ${t('status.amountPaid', { amount: result.amountPaid })}`}
                  </span>
                </div>
              </div>
            </div>

            <button onClick={() => { setResult(null); setPhone(''); }} className="text-xs uppercase tracking-[0.2em] text-brand-muted hover:text-brand-red">
              {t('status.another')}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
