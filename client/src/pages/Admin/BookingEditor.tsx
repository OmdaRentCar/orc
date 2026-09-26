import { FormEvent, useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { apiJSON } from '../../services/api';
import { useBusinessSettings } from '../../services/settings';
import type { Booking, Car, DeliveryType, Quote } from '../../types';
import { localTodayISO, money, TIME_SLOTS } from '../../utils/format';

interface Props {
  open: boolean;
  booking: Booking | null; // null = new booking
  cars: Car[];
  onClose: () => void;
  onSaved: (booking: Booking) => void;
}

const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors';
const labelClass = 'block text-xs text-brand-muted mb-1.5';

// For phone and walk-in customers, and for changing an existing booking
export default function BookingEditor({ open, booking, cars, onClose, onSaved }: Props) {
  const settings = useBusinessSettings();
  const isEdit = !!booking;

  const [carId, setCarId] = useState(0);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [returnTime, setReturnTime] = useState('10:00');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('agency');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [status, setStatus] = useState<'approved' | 'pending'>('approved');
  const [locale, setLocale] = useState('en');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setCarId(booking?.carId ?? cars.find((c) => c.available)?.id ?? cars[0]?.id ?? 0);
    setGuestName(booking?.guestName ?? '');
    setPhone(booking?.phone ?? '');
    setEmail(booking?.email ?? '');
    setStartDate(booking?.startDate ?? localTodayISO());
    setEndDate(booking?.endDate ?? '');
    setPickupTime(booking?.pickupTime ?? '10:00');
    setReturnTime(booking?.returnTime ?? '10:00');
    setDeliveryType(booking?.deliveryType ?? 'agency');
    setDeliveryAddress(booking?.deliveryAddress ?? '');
    setExtras(booking?.extras.map((e) => e.id) ?? []);
    setStatus('approved');
    setLocale(booking?.locale ?? 'en');
    setNotes(booking?.notes ?? '');
  }, [open, booking, cars]);

  useEffect(() => {
    if (!open || !carId || !startDate || !endDate || endDate < startDate) { setQuote(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiJSON<Quote>('/bookings/quote', {
        method: 'POST',
        body: JSON.stringify({ carId, startDate, endDate, extras, deliveryType }),
        signal: controller.signal,
      }).then(setQuote).catch(() => setQuote(null));
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, carId, startDate, endDate, extras, deliveryType]);

  // Extras on an existing booking that were since removed from Settings can still be kept
  const extraOptions = [
    ...(settings?.extras ?? []),
    ...(booking?.extras ?? []).filter((e) => !settings?.extras.some((s) => s.id === e.id)),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!startDate || !endDate) { setError('Choose pick-up and return dates'); return; }
    if (endDate < startDate) { setError('Return date must be on or after the pick-up date'); return; }

    const body = {
      carId,
      guestName: guestName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      startDate,
      endDate,
      pickupTime,
      returnTime,
      deliveryType,
      deliveryAddress: deliveryType === 'delivery' ? deliveryAddress.trim() : null,
      extras,
      notes: notes.trim() || null,
      locale,
      ...(isEdit ? {} : { status }),
    };

    setSaving(true);
    try {
      const saved = await apiJSON<Booking>(isEdit ? `/bookings/${booking!.id}` : '/bookings', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="font-display text-xl font-bold text-brand-text">{isEdit ? `Edit ${booking!.reference}` : 'New booking'}</h3>

        <div>
          <label className={labelClass} htmlFor="be-car">Car *</label>
          <select id="be-car" value={carId} onChange={(e) => setCarId(Number(e.target.value))} className={inputClass}>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>{c.brand} {c.model} — {c.price} DT/day{c.available ? '' : ' (maintenance)'}</option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="be-name">Customer name *</label>
            <input id="be-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} required minLength={2} maxLength={100} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="be-phone">Phone *</label>
            <input id="be-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="be-email">Email</label>
            <input id="be-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelClass} htmlFor="be-start">Pick-up date *</label>
            <input id="be-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="be-ptime">Pick-up time</label>
            <select id="be-ptime" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={inputClass}>
              {[...new Set([pickupTime, ...TIME_SLOTS])].sort().map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="be-end">Return date *</label>
            <input id="be-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="be-rtime">Return time</label>
            <select id="be-rtime" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className={inputClass}>
              {[...new Set([returnTime, ...TIME_SLOTS])].sort().map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-[180px_1fr] gap-3">
          <div>
            <label className={labelClass} htmlFor="be-method">Method</label>
            <select id="be-method" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryType)} className={inputClass}>
              <option value="agency">At the agency</option>
              <option value="delivery">Delivery (+{settings?.deliveryFee ?? '…'} DT)</option>
            </select>
          </div>
          {deliveryType === 'delivery' && (
            <div>
              <label className={labelClass} htmlFor="be-address">Delivery address *</label>
              <input id="be-address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required maxLength={300} className={inputClass} />
            </div>
          )}
        </div>

        {extraOptions.length > 0 && (
          <fieldset>
            <legend className={labelClass}>Extras</legend>
            <div className="flex flex-wrap gap-2">
              {extraOptions.map((x) => (
                <label key={x.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${extras.includes(x.id) ? 'border-brand-red/50 bg-brand-red/5 text-brand-text' : 'border-white/10 text-brand-muted'}`}>
                  <input type="checkbox" className="accent-brand-red" checked={extras.includes(x.id)} onChange={() => setExtras((p) => (p.includes(x.id) ? p.filter((i) => i !== x.id) : [...p, x.id]))} />
                  {x.name} · {x.price} DT/{x.per}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div>
              <label className={labelClass} htmlFor="be-status">Status</label>
              <select id="be-status" value={status} onChange={(e) => setStatus(e.target.value as 'approved' | 'pending')} className={inputClass}>
                <option value="approved">Approved (confirmed now)</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          )}
            <div>
              <label className={labelClass} htmlFor="be-locale">Email language</label>
              <select id="be-locale" value={locale} onChange={(e) => setLocale(e.target.value)} className={inputClass}>
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="be-notes">Internal notes</label>
          <textarea id="be-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} className={`${inputClass} resize-none`} placeholder="Only visible to staff" />
        </div>

        {quote && (
          <div className="p-3 rounded-xl bg-brand-red/5 border border-brand-red/20 text-sm flex flex-wrap gap-x-6 gap-y-1 justify-between">
            <span className="text-brand-muted">{quote.days} day(s) × {quote.dailyRate} DT = {money(quote.subtotal)}</span>
            {quote.discount > 0 && <span className="text-green-400">−{money(quote.discount)} ({quote.discountPct}%)</span>}
            {quote.extrasTotal > 0 && <span className="text-brand-muted">Extras {money(quote.extrasTotal)}</span>}
            {quote.deliveryFee > 0 && <span className="text-brand-muted">Delivery {money(quote.deliveryFee)}</span>}
            <span className="font-bold text-brand-red">Total {money(quote.total)}</span>
          </div>
        )}
        {isEdit && <p className="text-xs text-brand-muted">The price is only recalculated if you change the car, dates, extras or delivery method.</p>}

        {error && <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-brand-text hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={saving || !carId} className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create booking'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
