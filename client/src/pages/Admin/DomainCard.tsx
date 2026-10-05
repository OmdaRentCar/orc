import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import { useAgency } from '../../context/AgencyContext';
import { useToast } from '../../components/ui/Toast';

interface DomainState {
  customDomain: string | null;
  verifiedAt: string | null;
  pending: { domain: string; records: { type: string; name: string; value: string }[] } | null;
  target: string;
  platformIp: string | null;
}

// The agency's own domain (Business plan): DNS records to add, then a check
export default function DomainCard() {
  const { agency, refresh } = useAgency();
  const { showToast } = useToast();
  const [state, setState] = useState<DomainState | null>(null);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const allowed = agency.subscription.features.customDomain;

  useEffect(() => { apiJSON<DomainState>('/agency/domain').then(setState).catch(() => {}); }, []);

  async function run(fn: () => Promise<DomainState | (DomainState & { verified: boolean; message?: string })>) {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
      if ('verified' in next) {
        if (next.verified) { showToast('Domain verified — your site now answers on it', 'success'); await refresh(); }
        else showToast(next.message ?? 'Not verified yet', 'error');
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const add = (e: FormEvent) => { e.preventDefault(); run(() => apiJSON('/agency/domain', { method: 'POST', body: JSON.stringify({ domain }) })); };
  const field = 'bg-black/30 border border-white/10 rounded-lg px-2 py-1 font-mono text-xs text-brand-text select-all break-all';

  return (
    <div className="bg-brand-surface border border-white/5 rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-brand-text">Your own domain</p>
        <p className="text-xs text-brand-muted mt-1">Use an address like <span className="font-mono">location-sfax.tn</span> instead of <span className="font-mono">{agency.siteUrl.replace(/^https?:\/\//, '')}</span>.</p>
      </div>

      {!allowed ? (
        <p className="text-sm text-brand-muted">Included in the Business plan. <Link to="/admin/billing" className="text-brand-red hover:underline">See plans</Link></p>
      ) : !state ? null : state.customDomain ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-brand-text"><span className="text-emerald-300">✓</span> <a href={`https://${state.customDomain}`} target="_blank" rel="noreferrer" className="font-mono hover:underline">{state.customDomain}</a></p>
          <button disabled={busy} onClick={() => run(() => apiJSON('/agency/domain', { method: 'DELETE' }))} className="text-xs text-brand-muted hover:text-red-400">Remove</button>
        </div>
      ) : state.pending ? (
        <div className="space-y-3">
          <p className="text-sm text-brand-text">Add these records at your domain registrar for <b className="font-mono">{state.pending.domain}</b>:</p>
          <div className="space-y-2">
            {state.pending.records.map((r) => (
              <div key={r.type} className="grid grid-cols-[60px_1fr] gap-2 items-start text-xs">
                <span className="text-brand-muted font-semibold pt-1">{r.type}</span>
                <div className="space-y-1"><div className={field}>{r.name}</div><div className={field}>{r.value}</div></div>
              </div>
            ))}
          </div>
          <p className="text-xs text-brand-muted">For a domain without “www”, use an A record to {state.platformIp ?? 'the address given by support'} instead of the CNAME. Changes can take a few hours to spread.</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => run(() => apiJSON('/agency/domain/verify', { method: 'POST' }))} className="px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Checking…' : 'Check now'}</button>
            <button disabled={busy} onClick={() => run(() => apiJSON('/agency/domain', { method: 'DELETE' }))} className="px-4 py-2 rounded-xl bg-white/5 text-brand-text text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <form onSubmit={add} className="flex gap-2">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.my-agency.tn" required dir="ltr"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50" />
          <button disabled={busy} className="px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-semibold disabled:opacity-50">Connect</button>
        </form>
      )}
    </div>
  );
}
