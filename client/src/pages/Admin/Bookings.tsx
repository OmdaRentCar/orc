import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import type { Booking, BookingStatus, Car } from '../../types';
import { socket } from '../../services/socket';
import { money, normalizePhone } from '../../utils/format';
import BookingDetails from './BookingDetails';
import BookingEditor from './BookingEditor';

const PAGE_SIZE = 15;
const STATUS_FILTERS: { value: '' | BookingStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Quoted CSV that opens cleanly in Excel; cells starting with = + - @ are prefixed so they can't run as formulas
function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    let s = v === null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

function exportCsv(bookings: Booking[]) {
  const header = ['Reference', 'Status', 'Customer', 'Phone', 'Email', 'Car', 'Pick-up date', 'Pick-up time', 'Return date', 'Return time',
    'Method', 'Delivery address', 'Extras', 'Rental', 'Discount', 'Extras total', 'Delivery fee', 'Total', 'Deposit', 'Payment', 'Paid', 'Source', 'Created'];
  const rows = bookings.map((b) => [
    b.reference, b.status, b.guestName, b.phone, b.email, b.car ? `${b.car.brand} ${b.car.model}` : `#${b.carId}`,
    b.startDate, b.pickupTime, b.endDate, b.returnTime, b.deliveryType, b.deliveryAddress, b.extras.map((e) => e.name).join('; '),
    b.subtotal, b.discount, b.extrasTotal, b.deliveryFee, b.total, b.deposit, b.paymentStatus, b.amountPaid, b.source,
    new Date(b.createdAt).toISOString(),
  ]);
  const blob = new Blob([toCsv([header, ...rows])], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Bookings() {
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | BookingStatus>((params.get('status') as BookingStatus) ?? '');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(params.get('id') ? Number(params.get('id')) : null);
  const [editor, setEditor] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const load = useCallback(async () => {
    try {
      setBookings(await apiJSON<Booking[]>('/bookings'));
    } catch {
      showToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
    apiJSON<Car[]>('/cars').then(setCars).catch(() => {});
    socket.on('booking-update', load);
    return () => { socket.off('booking-update', load); };
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qPhone = normalizePhone(q);
    return bookings.filter((b) => {
      if (status && b.status !== status) return false;
      // Keep bookings whose rental period overlaps the chosen range
      if (from && b.endDate < from) return false;
      if (to && b.startDate > to) return false;
      if (!q) return true;
      return b.reference.toLowerCase().includes(q)
        || b.guestName.toLowerCase().includes(q)
        || (b.email ?? '').toLowerCase().includes(q)
        || (qPhone.length >= 4 && normalizePhone(b.phone).includes(qPhone))
        || `${b.car?.brand ?? ''} ${b.car?.model ?? ''}`.toLowerCase().includes(q);
    });
  }, [bookings, status, search, from, to]);

  useEffect(() => { setPage(1); }, [status, search, from, to]);

  function openDetails(id: number | null) {
    setSelectedId(id);
    const next = new URLSearchParams(params);
    if (id) next.set('id', String(id)); else next.delete('id');
    setParams(next, { replace: true });
  }

  async function quickStatus(e: React.MouseEvent, b: Booking, next: BookingStatus) {
    e.stopPropagation();
    try {
      await apiJSON(`/bookings/${b.id}/status`, { method: 'PUT', body: JSON.stringify({ status: next }) });
      showToast(`${b.reference} ${next}`, next === 'approved' ? 'success' : 'info');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const sliced = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const filterClass = 'bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50';

  if (loading) return <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Bookings</h1>
          <p className="text-sm text-brand-muted mt-1">{filtered.length} of {bookings.length} shown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(filtered)} disabled={!filtered.length} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 text-brand-text hover:bg-white/10 disabled:opacity-40">
            Export CSV
          </button>
          <button onClick={() => setEditor({ open: true, booking: null })} className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500">
            + New booking
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, name, phone, email, car..." aria-label="Search bookings" className={`${filterClass} flex-1 min-w-[220px]`} />
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | BookingStatus)} aria-label="Filter by status" className={filterClass}>
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="text-xs text-brand-muted">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${filterClass} block mt-1`} /></label>
        <label className="text-xs text-brand-muted">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${filterClass} block mt-1`} /></label>
        {(status || search || from || to) && (
          <button onClick={() => { setStatus(''); setSearch(''); setFrom(''); setTo(''); }} className="px-3 py-2 text-xs text-brand-muted hover:text-brand-text">Clear</button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Reference', 'Customer', 'Car', 'Dates', 'Total', 'Status', 'Payment', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sliced.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-brand-muted">No bookings found</td></tr>
              )}
              {sliced.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => openDetails(b.id)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="text-brand-text font-semibold text-xs tracking-wide">{b.reference}</p>
                    <p className="text-[11px] text-brand-muted">{b.source === 'admin' ? 'staff' : 'online'}{b.documentImage ? ' · ID ✓' : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-brand-text font-medium">{b.guestName}</p>
                    <p className="text-xs text-brand-muted">{b.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-brand-text text-xs">
                    {b.car ? `${b.car.brand} ${b.car.model}` : `Car #${b.carId}`}
                    {b.deliveryType === 'delivery' && <p className="text-[11px] text-brand-muted">Delivery</p>}
                  </td>
                  <td className="px-4 py-3 text-brand-muted text-xs whitespace-nowrap">
                    {b.startDate} {b.pickupTime}<br />→ {b.endDate} {b.returnTime}
                  </td>
                  <td className="px-4 py-3 text-brand-red font-bold whitespace-nowrap">{money(b.total)}</td>
                  <td className="px-4 py-3"><Badge status={b.status} /></td>
                  <td className="px-4 py-3"><Badge status={b.paymentStatus} /></td>
                  <td className="px-4 py-3">
                    {b.status === 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={(e) => quickStatus(e, b, 'approved')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20">Approve</button>
                        <button onClick={(e) => quickStatus(e, b, 'declined')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20">Decline</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-white/5">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      <BookingDetails
        booking={editor.open ? null : selected}
        onClose={() => openDetails(null)}
        onChanged={(updated) => {
          if (updated) setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          load();
        }}
        onEdit={(b) => setEditor({ open: true, booking: b })}
      />

      <BookingEditor
        open={editor.open}
        booking={editor.booking}
        cars={cars}
        onClose={() => setEditor({ open: false, booking: null })}
        onSaved={(saved) => {
          showToast(editor.booking ? `${saved.reference} updated` : `${saved.reference} created`, 'success');
          setEditor({ open: false, booking: null });
          load();
          openDetails(saved.id);
        }}
      />
    </div>
  );
}
