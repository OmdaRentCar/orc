import { useState, useEffect, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import type { Car, Booking } from '../../types';
import { apiJSON, api } from '../../services/api';

interface Props {
  car: Car | null;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function BookingModal({ car, onClose, onSuccess }: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [bookedRanges, setBookedRanges] = useState<{ startDate: string; endDate: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!car) return;
    setStartDate('');
    setEndDate('');
    setName('');
    setPhone('');
    setEmail('');
    setFile(null);
    setError('');
    setSuccess(false);
    apiJSON<Pick<Booking, 'startDate' | 'endDate'>[]>(`/bookings/car/${car.id}`)
      .then(setBookedRanges)
      .catch(() => {});
  }, [car]);

  const days = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    : 0;

  const total = car ? days * car.price : 0;

  function isDateConflict(start: string, end: string): boolean {
    return bookedRanges.some((r) => r.startDate <= end && r.endDate >= start);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!car) return;
    if (!name.trim() || name.trim().length < 2) { setError('Name must be at least 2 characters'); return; }
    if (!phone.trim() || !/^\+?[\d\s\-()]{7,}$/.test(phone)) { setError('Enter a valid phone number'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    if (!startDate || !endDate) { setError('Select pick-up and return dates'); return; }
    if (endDate < startDate) { setError('Return date must be after pick-up date'); return; }
    if (isDateConflict(startDate, endDate)) { setError('These dates are already booked'); return; }
    if (file && file.size > MAX_FILE_SIZE) { setError('Document must be under 5 MB'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('car_id', String(car.id));
      fd.append('guest_name', name.trim());
      fd.append('phone', phone.trim());
      if (email) fd.append('email', email.trim());
      fd.append('start_date', startDate);
      fd.append('end_date', endDate);
      if (file) fd.append('document', file);

      const res = await api('/bookings/public', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Booking failed');
        return;
      }
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2500);
    } catch {
      setError('Network error, please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!car} onClose={onClose} maxWidth="max-w-2xl">
      {!car ? null : success ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="font-display text-2xl font-bold text-green-400 mb-2">Booking Submitted!</h3>
          <p className="text-brand-muted">Your request is pending approval. We'll contact you shortly.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-6">
            {car.image && (
              <img src={car.image} alt={car.model} className="w-28 h-20 rounded-xl object-cover flex-shrink-0" />
            )}
            <div>
              <p className="text-xs text-brand-muted">{car.brand}</p>
              <h3 className="font-display text-xl font-bold text-brand-text">{car.model}</h3>
              <p className="text-brand-red font-bold text-lg">{car.price} DT<span className="text-brand-muted text-sm font-normal">/day</span></p>
            </div>
          </div>

          {car.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {car.features.map((f) => (
                <span key={f} className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-brand-muted border border-white/5">{f}</span>
              ))}
            </div>
          )}

          {bookedRanges.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
              <p className="text-xs text-yellow-400 font-medium mb-1">⚠ Already booked dates:</p>
              <div className="flex flex-wrap gap-2">
                {bookedRanges.map((r, i) => (
                  <span key={i} className="text-xs text-brand-muted">{r.startDate} → {r.endDate}</span>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Pick-up Date *</label>
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Return Date *</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || today}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors"
                />
              </div>
            </div>

            {days > 0 && (
              <div className="p-3 rounded-xl bg-brand-red/5 border border-brand-red/20 flex justify-between items-center">
                <span className="text-sm text-brand-muted">{days} day{days > 1 ? 's' : ''} × {car.price} DT</span>
                <span className="font-display text-xl font-bold text-brand-red">{total.toFixed(0)} DT</span>
              </div>
            )}

            <div>
              <label className="block text-xs text-brand-muted mb-1.5">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Phone *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  required
                  className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-brand-muted mb-1.5">ID / License (optional, max 5 MB)</label>
              <div
                className="border border-dashed border-white/15 rounded-xl p-4 text-center cursor-pointer hover:border-brand-red/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="text-sm text-brand-text">{file.name}</p>
                ) : (
                  <p className="text-sm text-brand-muted">Click to upload JPG, PNG, or PDF</p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !car.available}
              className="w-full py-3 rounded-xl font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Submitting...' : 'Confirm Booking'}
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
