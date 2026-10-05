import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import { socket } from '../../services/socket';
import type { Booking, BookingStatus, Car } from '../../types';
import { addDaysISO, localTodayISO } from '../../utils/format';
import { STATUS_LABELS } from '../../components/ui/Badge';

// Declined and cancelled bookings don't hold the car, so they are left off the calendar
const SHOWN: BookingStatus[] = ['pending', 'approved', 'picked_up', 'completed'];
const BAR: Record<string, string> = {
  pending: 'bg-yellow-500/25 border-yellow-500/50 text-yellow-200',
  approved: 'bg-green-500/25 border-green-500/50 text-green-100',
  picked_up: 'bg-sky-500/30 border-sky-500/60 text-sky-100',
  completed: 'bg-white/10 border-white/20 text-brand-muted',
};

function shiftMonth(first: string, delta: number): string {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

export default function FleetCalendar() {
  const navigate = useNavigate();
  const today = localTodayISO();
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => {
      apiJSON<Car[]>('/cars').then(setCars).catch(() => {});
      apiJSON<Booking[]>('/bookings').then(setBookings).catch(() => {});
    };
    load();
    socket.on('booking-update', load);
    return () => { socket.off('booking-update', load); };
  }, []);

  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => addDaysISO(month, i));
  const monthEnd = days[days.length - 1];
  const title = new Date(`${month}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const byCar = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const b of bookings) {
      if (!SHOWN.includes(b.status) || b.endDate < month || b.startDate > monthEnd) continue;
      map.set(b.carId, [...(map.get(b.carId) ?? []), b]);
    }
    return map;
  }, [bookings, month, monthEnd]);

  const dayWidth = 34;

  // Scroll the grid so today (or the start of the month) is in view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const index = today.startsWith(month.slice(0, 7)) ? Number(today.slice(8)) - 1 : 0;
    el.scrollLeft = Math.max(0, index * dayWidth - el.clientWidth / 2 + 200);
  }, [month, today, cars.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Fleet Calendar</h1>
          <p className="text-sm text-brand-muted mt-1">Which car is out on which day. Click a booking to open it.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="w-9 h-9 rounded-lg bg-white/5 text-brand-text hover:bg-white/10" aria-label="Previous month">‹</button>
          <p className="w-40 text-center font-semibold text-brand-text">{title}</p>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="w-9 h-9 rounded-lg bg-white/5 text-brand-text hover:bg-white/10" aria-label="Next month">›</button>
          <button onClick={() => setMonth(`${today.slice(0, 7)}-01`)} className="px-3 h-9 rounded-lg bg-white/5 text-xs text-brand-muted hover:text-brand-text">Today</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-brand-muted">
        {SHOWN.map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded border ${BAR[s]}`} />{STATUS_LABELS[s]}</span>
        ))}
      </div>

      <div ref={scrollRef} className="glass-card overflow-x-auto">
        <div style={{ minWidth: 200 + dayWidth * daysInMonth }}>
          <div className="flex border-b border-white/5 sticky top-0 bg-brand-surface/80">
            <div className="w-[200px] flex-shrink-0 px-3 py-2 text-xs text-brand-muted uppercase tracking-wider">Car</div>
            {days.map((d) => {
              const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
              return (
                <div
                  key={d}
                  style={{ width: dayWidth }}
                  className={`flex-shrink-0 text-center py-1 text-[10px] ${d === today ? 'text-brand-red font-bold' : weekday === 0 || weekday === 6 ? 'text-brand-muted/60' : 'text-brand-muted'}`}
                >
                  <div>{'SMTWTFS'[weekday]}</div>
                  <div className="text-xs">{Number(d.slice(8))}</div>
                </div>
              );
            })}
          </div>

          {cars.map((car) => (
            <div key={car.id} className="flex border-b border-white/[0.03] relative h-11">
              <div className="w-[200px] flex-shrink-0 px-3 flex flex-col justify-center">
                <p className="text-sm text-brand-text truncate">{car.brand} {car.model}</p>
                {!car.available && <p className="text-[10px] text-orange-400">maintenance</p>}
              </div>
              <div className="relative flex-1">
                {days.map((d, i) => (
                  <div key={d} style={{ left: i * dayWidth, width: dayWidth }} className={`absolute top-0 bottom-0 border-l border-white/[0.03] ${d === today ? 'bg-brand-red/5' : ''}`} />
                ))}
                {(byCar.get(car.id) ?? []).map((b) => {
                  const startIdx = Math.max(0, days.indexOf(b.startDate < month ? month : b.startDate));
                  const endIdx = days.indexOf(b.endDate > monthEnd ? monthEnd : b.endDate);
                  return (
                    <button
                      key={b.id}
                      onClick={() => navigate(`/admin/bookings?id=${b.id}`)}
                      title={`${b.reference} · ${b.guestName} · ${b.startDate} ${b.pickupTime} → ${b.endDate} ${b.returnTime} (${STATUS_LABELS[b.status]})`}
                      style={{ left: startIdx * dayWidth + 2, width: (endIdx - startIdx + 1) * dayWidth - 4 }}
                      className={`absolute top-1.5 bottom-1.5 rounded-md border px-1.5 text-[11px] truncate text-left hover:brightness-125 ${BAR[b.status]}`}
                    >
                      {b.guestName}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {cars.length === 0 && <p className="p-8 text-center text-brand-muted text-sm">No cars yet</p>}
        </div>
      </div>
    </div>
  );
}
