import { useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import type { DashboardStats } from '../../types';

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-brand-muted">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="font-display text-3xl font-extrabold text-brand-text">{value}</p>
      {sub && <p className="text-xs text-brand-muted mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, total }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string; total: number }) {
  return (
    <div className="space-y-2">
      {data.map((item) => {
        const label = item[labelKey] as string;
        const value = item[valueKey] as number;
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={label} className="flex items-center gap-3">
            <p className="text-xs text-brand-muted w-24 truncate capitalize">{label}</p>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-brand-red rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-brand-text w-8 text-right">{value}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiJSON<DashboardStats>('/dashboard').then(setStats).catch(console.error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-text">Overview</h1>
        <p className="text-sm text-brand-muted mt-1">Fleet and booking summary</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Rentals" value={stats.activeRentals} icon="🚗" sub="Currently out" />
        <StatCard label="Revenue" value={`$${stats.revenue.toLocaleString()}`} icon="💰" sub="Approved bookings" />
        <StatCard label="In Maintenance" value={stats.inMaintenance} icon="🔧" sub="Unavailable cars" />
        <StatCard label="Pending Approvals" value={stats.pendingCount} icon="⏳" sub="Awaiting review" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="font-semibold text-brand-text mb-4">Bookings by Status</h3>
          <BarChart data={stats.bookingByStatus as Record<string, unknown>[]} labelKey="status" valueKey="count" total={totalBookings} />
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold text-brand-text mb-4">Cars by Type</h3>
          <BarChart data={stats.carsByType as Record<string, unknown>[]} labelKey="type" valueKey="count" total={totalCarsForType} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                <span className="text-xs text-brand-red font-bold">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
