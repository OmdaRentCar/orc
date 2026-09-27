import { FormEvent, useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import { loadSettings } from '../../services/settings';
import { useToast } from '../../components/ui/Toast';
import type { BusinessSettings, Extra, Season } from '../../types';

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

      <fieldset className="rounded-xl border border-white/10 p-4 space-y-3">
        <legend className="px-1 text-sm font-semibold text-brand-text">Pricing by date</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="bs-weekend">Weekend days (Sat, Sun): +%</label>
            <input id="bs-weekend" type="number" min={-90} max={300} value={s.weekendPct} onChange={num('weekendPct')} className={inputClass} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={labelClass}>Seasons (each day of a rental is priced at its own season)</p>
            <button type="button" onClick={() => setSettings({ ...s, seasons: [...s.seasons, { name: 'Summer', from: '07-01', to: '08-31', pct: 20 }] })} disabled={s.seasons.length >= 12} className="text-xs text-brand-red hover:underline disabled:opacity-40">+ Add season</button>
          </div>
          {s.seasons.length === 0 && <p className="text-xs text-brand-muted">No seasons: the same price all year.</p>}
          <div className="space-y-2">
            {s.seasons.map((season, i) => {
              const update = (patch: Partial<Season>) => setSettings({ ...s, seasons: s.seasons.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} className="grid grid-cols-[1fr_90px_90px_90px_auto] gap-2 items-center">
                  <input value={season.name} onChange={(e) => update({ name: e.target.value })} required maxLength={40} aria-label="Season name" className={inputClass} />
                  <input value={season.from} onChange={(e) => update({ from: e.target.value })} required pattern="(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])" placeholder="MM-DD" aria-label="From (MM-DD)" className={inputClass} />
                  <input value={season.to} onChange={(e) => update({ to: e.target.value })} required pattern="(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])" placeholder="MM-DD" aria-label="To (MM-DD)" className={inputClass} />
                  <input type="number" min={-90} max={300} value={season.pct} onChange={(e) => update({ pct: Number(e.target.value) })} aria-label="Percent change" className={inputClass} />
                  <button type="button" onClick={() => setSettings({ ...s, seasons: s.seasons.filter((_, j) => j !== i) })} aria-label={`Remove ${season.name}`} className="px-3 text-brand-muted hover:text-red-400">×</button>
                </div>
              );
            })}
          </div>
          {s.seasons.length > 0 && <p className="text-[11px] text-brand-muted mt-1">Dates as MM-DD (07-01 = 1 July). % can be negative for low season.</p>}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-white/10 p-4">
        <legend className="px-1 text-sm font-semibold text-brand-text">Pick-up and return</legend>
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className={labelClass} htmlFor="bs-km">Km included / day (0 = unlimited)</label>
            <input id="bs-km" type="number" min={0} value={s.kmPerDayIncluded} onChange={num('kmPerDayIncluded')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bs-xkm">Price per extra km (DT)</label>
            <input id="bs-xkm" type="number" min={0} step="0.05" value={s.extraKmPrice} onChange={num('extraKmPrice')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bs-fuel">Per missing ⅛ of fuel (DT)</label>
            <input id="bs-fuel" type="number" min={0} step="0.5" value={s.fuelChargePerEighth} onChange={num('fuelChargePerEighth')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bs-grace">Late return tolerance (hours)</label>
            <input id="bs-grace" type="number" min={0} max={48} step="0.5" value={s.lateGraceHours} onChange={num('lateGraceHours')} className={inputClass} />
          </div>
        </div>
        <p className="text-[11px] text-brand-muted mt-2">Charged automatically at return. A late return costs one day of rental for each started day.</p>
      </fieldset>

      <fieldset className="rounded-xl border border-white/10 p-4">
        <legend className="px-1 text-sm font-semibold text-brand-text">Driver requirements</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="bs-age">Minimum age</label>
            <input id="bs-age" type="number" min={16} max={99} value={s.minDriverAge} onChange={num('minDriverAge')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bs-lic">Minimum years with a licence</label>
            <input id="bs-lic" type="number" min={0} max={50} value={s.minLicenseYears} onChange={num('minLicenseYears')} className={inputClass} />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-white/10 p-4 space-y-3">
        <legend className="px-1 text-sm font-semibold text-brand-text">Rental contract</legend>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="bs-cname">Company name</label>
            <input id="bs-cname" value={s.companyName} onChange={text('companyName')} maxLength={120} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bs-caddr">Address</label>
            <input id="bs-caddr" value={s.companyAddress} onChange={text('companyAddress')} maxLength={300} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bs-mf">Tax ID (matricule fiscal)</label>
            <input id="bs-mf" value={s.companyTaxId} onChange={text('companyTaxId')} maxLength={60} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="bs-terms">Conditions printed on the contract (one per line)</label>
          <textarea id="bs-terms" value={s.contractTerms} onChange={(e) => setSettings({ ...s, contractTerms: e.target.value })} rows={7} maxLength={5000} className={`${inputClass} font-mono text-xs leading-relaxed`} />
        </div>
      </fieldset>

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
