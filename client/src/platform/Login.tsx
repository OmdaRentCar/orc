import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell, { usePlatformInfo } from './Shell';
import { consoleToken, platformJSON } from './api';
import { useI18n, TKey } from '../i18n';

interface Found {
  name: string;
  slug: string;
  logoUrl: string | null;
  color: string;
  role: string;
  status: string;
  siteUrl: string;
  loginUrl: string;
}

const input = 'w-full bg-brand-surface border border-white/10 px-4 py-3 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/60';
const label = 'block text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-muted mb-2';

// One login for everybody: email (or username) + password, and we open the right dashboard.
// Several agencies (or the console) under the same login: the person picks one.
export default function Login() {
  const { t } = useI18n();
  const p = usePlatformInfo();
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ agencies: Found[]; console: boolean } | null>(null);
  useEffect(() => { document.title = `${t('signin.title')} · ${p?.name ?? 'RentCar'}`; }, [p, t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await platformJSON<{ agencies: Found[]; console: { token: string } | null }>('/login', { method: 'POST', body: JSON.stringify({ login, password }) });
      if (res.console) consoleToken.set(res.console.token);
      // Only one place to go: go straight there
      if (res.agencies.length === 1 && !res.console) { window.location.href = res.agencies[0].loginUrl; return; }
      if (res.agencies.length === 0 && res.console) { navigate('/console'); return; }
      setFound({ agencies: res.agencies, console: !!res.console });
    } catch (err) {
      setError((err as Error).message === 'Wrong email/username or password' ? t('signin.wrong') : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const statusKey = (s: string) => (['trial', 'active', 'past_due', 'suspended'].includes(s) ? `signin.${s}` : 'signin.active') as TKey;

  return (
    <Shell>
      <div className="max-w-md mx-auto px-6 py-16">
        {!found ? (
          <>
            <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold uppercase tracking-tight text-center leading-none">{t('signin.title')}</h1>
            <p className="text-center text-brand-muted mt-3 mb-8">{t('signin.subtitle')}</p>
            <form onSubmit={submit} className="border border-white/[0.08] bg-brand-dark/80 p-6 sm:p-8 space-y-5">
              {error && <p className="p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</p>}
              <div>
                <label htmlFor="login-id" className={label}>{t('signin.login')}</label>
                <input id="login-id" className={input} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus required dir="ltr" />
              </div>
              <div>
                <label htmlFor="login-password" className={label}>{t('signin.password')}</label>
                <input id="login-password" className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required dir="ltr" />
              </div>
              <button disabled={busy} className="w-full py-3.5 bg-brand-red text-white text-[11px] font-semibold tracking-[0.2em] uppercase disabled:opacity-50 hover:brightness-110">{busy ? t('signin.busy') : t('signin.submit')}</button>
            </form>
            <p className="text-center text-sm text-brand-muted mt-6">{t('signin.noAgency')} <a href="/signup" className="text-brand-red font-semibold hover:underline">{t('signin.createFree')}</a></p>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight text-center">{t('signin.chooseTitle')}</h1>
            <p className="text-center text-brand-muted mt-2 mb-8">{t('signin.chooseText')}</p>
            <div className="space-y-3">
              {found.agencies.map((a) => (
                <a key={a.slug} href={a.loginUrl} className="flex items-center gap-4 border border-white/[0.08] bg-brand-dark/80 p-4 hover:border-brand-red/40 transition-colors">
                  <span className="w-11 h-11 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: a.color }}>
                    {a.logoUrl ? <img src={a.logoUrl} alt="" className="w-full h-full object-contain bg-white" /> : <span className="text-white font-bold">{a.name[0]}</span>}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{a.name}</span>
                    <span className="block text-xs text-brand-muted truncate">{t(a.role === 'owner' ? 'signin.owner' : 'signin.staff')} · {t(statusKey(a.status))} · <span dir="ltr">{a.siteUrl.replace(/^https?:\/\//, '')}</span></span>
                  </span>
                  <span className="text-brand-red text-xs font-semibold uppercase tracking-[0.15em]">{t('signin.open')}</span>
                </a>
              ))}
              {found.console && (
                <Link to="/console" className="flex items-center gap-4 border border-brand-red/30 bg-brand-red/[0.06] p-4 hover:border-brand-red/60">
                  <span className="w-11 h-11 bg-white/10 flex items-center justify-center text-xl">🛠️</span>
                  <span className="flex-1"><span className="block font-semibold">{t('signin.console')}</span><span className="block text-xs text-brand-muted">{t('signin.consoleText')}</span></span>
                  <span className="text-brand-red text-xs font-semibold uppercase tracking-[0.15em]">{t('signin.open')}</span>
                </Link>
              )}
            </div>
            <div className="flex justify-between mt-6 text-sm">
              <button onClick={() => setFound(null)} className="text-brand-muted hover:text-brand-text">{t('signin.other')}</button>
              <a href={`/signup?email=${encodeURIComponent(login.includes('@') ? login : '')}`} className="text-brand-red hover:underline">{t('signin.another')}</a>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
