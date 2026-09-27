import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import type { Car, CarReport, Expense, ExpenseCategory } from '../../types';
import { addDaysISO, localTodayISO, money } from '../../utils/format';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'repair', label: 'Repair' },
  { value: 'service', label: 'Service / oil change' },
  { value: 'tyres', label: 'Tyres' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'documents', label: 'Vignette / inspection' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];
const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<ExpenseCategory, string>;

const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50';

export default function Finances() {
  const { showToast } = useToast();
  const { isOwner } = useAuth();
  const today = localTodayISO();
  const [cars, setCars] = useState<Car[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [report, setReport] = useState<CarReport | null>(null);
  const [from, setFrom] = useState(addDaysISO(today, -364));
  const [to, setTo] = useState(today);
  const [form, setForm] = useState({ carId: '', date: today, category: 'repair' as ExpenseCategory, amount: '', note: '' });

  const load = useCallback(() => {
    apiJSON<Expense[]>('/expenses').then(setExpenses).catch(() => showToast('Failed to load expenses', 'error'));
    apiJSON<CarReport>(`/reports/cars?from=${from}&to=${to}`).then(setReport).catch((e) => showToast((e as Error).message, 'error'));
  }, [from, to, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiJSON<Car[]>('/cars').then(setCars).catch(() => {}); }, []);

  async function addExpense(e: FormEvent) {
    e.preventDefault();
    try {
      await apiJSON('/expenses', {
        method: 'POST',
        body: JSON.stringify({ carId: Number(form.carId), date: form.date, category: form.category, amount: Number(form.amount), note: form.note.trim() || undefined }),
      });
      showToast('Expense added', 'success');
      setForm({ ...form, amount: '', note: '' });
      load();
    } catch (err) { showToast((err as Error).message, 'error'); }
  }

  async function remove(expense: Expense) {
    try {
      await apiJSON(`/expenses/${expense.id}`, { method: 'DELETE' });
      load();
    } catch (err) { showToast((err as Error).message, 'error'); }
  }

  const maxRevenue = Math.max(1, ...(report?.cars.map((c) => Math.max(c.revenue, c.expenses)) ?? [1]));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Profit per Car</h1>
          <p className="text-sm text-brand-muted mt-1">Revenue from rentals and extra charges, minus what each car cost you.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-brand-muted">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-brand-muted">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1`} /></label>
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-3 gap-4">
          {([['Revenue', report.totals.revenue, 'text-brand-text'], ['Expenses', report.totals.expenses, 'text-brand-text'], ['Profit', report.totals.profit, report.totals.profit >= 0 ? 'text-green-400' : 'text-red-400']] as const).map(([label, value, color]) => (
            <div key={label} className="glass-card p-5">
              <p className="text-sm text-brand-muted">{label}</p>
              <p className={`font-display text-3xl font-extrabold mt-1 ${color}`}>{money(Math.round(value))}</p>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Car', 'Rented', 'Revenue vs expenses', 'Revenue', 'Expenses', 'Profit'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {report?.cars.map((c) => (
                <tr key={c.carId} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3"><p className="text-brand-text font-medium">{c.car}</p>{c.plateNumber && <p className="text-xs text-brand-muted">{c.plateNumber}</p>}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted whitespace-nowrap"><span className="text-brand-text">{c.bookedDays} days</span> · {c.utilization}%</td>
                  <td className="px-4 py-3 w-56">
                    <div className="space-y-1" aria-hidden="true">
                      <div className="h-1.5 rounded-full bg-brand-red" style={{ width: `${(c.revenue / maxRevenue) * 100}%` }} />
                      <div className="h-1.5 rounded-full bg-white/40" style={{ width: `${(c.expenses / maxRevenue) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-text whitespace-nowrap">{money(c.revenue)}</td>
                  <td className="px-4 py-3 text-brand-muted whitespace-nowrap">{money(c.expenses)}</td>
                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${c.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(c.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[11px] text-brand-muted border-t border-white/5"><span className="inline-block w-3 h-1.5 rounded-full bg-brand-red align-middle" /> revenue · <span className="inline-block w-3 h-1.5 rounded-full bg-white/40 align-middle" /> expenses</p>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <form onSubmit={addExpense} className="glass-card p-5 space-y-3">
          <h2 className="font-semibold text-brand-text">Add an expense</h2>
          <select value={form.carId} onChange={(e) => setForm({ ...form, carId: e.target.value })} required aria-label="Car" className={inputClass}>
            <option value="">Choose a car</option>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model}{c.plateNumber ? ` · ${c.plateNumber}` : ''}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required aria-label="Date" className={inputClass} />
            <input type="number" min={0} step="0.5" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required placeholder="Amount DT" aria-label="Amount (DT)" className={inputClass} />
          </div>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} aria-label="Category" className={inputClass}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional)" maxLength={300} aria-label="Note" className={inputClass} />
          <button type="submit" className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500">Add expense</button>
        </form>

        <div className="glass-card divide-y divide-white/5">
          <p className="px-4 py-3 text-xs uppercase tracking-wider text-brand-muted">Recent expenses</p>
          {expenses.length === 0 && <p className="px-4 py-8 text-center text-sm text-brand-muted">No expenses yet</p>}
          {expenses.slice(0, 30).map((x) => (
            <div key={x.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-brand-text truncate">{x.car.brand} {x.car.model} · {LABEL[x.category]}</p>
                <p className="text-xs text-brand-muted">{x.date}{x.note ? ` · ${x.note}` : ''}</p>
              </div>
              <div className="flex items-center gap-3 whitespace-nowrap">
                <span className="text-brand-text">{money(x.amount)}</span>
                {isOwner && <button onClick={() => remove(x)} aria-label="Delete expense" className="text-brand-muted hover:text-red-400">×</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
