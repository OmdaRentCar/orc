import { useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import type { Booking, BookingStatus } from '../../types';
import { socket } from '../../services/socket';

const PAGE_SIZE = 10;

export default function Bookings() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    try {
      const data = await apiJSON<Booking[]>('/bookings');
      setBookings(data);
    } catch {
      showToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const handler = () => load();
    socket.on('booking-update', handler);
    return () => { socket.off('booking-update', handler); };
  }, []);

  async function updateStatus(id: number, status: BookingStatus) {
    try {
      await apiJSON(`/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      showToast(`Booking #${id} ${status}`, status === 'approved' ? 'success' : 'info');
      load();
    } catch (e: unknown) {
      showToast((e as Error).message, 'error');
    }
  }

  async function deleteBooking() {
    if (!deleteId) return;
    try {
      await apiJSON(`/bookings/${deleteId}`, { method: 'DELETE' });
      showToast('Booking deleted', 'success');
      setDeleteId(null);
      load();
    } catch {
      showToast('Delete failed', 'error');
    }
  }

  const sliced = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(bookings.length / PAGE_SIZE);

  if (loading) return <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Bookings</h1>
          <p className="text-sm text-brand-muted mt-1">{bookings.length} total</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['ID', 'Guest', 'Phone', 'Car', 'Dates', 'Total', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sliced.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-brand-muted">No bookings found</td></tr>
              )}
              {sliced.map((b) => (
                <tr key={b.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-brand-muted text-xs">#{b.id}</td>
                  <td className="px-4 py-3">
                    <p className="text-brand-text font-medium">{b.guestName}</p>
                    {b.email && <p className="text-xs text-brand-muted">{b.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-brand-muted text-xs">{b.phone}</td>
                  <td className="px-4 py-3 text-brand-text text-xs">
                    {b.car ? `${b.car.brand} ${b.car.model}` : `Car #${b.carId}`}
                  </td>
                  <td className="px-4 py-3 text-brand-muted text-xs whitespace-nowrap">
                    {b.startDate} → {b.endDate}
                  </td>
                  <td className="px-4 py-3 text-brand-red font-bold">${b.total.toFixed(0)}</td>
                  <td className="px-4 py-3">
                    <Badge status={b.status as 'pending' | 'approved' | 'declined'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {b.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateStatus(b.id, 'approved')}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(b.id, 'declined')}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {b.documentImage && (
                        <a
                          href={b.documentImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 text-brand-muted hover:text-brand-text transition-colors"
                        >
                          Doc
                        </a>
                      )}
                      <button
                        onClick={() => setDeleteId(b.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-brand-muted hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
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

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Booking"
        message={`Permanently delete booking #${deleteId}?`}
        confirmLabel="Delete"
        danger
        onConfirm={deleteBooking}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
