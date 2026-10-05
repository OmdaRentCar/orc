import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Shell, { usePlatformInfo } from './Shell';
import { agencyAddress, platformJSON, Plan } from './api';
import Turnstile, { TURNSTILE_SITE_KEY } from '../components/public/Turnstile';
import { useI18n, TKey } from '../i18n';

const input = 'w-full bg-brand-surface border border-white/10 px-4 py-3 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/60 transition-colors';
const label = 'block text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-muted mb-2';

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
}

interface SlugCheck { slug: string; available: boolean; problem: string | null; suggestion: string | null }
// The server answers in English; shown in the visitor's language
const PROBLEMS: Record<string, TKey> = {
  'Use 3 to 40 lowercase letters, digits or dashes': 'join.problemFormat',
  'This address is reserved': 'join.problemReserved',
  'This address is already taken': 'join.problemTaken',
  'Choose an address': 'join.problemEmpty',
};

// Sign-up in three short steps: the agency, the owner's account, the plan. Ends in the new dashboard.
export default function Signup() {
  const { t, lang } = useI18n();
  const p = usePlatformInfo();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [agencyName, setAgencyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [check, setCheck] = useState<SlugCheck | null>(null);
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState<Plan['id']>((['starter', 'pro', 'business'].includes(params.get('plan') ?? '') ? params.get('plan') : 'pro') as Plan['id']);
  const [accept, setAccept] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ siteUrl: string; loginUrl: string } | null>(null);
  const seq = useRef(0);
  const days = p?.trialDays ?? 14;

  useEffect(() => { document.title = `${t('join.title')} · ${p?.name ?? 'RentCar'}`; }, [p, t]);
  useEffect(() => { if (!slugTouched) setSlug(slugify(agencyName)); }, [agencyName, slugTouched]);

  // Live availability of the address, debounced
  useEffect(() => {
    if (!slug) { setCheck(null); return; }
    const n = ++seq.current;
    const timer = setTimeout(() => {
      platformJSON<SlugCheck>(`/slug?slug=${encodeURIComponent(slug)}`).then((c) => { if (n === seq.current) setCheck(c); }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [slug]);

  const step1Ok = agencyName.trim().length >= 2 && check?.available && check.slug === slug && city.trim().length >= 2 && phone.replace(/\D/g, '').length >= 8;
  const step2Ok = /^[a-zA-Z0-9_.-]{3,60}$/.test(username) && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step < 3) { setStep(step + 1); return; }
    setError('');
    setBusy(true);
    try {
      const res = await platformJSON<{ siteUrl: string; loginUrl: string }>('/signup', {
        method: 'POST',
        headers: captcha ? { 'X-Captcha-Token': captcha } : {},
        body: JSON.stringify({ agencyName, slug, city, phone, username, email, password, plan, acceptTerms: accept }),
      });
      setDone(res);
      setTimeout(() => { window.location.href = res.loginUrl; }, 2500);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg.includes('already taken') ? t('join.takenNow') : msg);
      if (msg.includes('already taken')) setStep(1);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <div className="w-16 h-16 mx-auto border border-emerald-400/40 text-emerald-300 flex items-center justify-center text-3xl mb-6">✓</div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">{t('join.doneTitle')}</h1>
          <p className="text-brand-muted mt-3">{t('join.doneSite')} <a href={done.siteUrl} className="text-brand-red font-mono" dir="ltr">{done.siteUrl.replace(/^https?:\/\//, '')}</a></p>
          <p className="text-brand-muted text-sm mt-6">{t('join.doneOpening')}</p>
          <a href={done.loginUrl} className="inline-block mt-4 px-7 py-3.5 bg-brand-red text-white text-[11px] font-semibold tracking-[0.2em] uppercase">{t('join.doneOpen')}</a>
        </div>
      </Shell>
    );
  }

  const STEPS: TKey[] = ['join.step1', 'join.step2', 'join.step3'];
  return (
    <Shell>
      <div className="max-w-2xl mx-auto px-6 py-14">
        <p className="section-tag justify-center">{t('platform.heroTag')}</p>
        <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold uppercase tracking-tight text-center leading-none">{t('join.title')}</h1>
        <p className="text-center text-brand-muted mt-3">{t('join.subtitle', { days })}</p>

        <ol className="flex items-center justify-center gap-2 sm:gap-4 my-10 text-[11px] uppercase tracking-[0.15em]">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`w-7 h-7 flex items-center justify-center font-bold ${step > i + 1 ? 'bg-emerald-500/20 text-emerald-300' : step === i + 1 ? 'bg-brand-red text-white' : 'border border-white/10 text-brand-muted'}`}>{step > i + 1 ? '✓' : i + 1}</span>
              <span className={step === i + 1 ? 'text-brand-text' : 'text-brand-muted'}>{t(s)}</span>
              {i < 2 && <span className="w-6 sm:w-10 h-px bg-white/10" />}
            </li>
          ))}
        </ol>

        <form onSubmit={submit} className="border border-white/[0.08] bg-brand-dark/80 p-6 sm:p-8 space-y-5">
          {error && <p className="p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</p>}

          {step === 1 && (
            <>
              <div>
                <label className={label} htmlFor="j-name">{t('join.agencyName')}</label>
                <input id="j-name" className={input} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Sahel Cars" autoFocus maxLength={80} required />
              </div>
              <div>
                <label className={label} htmlFor="j-slug">{t('join.address')}</label>
                <div className="flex items-stretch border border-white/10 bg-brand-surface focus-within:border-brand-red/60" dir="ltr">
                  <input id="j-slug" className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm text-brand-text focus:outline-none font-mono" value={slug}
                    onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} placeholder="sahel-cars" required />
                  <span className="px-3 flex items-center text-xs text-brand-muted bg-black/30 font-mono">.{agencyAddress('', p).replace(/^votre-agence\./, '')}</span>
                </div>
                <p className={`text-xs mt-2 ${!check || check.slug !== slug ? 'text-brand-muted' : check.available ? 'text-emerald-300' : 'text-orange-300'}`}>
                  {!slug ? t('join.addressHint') : !check || check.slug !== slug ? t('join.checking')
                    : check.available ? t('join.available', { address: agencyAddress(slug, p) })
                      : <>{PROBLEMS[check.problem ?? ''] ? t(PROBLEMS[check.problem ?? '']) : check.problem}{check.suggestion && <> · <button type="button" className="underline" onClick={() => { setSlugTouched(true); setSlug(check.suggestion!); }}>{t('join.suggest', { suggestion: check.suggestion })}</button></>}</>}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className={label} htmlFor="j-city">{t('join.city')}</label><input id="j-city" className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sousse" required maxLength={60} /></div>
                <div><label className={label} htmlFor="j-phone">{t('join.phone')}</label><input id="j-phone" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 20 123 456" required dir="ltr" maxLength={30} /></div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div><label className={label} htmlFor="j-email">{t('join.email')}</label><input id="j-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.tn" required autoFocus dir="ltr" /></div>
              <div><label className={label} htmlFor="j-user">{t('join.username')}</label><input id="j-user" className={input} value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="admin" required dir="ltr" maxLength={60} /></div>
              <div>
                <label className={label} htmlFor="j-pass">{t('join.password')}</label>
                <div className="relative">
                  <input id="j-pass" type={showPassword ? 'text' : 'password'} className={input} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} dir="ltr" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-brand-muted">{showPassword ? t('join.hide') : t('join.show')}</button>
                </div>
              </div>
            </>
          )}

          {step === 3 && p && (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                {p.plans.map((pl) => (
                  <button type="button" key={pl.id} onClick={() => setPlan(pl.id)}
                    className={`text-start border p-4 transition-colors ${plan === pl.id ? 'border-brand-red bg-brand-red/10' : 'border-white/10 hover:border-white/25'}`}>
                    <p className="font-display text-lg font-bold uppercase tracking-wide">{pl.name}</p>
                    <p className="text-sm text-brand-muted mt-1" dir="ltr"><span className="font-display text-2xl font-bold text-brand-text">{pl.monthly}</span> {t('join.perMonth')}</p>
                    <p className="text-xs text-brand-muted mt-2">{pl.maxCars ? t('join.cars', { count: pl.maxCars }) : t('join.unlimited')}{pl.id !== 'starter' ? ` · ${t('join.eSign')}` : ''}</p>
                  </button>
                ))}
              </div>
              <p className="text-sm text-brand-muted">{t('join.trialNote', { days })}</p>
              <label className="flex items-start gap-3 text-sm text-brand-muted cursor-pointer">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand-red" required />
                <span>{t('join.terms')}</span>
              </label>
              {TURNSTILE_SITE_KEY && <Turnstile onToken={setCaptcha} lang={lang} />}
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            {step > 1
              ? <button type="button" onClick={() => setStep(step - 1)} className="text-sm text-brand-muted hover:text-brand-text">{t('join.back')}</button>
              : <a href="/" className="text-sm text-brand-muted hover:text-brand-text">{t('join.cancel')}</a>}
            <button
              disabled={busy || (step === 1 && !step1Ok) || (step === 2 && !step2Ok) || (step === 3 && (!accept || (!!TURNSTILE_SITE_KEY && !captcha)))}
              className="px-7 py-3.5 bg-brand-red text-white text-[11px] font-semibold tracking-[0.2em] uppercase disabled:opacity-40 hover:brightness-110"
            >
              {step < 3 ? t('join.next') : busy ? t('join.creating') : t('join.create')}
            </button>
          </div>
        </form>
        <p className="text-center text-sm text-brand-muted mt-6">{t('join.haveAccount')} <a href="/login" className="text-brand-red hover:underline">{t('platform.login')}</a></p>
      </div>
    </Shell>
  );
}
