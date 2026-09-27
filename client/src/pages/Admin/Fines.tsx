import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJSON } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import type { Car, Fine, FineMatch } from '../../types';
import { money, whatsappUrl } from '../../utils/format';

const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50';
const labelClass = 'block text-xs text-brand-muted mb-1.5';

interface Lookup {
  car: { id: number; brand: string; model: string; plateNumber: string | null };
  at: string;
  matches: FineMatch[];
}

const STATUS_STYLE: Record<Fine['status'], string> = {
  open: 'bg-yellow-500/10 text-yellow-400',
  charged: 'bg-sky-500/10 text-sky-400',
  paid: 'bg-green-500/10 text-green-400',
};

export default function Fines() {
  const { showToast } = useToast();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const [cars, setCars] = useState<Car[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [carId, setCarId] = useState('');
  const [plate, setPlate] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => {
    apiJSON<Fine[]>('/fines').then(setFines).catch(() => showToast('Failed to load fines', 'error'));
  }, [showToast]);

  useEffect(() => {
    load();
    apiJSON<Car[]>('/cars').then(setCars).catch(() => {});
  }, [load]);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!carId && !plate.trim()) { showToast('Choose the car or type its plate number', 'error'); return; }
    setSearching(true);
    setLookup(null);
    try {
      const q = new URLSearchParams({ date, time, ...(carId ? { carId } : { plate: plate.trim() }) });
      setLookup(await apiJSON<Lookup>(`/fines/lookup?${q}`));
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSearching(false);
    }
  }

  async function record(bookingId: number | null) {
    if (!lookup) return;
    const value = Number(amount);
    if (!(value > 0)) { showToast('Enter the fine amount first', 'error'); return; }
    try {
      await apiJSON('/fines', {
        method: 'POST',
        body: JSON.stringify({ carId: lookup.car.id, bookingId, date, time, amount: value, description: description.trim() || undefined, chargeCustomer: !!bookingId }),
      });
      showToast(bookingId ? 'Fine recorded and added to the customer’s bill' : 'Fine recorded', 'success');
      setLookup(null); setAmount(''); setDescription('');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function setStatus(fine: Fine, status: Fine['status']) {
    try {
      await apiJSON(`/fines/${fine.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      load();
    } catch (err) { showToast((err as Error).message, 'error'); }
  }

  async function remove(fine: Fine) {
    try {
      await apiJSON(`/fines/${fine.id}`, { method: 'DELETE' });
      load();
    } catch (err) { showToast((err as Error).message, 'error'); }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-text">Traffic Fines</h1>
        <p className="text-sm text-brand-muted mt-1">A fine arrives with a plate, a date and a time. Find who had the car, then charge it to them.</p>
      </div>

      <form onSubmit={search} className="glass-card p-5 space-y-4">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="f-car">Car</label>
            <select id="f-car" value={carId} onChange={(e) => { setCarId(e.target.value); if (e.target.value) setPlate(''); }} className={inputClass}>
              <option value="">Find by plate number →</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model}{c.plateNumber ? ` · ${c.plateNumber}` : ''}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="f-plate">…or plate number</label>
            <input id="f-plate" value={plate} disabled={!!carId} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. 123 TU 4567" className={`${inputClass} disabled:opacity-40`} />
          </div>
          <div>
            <label className={labelClass} htmlFor="f-date">Date of the offence *</label>
            <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="f-time">Time *</label>
            <input id="f-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="f-amount">Amount (DT)</label>
            <input id="f-amount" type="number" min={0} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="f-desc">Description</label>
            <input id="f-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Radar, parking..." maxLength={300} className={inputClass} />
          </div>
        </div>
        <button type="submit" disabled={searching} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50">
          {searching ? 'Searching...' : 'Who had the car?'}
        </button>

        {lookup && (
          <div className="border-t border-white/5 pt-4">
            <p className="text-sm text-brand-muted mb-3">{lookup.car.brand} {lookup.car.model}{lookup.car.plateNumber ? ` · ${lookup.car.plateNumber}` : ''} on {fmt(lookup.at)}</p>
            {lookup.matches.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03]">
                <p className="text-sm text-brand-text">No rental at that moment: the car was with the agency.</p>
                <button type="button" onClick={() => record(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-brand-text hover:bg-white/15">Record fine (agency pays)</button>
              </div>
            ) : lookup.matches.map((m) => (
              <div key={m.id} className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="text-brand-text font-semibold">{m.guestName} <span className="text-xs text-brand-muted font-normal">· {m.reference}</span></p>
                  <p className="text-brand-muted">{m.phone}{m.email ? ` · ${m.email}` : ''}</p>
                  {(m.idNumber || m.licenseNumber) && <p className="text-brand-muted">{m.idNumber && `CIN ${m.idNumber}`} {m.licenseNumber && `· Licence ${m.licenseNumber}`}</p>}
                  <p className="text-xs text-brand-muted mt-1">Had the car {fmt(m.from)} → {fmt(m.to)} ({m.basedOn === 'handover' ? 'recorded at pick-up/return' : 'booked times'})</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={whatsappUrl(m.phone)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#25D366]/10 text-[#25D366]">WhatsApp</a>
                  <button type="button" onClick={() => navigate(`/admin/bookings?id=${m.id}`)} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-brand-text">Open booking</button>
                  <button type="button" onClick={() => record(m.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-red text-white hover:bg-red-500">Charge {amount ? money(Number(amount)) : 'fine'} to {m.guestName.split(' ')[0]}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Offence', 'Car', 'Customer', 'Amount', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {fines.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-brand-muted">No fines recorded</td></tr>}
              {fines.map((f) => (
                <tr key={f.id} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3 text-xs text-brand-text whitespace-nowrap">{f.date} {f.time}{f.description && <p className="text-brand-muted">{f.description}</p>}</td>
                  <td className="px-4 py-3 text-xs text-brand-text">{f.car.brand} {f.car.model}{f.car.plateNumber && <p className="text-brand-muted">{f.car.plateNumber}</p>}</td>
                  <td className="px-4 py-3 text-xs">{f.booking ? <><p className="text-brand-text">{f.booking.guestName}</p><p className="text-brand-muted">{f.booking.reference}</p></> : <span className="text-brand-muted">Agency</span>}</td>
                  <td className="px-4 py-3 font-semibold text-brand-red whitespace-nowrap">{money(f.amount)}</td>
                  <td className="px-4 py-3">
                    <select value={f.status} onChange={(e) => setStatus(f, e.target.value as Fine['status'])} aria-label="Fine status" className={`rounded-lg px-2 py-1 text-xs font-semibold border-0 ${STATUS_STYLE[f.status]}`}>
                      <option value="open">Open</option>
                      <option value="charged">Charged</option>
                      <option value="paid">Paid</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">{isOwner && <button onClick={() => remove(f)} className="text-xs text-brand-muted hover:text-red-400">Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
