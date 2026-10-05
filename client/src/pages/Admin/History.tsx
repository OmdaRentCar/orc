import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import type { Booking } from '../../types';
import { money } from '../../utils/format';

const PAGE_SIZE = 15;
const FINISHED = ['completed', 'declined', 'cancelled'];

export default function History() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiJSON<Booking[]>('/bookings')
      .then((data) => setBookings(data.filter((b) => FINISHED.includes(b.status))))
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
        <p className="text-sm text-brand-muted mt-1">{bookings.length} finished bookings (completed, declined or cancelled)</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Reference', 'Customer', 'Car', 'Period', 'Total', 'Paid', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sliced.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-brand-muted">No history yet</td></tr>
              )}
              {sliced.map((b) => (
                <tr key={b.id} onClick={() => navigate(`/admin/bookings?id=${b.id}`)} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-xs font-semibold text-brand-text">{b.reference}</td>
                  <td className="px-4 py-3">
                    <p className="text-brand-text font-medium">{b.guestName}</p>
                    <p className="text-xs text-brand-muted">{b.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text">{b.car ? `${b.car.brand} ${b.car.model}` : `Car #${b.carId}`}</td>
                  <td className="px-4 py-3 text-brand-muted text-xs whitespace-nowrap">{b.startDate} → {b.endDate}</td>
                  <td className="px-4 py-3 text-brand-red font-bold whitespace-nowrap">{money(b.total)}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted whitespace-nowrap">{money(b.amountPaid)}</td>
                  <td className="px-4 py-3"><Badge status={b.status} /></td>
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
