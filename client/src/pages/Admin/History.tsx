import { useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import type { Booking } from '../../types';

const PAGE_SIZE = 10;

export default function History() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiJSON<Booking[]>('/bookings')
      .then((data) => setBookings(data.filter((b) => b.status !== 'pending')))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sliced = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(bookings.length / PAGE_SIZE);

  if (loading) return <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-text">History</h1>
        <p className="text-sm text-brand-muted mt-1">{bookings.length} completed bookings</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['ID', 'Guest', 'Car', 'Period', 'Total', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sliced.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-brand-muted">No history yet</td></tr>
              )}
              {sliced.map((b) => (
                <tr key={b.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-brand-muted text-xs">#{b.id}</td>
                  <td className="px-4 py-3">
                    <p className="text-brand-text font-medium">{b.guestName}</p>
                    {b.phone && <p className="text-xs text-brand-muted">{b.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text">
                    {b.car ? `${b.car.brand} ${b.car.model}` : `Car #${b.carId}`}
                  </td>
                  <td className="px-4 py-3 text-brand-muted text-xs whitespace-nowrap">
                    {b.startDate} → {b.endDate}
                  </td>
                  <td className="px-4 py-3 text-brand-red font-bold">${b.total.toFixed(0)}</td>
                  <td className="px-4 py-3">
                    <Badge status={b.status as 'approved' | 'declined'} />
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
    </div>
  );
}
