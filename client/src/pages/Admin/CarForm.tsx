import { useState, useRef, FormEvent } from 'react';
import type { Car } from '../../types';
import { api } from '../../services/api';

interface Props {
  car: Partial<Car> | null;
  onSave: () => void;
  onCancel: () => void;
}

const TYPES = ['Sports', 'SUV', 'Electric', 'Sedan', 'Convertible'];
const FUELS = ['Petrol', 'Electric', 'Hybrid', 'Diesel'];
const TRANSMISSIONS = ['Auto', 'Manual', 'PDK', 'DCT'];

export default function CarForm({ car, onSave, onCancel }: Props) {
  const isEdit = !!car?.id;
  const [brand, setBrand] = useState(car?.brand ?? '');
  const [model, setModel] = useState(car?.model ?? '');
  const [type, setType] = useState(car?.type ?? 'Sports');
  const [year, setYear] = useState(String(car?.year ?? new Date().getFullYear()));
  const [price, setPrice] = useState(String(car?.price ?? ''));
  const [seats, setSeats] = useState(String(car?.seats ?? 5));
  const [fuel, setFuel] = useState(car?.fuel ?? 'Petrol');
  const [transmission, setTransmission] = useState(car?.transmission ?? 'Auto');
  const [description, setDescription] = useState(car?.description ?? '');
  const [features, setFeatures] = useState((car?.features ?? []).join(', '));
  const [available, setAvailable] = useState(car?.available ?? true);
  const [imageUrl, setImageUrl] = useState(car?.image ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!brand || !model || !price) { setError('Brand, model and price are required'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('brand', brand);
      fd.append('model', model);
      fd.append('type', type);
      fd.append('year', year);
      fd.append('price', price);
      fd.append('seats', seats);
      fd.append('fuel', fuel);
      fd.append('transmission', transmission);
      fd.append('description', description);
      fd.append('features', features);
      fd.append('available', String(available));

      if (imageFile) {
        fd.append('image', imageFile);
      } else if (imageUrl !== car?.image) {
        fd.append('image', imageUrl);
      }

      const endpoint = isEdit ? `/cars/${car!.id}` : '/cars';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await api(endpoint, { method, body: fd });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Save failed');
        return;
      }
      onSave();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const labelClass = 'block text-xs text-brand-muted mb-1.5';
  const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors';
  const selectClass = `${inputClass}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-display text-xl font-bold text-brand-text mb-2">{isEdit ? 'Edit Car' : 'Add Car'}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Brand *</label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} required className={inputClass} placeholder="BMW" />
        </div>
        <div>
          <label className={labelClass}>Model *</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} required className={inputClass} placeholder="M4 Competition" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Year</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} min={2000} max={2030} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Price/day ($) *</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min={1} required className={inputClass} placeholder="299" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Seats</label>
          <input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} min={1} max={12} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fuel</label>
          <select value={fuel} onChange={(e) => setFuel(e.target.value)} className={selectClass}>
            {FUELS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Transmission</label>
          <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={selectClass}>
            {TRANSMISSIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Short description..." />
      </div>

      <div>
        <label className={labelClass}>Features (comma-separated)</label>
        <input value={features} onChange={(e) => setFeatures(e.target.value)} className={inputClass} placeholder="Autopilot, Glass Roof, 17&quot; Display" />
      </div>

      <div>
        <label className={labelClass}>Car Image</label>
        {!imageFile && (
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={`${inputClass} mb-2`} placeholder="https://... or upload below" />
        )}
        <div
          className="border border-dashed border-white/15 rounded-xl p-3 text-center cursor-pointer hover:border-brand-red/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setImageUrl(''); }} />
          {imageFile ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-text">{imageFile.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setImageFile(null); }} className="text-brand-muted hover:text-red-400 text-xs">Remove</button>
            </div>
          ) : (
            <p className="text-xs text-brand-muted">Click to upload image (JPG, PNG, WebP)</p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="w-4 h-4 accent-brand-red" />
        <span className="text-sm text-brand-muted">Available for booking</span>
      </label>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-brand-text hover:bg-white/5 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50 transition-colors">
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Car'}
        </button>
      </div>
    </form>
  );
}
