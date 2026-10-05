import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgency } from '../../context/AgencyContext';
import { useAuth } from '../../context/AuthContext';
import { apiJSON } from '../../services/api';
import { loadSettings } from '../../services/settings';

// First steps for a new agency, until they are all done (or hidden)
export default function Onboarding() {
  const { agency } = useAgency();
  const { isOwner } = useAuth();
  const key = `onboarding-hidden:${agency.slug}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const [cars, setCars] = useState<number | null>(null);
  const [contact, setContact] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hidden || !isOwner) return;
    apiJSON<unknown[]>('/cars').then((c) => setCars(c.length)).catch(() => setCars(0));
    loadSettings().then((s) => setContact(!!s.contactPhone && !!s.whatsappNumber)).catch(() => {});
  }, [hidden, isOwner]);

  if (hidden || !isOwner || cars === null) return null;
  const steps = [
    { done: !!agency.logoUrl, label: 'Add your logo and colour', to: '/admin/settings' },
    { done: contact, label: 'Check your phone, WhatsApp and prices', to: '/admin/settings?tab=business' },
    { done: cars > 0, label: 'Add your first car', to: '/admin/cars' },
    { done: cars >= 3, label: 'Add at least 3 cars', to: '/admin/cars' },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  function hide() {
    try { localStorage.setItem(key, '1'); } catch { /* the card simply comes back next time */ }
    setHidden(true);
  }

  return (
    <div className="bg-brand-surface border border-brand-red/20 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-brand-text">Get your agency ready · {done}/{steps.length}</p>
          <p className="text-xs text-brand-muted mt-1">A few minutes, and your booking site is ready to share with customers.</p>
        </div>
        <button onClick={hide} className="text-xs text-brand-muted hover:text-brand-text">Hide</button>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 mb-4 overflow-hidden"><div className="h-full bg-brand-red rounded-full transition-all" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <div className="grid sm:grid-cols-2 gap-2">
        {steps.map((s) => (
          <Link key={s.label} to={s.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${s.done ? 'text-brand-muted line-through' : 'text-brand-text bg-white/[0.03] hover:bg-white/[0.06]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${s.done ? 'bg-emerald-500/20 text-emerald-300' : 'border border-white/20'}`}>{s.done ? '✓' : ''}</span>
            {s.label}
          </Link>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-brand-muted">Your site:</span>
        <a href={agency.siteUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-red font-mono" dir="ltr">{agency.siteUrl.replace(/^https?:\/\//, '')}</a>
        <button onClick={() => navigator.clipboard?.writeText(agency.siteUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className="text-xs px-2 py-1 rounded-md bg-white/5 text-brand-text hover:bg-white/10">
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
