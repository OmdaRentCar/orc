import { FormEvent, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { consoleToken, platformJSON } from '../api';
import { Logo, usePlatformInfo } from '../Shell';
import { ToastProvider } from '../../components/ui/Toast';

export const card = 'bg-brand-surface border border-white/5 rounded-2xl';
export const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50';

export const STATUS: Record<string, { label: string; cls: string }> = {
  trial: { label: 'Trial', cls: 'bg-sky-500/10 text-sky-300' },
  active: { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-300' },
  past_due: { label: 'Past due', cls: 'bg-orange-500/10 text-orange-300' },
  suspended: { label: 'Suspended', cls: 'bg-red-500/10 text-red-300' },
  cancelled: { label: 'Closed', cls: 'bg-white/5 text-brand-muted' },
};
export const StatusPill = ({ status }: { status: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS[status]?.cls ?? 'bg-white/5'}`}>{STATUS[status]?.label ?? status}</span>
);

export function ConsoleLogin() {
  const navigate = useNavigate();
  const p = usePlatformInfo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = `Console · ${p?.name ?? 'RentCar'}`; }, [p]);

  if (consoleToken.get()) return <Navigate to="/console" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await platformJSON<{ token: string }>('/console/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      consoleToken.set(token);
      navigate('/console', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm p-8 space-y-4`}>
        <div className="text-center mb-2">
          <Logo name={p?.name} />
          <p className="text-sm text-brand-muted mt-2">Platform console</p>
        </div>
        {error && <p className="p-3 rounded-xl bg-red-500/10 text-red-300 text-sm text-center">{error}</p>}
        <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <input className={inputCls} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button disabled={busy} className="w-full py-2.5 rounded-xl bg-brand-red text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

const NAV = [
  { to: '/console', label: 'Overview', icon: '📊', end: true },
  { to: '/console/agencies', label: 'Agencies', icon: '🏢', end: false },
  { to: '/console/invoices', label: 'Invoices', icon: '🧾', end: false },
  { to: '/console/events', label: 'Activity', icon: '🕓', end: false },
  { to: '/console/admins', label: 'Console team', icon: '🔑', end: false },
];

// Frame of the console: everyone running the platform, across all agencies
export default function ConsoleLayout() {
  const navigate = useNavigate();
  const p = usePlatformInfo();
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);
  useEffect(() => { document.title = `Console · ${p?.name ?? 'RentCar'}`; }, [p]);
  useEffect(() => { if (consoleToken.get()) platformJSON<{ email: string; name: string }>('/console/me').then(setMe).catch(() => {}); }, []);

  if (!consoleToken.get()) return <Navigate to="/console/login" replace />;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-brand-dark">
        <aside className="w-60 flex-shrink-0 bg-brand-surface border-r border-white/5 hidden md:flex flex-col">
          <div className="p-6 border-b border-white/5">
            <Logo name={p?.name} />
            <p className="text-[11px] uppercase tracking-wider text-brand-muted mt-1">Console</p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${isActive ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' : 'text-brand-muted hover:text-brand-text hover:bg-white/5'}`}>
                <span>{n.icon}</span>{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-white/5">
            <p className="text-xs text-brand-muted px-4 mb-2 truncate">{me?.email}</p>
            <button onClick={() => { consoleToken.clear(); navigate('/console/login', { replace: true }); }} className="w-full text-left px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-red-400 hover:bg-red-500/5">🚪 Logout</button>
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="md:hidden flex gap-2 overflow-x-auto p-3 border-b border-white/5">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${isActive ? 'bg-brand-red/10 text-brand-red' : 'text-brand-muted'}`}>{n.label}</NavLink>)}
          </div>
          <main className="p-6 max-w-7xl"><Outlet /></main>
        </div>
      </div>
    </ToastProvider>
  );
}
