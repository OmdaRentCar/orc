import { FormEvent, useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import { loadSettings } from '../../services/settings';
import { useToast } from '../../components/ui/Toast';
import type { BusinessSettings, Extra } from '../../types';

const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50';
const labelClass = 'block text-xs font-medium text-brand-muted mb-1.5';

function slug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'extra';
}

// Owner-only: prices, discounts, extras and contact details used by the public site
export default function BusinessSettingsForm() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings(true).then(setSettings).catch(() => showToast('Failed to load business settings', 'error'));
  }, [showToast]);

  if (!settings) return null;
  const s = settings;

  const num = (key: keyof BusinessSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings({ ...s, [key]: e.target.value === '' ? 0 : Number(e.target.value) });
  const text = (key: keyof BusinessSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings({ ...s, [key]: e.target.value });

  function updateExtra(index: number, patch: Partial<Extra>) {
    setSettings({ ...s, extras: s.extras.map((x, i) => (i === index ? { ...x, ...patch } : x)) });
  }

  function addExtra() {
    let id = 'new-extra';
    for (let n = 2; s.extras.some((x) => x.id === id); n++) id = `new-extra-${n}`;
    setSettings({ ...s, extras: [...s.extras, { id, name: '', price: 0, per: 'day' }] });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    // New extras get their id from their name; existing ids stay, so old bookings still match
    const extras = s.extras.map((x) => (x.id.startsWith('new-extra') ? { ...x, id: slug(x.name) } : x));
    setSaving(true);
    try {
      const saved = await apiJSON<BusinessSettings>('/settings', { method: 'PUT', body: JSON.stringify({ ...s, extras }) });
      setSettings(saved);
      await loadSettings(true);
      showToast('Business settings saved', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-brand-surface border border-white/5 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-sm font-semibold text-brand-text">Business settings</p>
        <p className="text-xs text-brand-muted mt-1">Used for every new booking. Existing bookings keep the price they were made at.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="bs-delivery">Delivery fee (DT)</label>
          <input id="bs-delivery" type="number" min={0} step="0.5" value={s.deliveryFee} onChange={num('deliveryFee')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bs-deposit">Refundable deposit (DT)</label>
          <input id="bs-deposit" type="number" min={0} step="10" value={s.depositAmount} onChange={num('depositAmount')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bs-weekly">Discount for 7+ days (%)</label>
          <input id="bs-weekly" type="number" min={0} max={90} value={s.weeklyDiscountPct} onChange={num('weeklyDiscountPct')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bs-monthly">Discount for 30+ days (%)</label>
          <input id="bs-monthly" type="number" min={0} max={90} value={s.monthlyDiscountPct} onChange={num('monthlyDiscountPct')} className={inputClass} />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="bs-email">Contact email (site footer)</label>
          <input id="bs-email" type="email" value={s.contactEmail} onChange={text('contactEmail')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bs-phone">Contact phone</label>
          <input id="bs-phone" value={s.contactPhone} onChange={text('contactPhone')} placeholder="+216 12 345 678" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bs-wa">WhatsApp number</label>
          <input id="bs-wa" value={s.whatsappNumber} onChange={(e) => setSettings({ ...s, whatsappNumber: e.target.value.replace(/[^\d+]/g, '') })} placeholder="21612345678" className={inputClass} />
          <p className="text-[11px] text-brand-muted mt-1">Shows the chat button on the site. Leave empty to hide it.</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={labelClass}>Extras customers can add</p>
          <button type="button" onClick={addExtra} disabled={s.extras.length >= 20} className="text-xs text-brand-red hover:underline disabled:opacity-40">+ Add extra</button>
        </div>
        <div className="space-y-2">
          {s.extras.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_120px_auto] gap-2">
              <input value={x.name} onChange={(e) => updateExtra(i, { name: e.target.value })} placeholder="Name, e.g. Child seat" required maxLength={60} className={inputClass} aria-label="Extra name" />
              <input type="number" min={0} step="0.5" value={x.price} onChange={(e) => updateExtra(i, { price: Number(e.target.value) })} className={inputClass} aria-label="Price (DT)" />
              <select value={x.per} onChange={(e) => updateExtra(i, { per: e.target.value as Extra['per'] })} className={inputClass} aria-label="Charged per">
                <option value="day">per day</option>
                <option value="booking">per booking</option>
              </select>
              <button type="button" onClick={() => setSettings({ ...s, extras: s.extras.filter((_, j) => j !== i) })} aria-label={`Remove ${x.name || 'extra'}`} className="px-3 rounded-xl text-brand-muted hover:text-red-400 hover:bg-red-500/5">×</button>
            </div>
          ))}
          {s.extras.length === 0 && <p className="text-xs text-brand-muted">No extras offered.</p>}
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full bg-brand-red hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
        {saving ? 'Saving...' : 'Save business settings'}
      </button>
    </form>
  );
}
