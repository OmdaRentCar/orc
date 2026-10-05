import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import { socket } from '../../services/socket';
import type { DashboardStats } from '../../types';
import { money, whatsappUrl } from '../../utils/format';
import { STATUS_LABELS, BadgeStatus } from '../../components/ui/Badge';
import RevenueChart from './RevenueChart';
import { brandName } from '../../services/agency';
import Onboarding from './Onboarding';

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-brand-muted">{label}</p>
        <span className="text-2xl" aria-hidden="true">{icon}</span>
      </div>
      <p className="font-display text-3xl font-extrabold text-brand-text">{value}</p>
      {sub && <p className="text-xs text-brand-muted mt-1">{sub}</p>}
    </div>
  );
}

function BarList({ data, total }: { data: { label: string; count: number }[]; total: number }) {
  return (
    <div className="space-y-2">
      {data.map(({ label, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={label} className="flex items-center gap-3">
            <p className="text-xs text-brand-muted w-24 truncate">{label}</p>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-brand-red rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-brand-text w-8 text-right">{count}</p>
          </div>
        );
      })}
    </div>
  );
}

// One-click WhatsApp reminders, in the language the customer booked in
const REMINDER: Record<string, { pickup: string; return: string; late: string }> = {
  en: {
    pickup: 'Hello {name}, reminder: your car ({car}) is ready on {date} at {time}. Please bring your ID and driving licence. — {brand}',
    return: 'Hello {name}, reminder: please return the car ({car}) on {date} at {time}, with the same fuel level. Thank you! — {brand}',
    late: 'Hello {name}, the car ({car}) was due back on {date}. Please contact us to arrange the return. — {brand}',
  },
  fr: {
    pickup: 'Bonjour {name}, rappel : votre véhicule ({car}) est prêt le {date} à {time}. Pensez à votre pièce d’identité et votre permis. — {brand}',
    return: 'Bonjour {name}, rappel : merci de rendre le véhicule ({car}) le {date} à {time}, avec le même niveau de carburant. Merci ! — {brand}',
    late: 'Bonjour {name}, le véhicule ({car}) devait être rendu le {date}. Merci de nous contacter pour organiser le retour. — {brand}',
  },
  ar: {
    pickup: 'مرحبًا {name}، تذكير: سيارتك ({car}) جاهزة يوم {date} على الساعة {time}. لا تنس بطاقة التعريف ورخصة السياقة. — {brand}',
    return: 'مرحبًا {name}، تذكير: يرجى إرجاع السيارة ({car}) يوم {date} على الساعة {time} بنفس مستوى الوقود. شكرًا! — {brand}',
    late: 'مرحبًا {name}، كان موعد إرجاع السيارة ({car}) يوم {date}. يرجى التواصل معنا لترتيب الإرجاع. — {brand}',
  },
};

function reminder(kind: 'pickup' | 'return' | 'late', locale: string, vars: Record<string, string>): string {
  const text = (REMINDER[locale] ?? REMINDER.en)[kind];
  return text.replace(/\{(\w+)\}/g, (_, k: string) => ({ brand: brandName(), ...vars } as Record<string, string>)[k] ?? '');
}

const LEVEL_STYLE = { expired: 'bg-red-500/10 text-red-400', soon: 'bg-orange-500/10 text-orange-400', upcoming: 'bg-yellow-500/10 text-yellow-300' };

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const load = () => apiJSON<DashboardStats>('/dashboard').then(setStats).catch(console.error);
    load();
    socket.on('booking-update', load);
    return () => { socket.off('booking-update', load); };
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
      </div>
    );
  }

  const totalBookings = stats.bookingByStatus.reduce((s, r) => s + r.count, 0);
  const totalCarsForType = stats.carsByType.reduce((s, r) => s + r.count, 0);
  const yearRevenue = stats.monthly.reduce((s, m) => s + m.revenue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-text">Overview</h1>
        <p className="text-sm text-brand-muted mt-1">Fleet and booking summary</p>
      </div>

      <Onboarding />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats">
        <StatCard label="Active Rentals" value={stats.activeRentals} icon="🚗" sub="On the road today" />
        <StatCard label="Revenue" value={money(stats.revenue)} icon="💰" sub={`${money(stats.collected)} collected`} />
        <StatCard label="In Maintenance" value={stats.inMaintenance} icon="🔧" sub="Unavailable cars" />
        <StatCard label="Pending Approvals" value={stats.pendingCount} icon="⏳" sub="Awaiting review" />
      </div>

      {(stats.alerts.length > 0 || stats.lateReturns.length > 0 || stats.unpaid.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <h3 className="font-semibold text-brand-text mb-3">Car papers & service</h3>
            {stats.alerts.length === 0 ? <p className="text-sm text-brand-muted">All papers valid.</p> : (
              <ul className="space-y-2">
                {stats.alerts.slice(0, 6).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${LEVEL_STYLE[a.level]}`}>{a.level === 'expired' ? (a.kind === 'service' ? 'due' : 'expired') : 'soon'}</span>
                    <div className="min-w-0"><p className="text-brand-text truncate">{a.car}</p><p className="text-xs text-brand-muted">{a.label} · {a.due}</p></div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/admin/cars" className="inline-block mt-3 text-xs text-brand-red hover:underline">Update papers →</Link>
          </div>
          <div className="glass-card p-5">
            <h3 className="font-semibold text-brand-text mb-3">Late returns</h3>
            {stats.lateReturns.length === 0 ? <p className="text-sm text-brand-muted">No car is late.</p> : (
              <ul className="space-y-2">
                {stats.lateReturns.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link to={`/admin/bookings?id=${l.id}`} className="min-w-0"><p className="text-brand-text truncate">{l.guestName} · {l.car}</p><p className="text-xs text-red-400">Due {l.due}</p></Link>
                    <a href={whatsappUrl(l.phone, reminder('late', l.locale, { name: l.guestName, car: l.car, date: l.due }))} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#25D366]/10 text-[#25D366] flex-shrink-0">WhatsApp</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="glass-card p-5">
            <h3 className="font-semibold text-brand-text mb-1">Unpaid balances</h3>
            <p className="text-xs text-brand-muted mb-3">{money(stats.unpaidTotal)} still owed on returned cars</p>
            {stats.unpaid.length === 0 ? <p className="text-sm text-brand-muted">Everything is paid.</p> : (
              <ul className="space-y-2">
                {stats.unpaid.slice(0, 5).map((u) => (
                  <li key={u.id}>
                    <Link to={`/admin/bookings?id=${u.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand-red">
                      <span className="text-brand-text truncate">{u.guestName} <span className="text-xs text-brand-muted">{u.reference}</span></span>
                      <span className="text-brand-red font-semibold whitespace-nowrap">{money(u.balance)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-card p-5 xl:col-span-2">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-semibold text-brand-text">Revenue per month</h3>
            <p className="text-xs text-brand-muted">Last 12 months · {money(yearRevenue)}</p>
          </div>
          <RevenueChart data={stats.monthly} />
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold text-brand-text mb-4">Next 7 days</h3>
          {stats.upcoming.length === 0 ? (
            <p className="text-sm text-brand-muted">No pick-ups or returns scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {stats.upcoming.map((u) => (
                <li key={`${u.id}-${u.kind}`} className="flex items-start gap-3">
                  <span className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${u.kind === 'pickup' ? 'bg-green-500/10 text-green-400' : 'bg-sky-500/10 text-sky-400'}`}>
                    {u.kind === 'pickup' ? 'Pick-up' : 'Return'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-brand-text truncate">{u.guestName} · {u.car}</p>
                    <p className="text-xs text-brand-muted">{formatDay(u.date)} at {u.time} · {u.reference}</p>
                  </div>
                  <a
                    href={whatsappUrl(u.phone, reminder(u.kind, u.locale, { name: u.guestName, car: u.car, date: formatDay(u.date), time: u.time }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Send a WhatsApp reminder"
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#25D366]/10 text-[#25D366] flex-shrink-0"
                  >
                    Remind
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/calendar" className="inline-block mt-4 text-xs text-brand-red hover:underline">Open calendar →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="font-semibold text-brand-text mb-4">Bookings by Status</h3>
          <BarList
            data={stats.bookingByStatus.map((r) => ({ label: STATUS_LABELS[r.status as BadgeStatus] ?? r.status, count: r.count }))}
            total={totalBookings}
          />
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold text-brand-text mb-4">Cars by Type</h3>
          <BarList data={stats.carsByType.map((r) => ({ label: r.type, count: r.count }))} total={totalCarsForType} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats">
        <div className="glass-card p-5 col-span-2 lg:col-span-1">
          <p className="text-sm text-brand-muted mb-1">Total Cars</p>
          <p className="font-display text-3xl font-extrabold text-brand-text">{stats.totalCars}</p>
        </div>
        <div className="glass-card p-5 col-span-2 lg:col-span-1">
          <p className="text-sm text-brand-muted mb-1">Total Bookings</p>
          <p className="font-display text-3xl font-extrabold text-brand-text">{stats.totalBookings}</p>
        </div>
        <div className="glass-card p-5 col-span-2">
          <h3 className="font-semibold text-brand-text mb-3">Top Brands</h3>
          <div className="flex flex-wrap gap-2">
            {stats.carsByBrand.slice(0, 6).map((b) => (
              <div key={b.brand} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <span className="text-xs text-brand-text font-medium">{b.brand}</span>
                <span className="text-xs text-brand-muted font-bold">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
