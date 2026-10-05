import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import { useAgency } from '../../context/AgencyContext';

// Stand-in for the gateway's payment page while no real gateway is configured (development, demo)
export default function TestPayment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAgency();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish(outcome: 'paid' | 'failed') {
    setBusy(true);
    try {
      await apiJSON(`/billing/invoices/${id}/test-pay`, { method: 'POST', body: JSON.stringify({ outcome }) });
      await refresh();
      navigate(`/admin/billing?invoice=${id}${outcome === 'failed' ? '&failed=1' : ''}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-brand-surface border border-white/10 rounded-2xl p-8 text-center">
      <p className="inline-block px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-300 text-[11px] font-semibold uppercase tracking-wider mb-4">Test mode</p>
      <h1 className="text-xl font-bold text-brand-text mb-2">Simulated payment</h1>
      <p className="text-sm text-brand-muted mb-6">
        No payment gateway is configured, so no real money is involved. In production this page is replaced by the Konnect or Flouci secure payment page.
      </p>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => finish('failed')} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-brand-text hover:bg-white/10 disabled:opacity-50">Simulate a failure</button>
        <button disabled={busy} onClick={() => finish('paid')} className="flex-1 py-2.5 rounded-xl bg-brand-red text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">Pay (test)</button>
      </div>
    </div>
  );
}
