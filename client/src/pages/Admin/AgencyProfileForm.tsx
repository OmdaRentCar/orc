import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAgency } from '../../context/AgencyContext';
import { useToast } from '../../components/ui/Toast';

const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50';
const labelClass = 'block text-xs font-medium text-brand-muted mb-1.5';

// Owner-only: the agency's name, logo and colour, shown on its site, dashboard, emails and contracts
export default function AgencyProfileForm() {
  const { agency, refresh } = useAgency();
  const { showToast } = useToast();
  const [name, setName] = useState(agency.name);
  const [color, setColor] = useState(agency.primaryColor);
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [city, setCity] = useState(agency.city ?? '');
  const [listed, setListed] = useState(agency.listed);
  const [saving, setSaving] = useState(false);
  const preview = logo ? URL.createObjectURL(logo) : removeLogo ? null : agency.logoUrl;

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = new FormData();
    body.set('name', name.trim());
    body.set('primaryColor', color);
    body.set('city', city.trim());
    body.set('listed', String(listed));
    if (logo) body.set('logo', logo);
    else if (removeLogo) body.set('removeLogo', 'true');
    setSaving(true);
    try {
      const res = await api('/agency', { method: 'PUT', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save');
      await refresh();
      setLogo(null);
      setRemoveLogo(false);
      showToast('Agency profile saved', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-brand-surface border border-white/5 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-sm font-semibold text-brand-text">Agency profile</p>
        <p className="text-xs text-brand-muted mt-1">
          Your brand on your site, dashboard, emails and contracts. Your site:{' '}
          <a href={agency.siteUrl} target="_blank" rel="noreferrer" className="text-brand-red hover:underline" dir="ltr">{agency.siteUrl.replace(/^https?:\/\//, '')}</a>
        </p>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-4">
        <div>
          <label className={labelClass}>Agency name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Main colour</label>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
            <input value={color} onChange={(e) => setColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" className={`${inputClass} w-28 font-mono`} dir="ltr" />
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 items-end">
        <div>
          <label className={labelClass}>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Tunis" className={inputClass} />
        </div>
        <label className="flex items-center gap-3 text-sm text-brand-text cursor-pointer pb-2">
          <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} className="accent-brand-red w-4 h-4" />
          <span>Show my agency in the directory on the <a href={`${agency.platform.url}/#section-agencies`} target="_blank" rel="noreferrer" className="text-brand-red hover:underline">{agency.platform.name} home page</a></span>
        </label>
      </div>

      <div>
        <label className={labelClass}>Logo (JPG, PNG, WebP or SVG, max 2 MB)</label>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
            {preview ? <img src={preview} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-brand-muted">No logo</span>}
          </div>
          <label className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-brand-text cursor-pointer hover:bg-white/10">
            Choose a file
            <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
              onChange={(e) => { setLogo(e.target.files?.[0] ?? null); setRemoveLogo(false); e.target.value = ''; }} />
          </label>
          {(logo || (agency.logoUrl && !removeLogo)) && (
            <button type="button" onClick={() => { setLogo(null); setRemoveLogo(!!agency.logoUrl); }} className="text-xs text-brand-muted hover:text-red-400">Remove</button>
          )}
        </div>
      </div>

      {/* Live preview of the brand mark */}
      <div className="rounded-xl bg-black/30 border border-white/5 px-4 py-3 flex items-center justify-between">
        <span className="font-display font-extrabold text-xl text-brand-text">
          {preview && <img src={preview} alt="" className="inline-block h-[1.1em] me-2 align-[-0.15em] rounded" />}
          {name || 'Agency'}<span style={{ color }}>.</span>
        </span>
        <span className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: color }}>Book now</span>
      </div>

      <button type="submit" disabled={saving} className="w-full bg-brand-red hover:opacity-90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">
        {saving ? 'Saving...' : 'Save agency profile'}
      </button>
    </form>
  );
}
