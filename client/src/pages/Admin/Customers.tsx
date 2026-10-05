import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import type { Customer } from '../../types';
import { money, normalizePhone, whatsappUrl } from '../../utils/format';

const PAGE_SIZE = 20;

export default function Customers() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [page, setPage] = useState(1);
  const [blocking, setBlocking] = useState<{ phone: string; name: string } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setCustomers(await apiJSON<Customer[]>('/customers'));
    } catch {
      showToast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qPhone = normalizePhone(q);
    return customers
      .filter((c) => !onlyBlocked || c.blocked)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || (qPhone.length >= 4 && c.normalizedPhone.includes(qPhone)))
      .sort((a, b) => b.totalSpent - a.totalSpent || b.bookings - a.bookings);
  }, [customers, search, onlyBlocked]);

  useEffect(() => { setPage(1); }, [search, onlyBlocked]);

  async function block(e: FormEvent) {
    e.preventDefault();
    if (!blocking) return;
    try {
      await apiJSON('/customers/block', { method: 'POST', body: JSON.stringify({ phone: blocking.phone, name: blocking.name, reason }) });
      showToast(`${blocking.name} blocked from online booking`, 'success');
      setBlocking(null);
      setReason('');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function unblock(c: Customer) {
    try {
      await apiJSON(`/customers/block/${c.normalizedPhone}`, { method: 'DELETE' });
      showToast(`${c.name} unblocked`, 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  const sliced = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const repeat = customers.filter((c) => c.bookings > 1).length;

  if (loading) return <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Customers</h1>
          <p className="text-sm text-brand-muted mt-1">{customers.length} customers · {repeat} repeat · {customers.filter((c) => c.blocked).length} blocked</p>
        </div>
        <button onClick={() => setBlocking({ phone: '', name: '' })} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 text-brand-text hover:bg-white/10">
          Block a phone number
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email..." aria-label="Search customers" className="flex-1 max-w-sm bg-brand-surface border border-white/10 rounded-xl px-4 py-2 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50" />
        <label className="flex items-center gap-2 text-sm text-brand-muted cursor-pointer">
          <input type="checkbox" checked={onlyBlocked} onChange={(e) => setOnlyBlocked(e.target.checked)} className="accent-brand-red" /> Blocked only
        </label>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Customer', 'Contact', 'Bookings', 'Spent', 'Last booking', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sliced.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-brand-muted">No customers found</td></tr>}
              {sliced.map((c) => (
                <tr key={c.normalizedPhone} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="text-brand-text font-medium">
                      {c.name}
                      {c.bookings > 1 && <span className="ms-2 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] uppercase">repeat</span>}
                      {c.blocked && <span className="ms-2 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] uppercase">blocked</span>}
                    </p>
                    {c.blockReason && <p className="text-xs text-red-400/80">{c.blockReason}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-muted">
                    <p>{c.phone}</p>
                    {c.email && <p>{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-muted">
                    <span className="text-brand-text">{c.bookings}</span> total · {c.completed} completed
                    {c.cancelledOrDeclined > 0 && ` · ${c.cancelledOrDeclined} cancelled/declined`}
                  </td>
                  <td className="px-4 py-3 text-brand-red font-semibold whitespace-nowrap">{money(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted whitespace-nowrap">{c.lastBookingAt ? new Date(c.lastBookingAt).toLocaleDateString('en-GB') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      {c.bookings > 0 && (
                        <button onClick={() => navigate(`/admin/bookings?q=${encodeURIComponent(c.phone)}`)} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-brand-text">Bookings</button>
                      )}
                      <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg text-xs bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20">WhatsApp</a>
                      {c.blocked ? (
                        <button onClick={() => unblock(c)} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-brand-text">Unblock</button>
                      ) : (
                        <button onClick={() => setBlocking({ phone: c.phone, name: c.name })} className="px-2.5 py-1 rounded-lg text-xs text-brand-muted hover:text-red-400 hover:bg-red-500/5">Block</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-white/5"><Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onChange={setPage} /></div>
      </div>

      <Modal open={!!blocking} onClose={() => setBlocking(null)} maxWidth="max-w-md">
        {blocking && (
          <form onSubmit={block} className="space-y-4">
            <h3 className="text-lg font-bold text-brand-text">Block from online booking</h3>
            <p className="text-sm text-brand-muted">This phone number will not be able to book on the website. You can still add bookings for them yourself.</p>
            <input value={blocking.phone} onChange={(e) => setBlocking({ ...blocking, phone: e.target.value })} placeholder="Phone number" required className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text" aria-label="Phone number" />
            <input value={blocking.name} onChange={(e) => setBlocking({ ...blocking, name: e.target.value })} placeholder="Name (optional)" className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text" aria-label="Name" />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. damaged car, unpaid balance" maxLength={300} className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text" aria-label="Reason" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setBlocking(null)} className="px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-brand-text">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-500">Block</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
