import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useI18n, Lang, TKey } from '../../i18n';
import LanguageSwitcher from '../../components/public/LanguageSwitcher';
import SignaturePad from '../../components/admin/SignaturePad';
import type { BookingExtra } from '../../types';

interface SignView {
  reference: string;
  guestName: string;
  email: string;
  locale: Lang;
  company: string;
  car: { brand: string; model: string; image: string | null };
  startDate: string;
  endDate: string;
  pickupTime: string;
  returnTime: string;
  deliveryType: 'agency' | 'delivery';
  deliveryAddress: string | null;
  extras: BookingExtra[];
  total: number;
  deposit: number;
  kmPerDayIncluded: number;
  extraKmPrice: number;
  terms: string[];
  codeSent: boolean;
}

const API = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;
const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-4 py-3 text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50';

// Maps the server's reasons for refusing a link to translated messages
function linkError(status: number, message: string): TKey {
  if (status === 404) return 'sign.errors.invalid';
  if (/already signed/i.test(message)) return 'sign.errors.signed';
  if (/cancelled/i.test(message)) return 'sign.errors.revoked';
  if (/expired/i.test(message)) return 'sign.errors.expired';
  return 'sign.errors.unavailable';
}

export default function SignContract() {
  const { token = '' } = useParams();
  const { t, setLang, formatDate, money } = useI18n();
  const [view, setView] = useState<SignView | null>(null);
  const [fatal, setFatal] = useState<TKey | null>(null);
  const [codeState, setCodeState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ verificationCode: string; emailed: boolean } | null>(null);
  const langApplied = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api(`/sign/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setFatal(linkError(res.status, data.error ?? '')); return; }
        setView(data);
        setName(data.guestName);
        if (data.codeSent) setCodeState('sent');
        // Open in the language the customer booked in (they can still switch)
        if (!langApplied.current) { setLang(data.locale); langApplied.current = true; }
      } catch {
        setFatal('sign.errors.network');
      }
    })();
  }, [token, setLang]);

  async function sendCode() {
    setError('');
    setCodeState('sending');
    try {
      const res = await api(`/sign/${token}/code`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || t('sign.errors.network')); setCodeState(view?.codeSent ? 'sent' : 'idle'); return; }
      setCodeState('sent');
    } catch {
      setError(t('sign.errors.network'));
      setCodeState('idle');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) { setError(t('sign.errors.code')); return; }
    if (name.trim().length < 2) { setError(t('sign.errors.name')); return; }
    if (!signature) { setError(t('sign.errors.signature')); return; }
    if (!accepted) { setError(t('sign.errors.accept')); return; }
    setSubmitting(true);
    try {
      const res = await api(`/sign/${token}`, { method: 'POST', body: JSON.stringify({ code: code.trim(), signerName: name.trim(), signature, accept: true }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 410) { setFatal(linkError(410, data.error ?? '')); return; }
        setError(data.error === 'Wrong code' ? t('sign.errors.wrongCode') : data.error || t('sign.errors.network'));
        return;
      }
      setDone(data);
      window.scrollTo(0, 0);
    } catch {
      setError(t('sign.errors.network'));
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-brand-dark">
      <header className="max-w-2xl mx-auto px-5 pt-6 pb-2 flex items-center justify-between">
        <Link to="/" className="font-display font-extrabold text-2xl text-brand-text" dir="ltr">{view?.company || 'RentCar'}<span className="text-brand-red">.</span></Link>
        <LanguageSwitcher />
      </header>
      <main className="max-w-2xl mx-auto px-5 pb-16">{children}</main>
    </div>
  );

  if (fatal) {
    return shell(
      <div className="glass-card p-8 mt-10 text-center">
        <p className="text-brand-text">{t(fatal)}</p>
        <Link to="/" className="inline-block mt-6 text-sm text-brand-red">RentCar →</Link>
      </div>,
    );
  }
  if (!view) return shell(<div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>);

  if (done) {
    return shell(
      <div className="glass-card p-8 mt-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center text-3xl text-green-400">✓</div>
        <h1 className="font-display text-3xl font-bold text-brand-text mb-2">{t('sign.doneTitle')}</h1>
        <p className="text-brand-muted">{done.emailed ? t('sign.doneText', { email: view.email }) : t('sign.doneTextNoEmail')}</p>
        <div className="inline-block mt-6 px-6 py-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-brand-muted mb-1">{t('sign.verificationCode')}</p>
          <p className="font-mono text-2xl font-bold tracking-[0.15em] text-brand-text" dir="ltr">{done.verificationCode}</p>
        </div>
        <p className="mt-4"><Link to={`/verify?code=${done.verificationCode}`} className="text-sm text-brand-red hover:underline">{t('sign.verifyLink')} →</Link></p>
      </div>,
    );
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2 border-b border-white/5 text-sm"><span className="text-brand-muted">{label}</span><span className="text-brand-text text-end">{value}</span></div>
  );

  return shell(
    <form onSubmit={submit} className="space-y-5 mt-4">
      <div>
        <p className="section-tag">{view.reference}</p>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight text-brand-text">{t('sign.title')}</h1>
        <p className="text-brand-muted mt-2">{t('sign.hello', { name: view.guestName })}</p>
      </div>

      <section className="glass-card p-5">
        <div className="flex items-center gap-4 mb-3">
          {view.car.image && <img src={view.car.image} alt="" className="w-24 h-16 rounded-lg object-cover" />}
          <p className="font-display text-xl font-bold text-brand-text"><bdi>{view.car.brand} {view.car.model}</bdi></p>
        </div>
        {row(t('sign.pickup'), <>{formatDate(view.startDate)} · <span dir="ltr">{view.pickupTime}</span></>)}
        {row(t('sign.return'), <>{formatDate(view.endDate)} · <span dir="ltr">{view.returnTime}</span></>)}
        {row(t('sign.method'), view.deliveryType === 'delivery' ? t('sign.delivery', { address: view.deliveryAddress ?? '' }) : t('sign.agency'))}
        {view.extras.length > 0 && row(t('sign.extras'), view.extras.map((e) => e.name).join(', '))}
        {row(t('sign.km'), view.kmPerDayIncluded > 0 ? t('sign.kmIncluded', { km: view.kmPerDayIncluded, price: view.extraKmPrice }) : t('sign.kmUnlimited'))}
        {row(t('sign.deposit'), money(view.deposit))}
        <div className="flex justify-between items-baseline pt-3">
          <span className="font-semibold text-brand-text">{t('sign.total')}</span>
          <span className="font-display text-2xl font-bold text-brand-red">{money(view.total)}</span>
        </div>
        <a href={`${API}/sign/${token}/preview.pdf`} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 text-brand-text hover:bg-white/15">
          📄 {t('sign.fullContract')}
        </a>
      </section>

      <details className="glass-card p-5" open>
        <summary className="cursor-pointer font-semibold text-brand-text">{t('sign.terms')}</summary>
        <ol className="list-decimal ps-5 mt-3 space-y-2 text-sm text-brand-muted" lang="fr" dir="ltr">
          {view.terms.map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      </details>

      <section className="glass-card p-5 space-y-3">
        <h2 className="font-semibold text-brand-text">{t('sign.step1')}</h2>
        {codeState !== 'sent' ? (
          <>
            <p className="text-sm text-brand-muted">{t('sign.step1Hint', { email: view.email })}</p>
            <button type="button" onClick={sendCode} disabled={codeState === 'sending'} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-brand-text hover:bg-white/15 disabled:opacity-50">
              {codeState === 'sending' ? t('sign.sending') : t('sign.sendCode')}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-green-400">{t('sign.codeSent', { email: view.email })}</p>
            <label className="block text-xs text-brand-muted" htmlFor="code">{t('sign.code')}</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              dir="ltr"
              className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
            />
            <button type="button" onClick={sendCode} className="text-xs text-brand-muted hover:text-brand-text">{t('sign.resend')}</button>
          </>
        )}
      </section>

      <section className="glass-card p-5 space-y-3">
        <h2 className="font-semibold text-brand-text">{t('sign.step2')}</h2>
        <div>
          <label className="block text-xs text-brand-muted mb-1.5" htmlFor="name">{t('sign.fullName')}</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" className={inputClass} />
        </div>
        <div dir="ltr">
          <SignaturePad onChange={setSignature} placeholder={t('sign.signHere')} clearLabel={t('sign.clear')} />
        </div>
        <label className="flex items-start gap-2 text-sm text-brand-text cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 accent-brand-red" />
          {t('sign.accept')}
        </label>
      </section>

      {error && <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      <button type="submit" disabled={submitting || codeState !== 'sent'} className="w-full py-4 rounded-xl font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-40">
        {submitting ? t('sign.submitting') : t('sign.submit')}
      </button>
    </form>,
  );
}
