import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiJSON, openAuthedPdf } from '../../services/api';
import { loadSettings } from '../../services/settings';
import { useToast } from '../../components/ui/Toast';
import CarOutline from '../../components/admin/CarOutline';
import SignaturePad from '../../components/admin/SignaturePad';
import type { Booking, BusinessSettings, Car, Damage, ExtraCharge, Inspection } from '../../types';
import { money } from '../../utils/format';

type Kind = 'checkout' | 'checkin';

const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-red/50';
const labelClass = 'block text-xs text-brand-muted mb-1.5';

function Step({ n, title, children, hint }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-4 sm:p-5">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-xs text-brand-red">{String(n).padStart(2, '0')}</span>
        <h2 className="font-semibold text-brand-text">{title}</h2>
      </div>
      {hint && <p className="text-xs text-brand-muted -mt-1 mb-3">{hint}</p>}
      {children}
    </section>
  );
}

export default function Handover() {
  const { id, type } = useParams();
  const kind: Kind = type === 'checkin' ? 'checkin' : 'checkout';
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [car, setCar] = useState<Car | null>(null);
  const [previous, setPrevious] = useState<Inspection | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false); // booking not in the right status for this step

  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [damages, setDamages] = useState<Damage[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState(8);
  const [notes, setNotes] = useState('');
  const [driver, setDriver] = useState({ idNumber: '', licenseNumber: '', birthDate: '', licenseIssueDate: '', licenseExpiry: '', customerAddress: '' });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ charges: ExtraCharge[]; emailed: boolean; booking: Booking } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const b = await apiJSON<Booking>(`/bookings/${id}`);
        const [c, inspections, s] = await Promise.all([
          apiJSON<Car>(`/cars/${b.carId}`),
          apiJSON<Inspection[]>(`/bookings/${id}/inspections`),
          loadSettings(true),
        ]);
        setBooking(b);
        setCar(c);
        setSettings(s);
        setSignerName(b.guestName);
        setDriver({
          idNumber: b.idNumber ?? '', licenseNumber: b.licenseNumber ?? '', birthDate: b.birthDate ?? '',
          licenseIssueDate: b.licenseIssueDate ?? '', licenseExpiry: b.licenseExpiry ?? '', customerAddress: b.customerAddress ?? '',
        });
        const out = inspections.find((i) => i.type === 'checkout') ?? null;
        setPrevious(out);
        if (kind === 'checkout') {
          setMileage(String(c.mileage || ''));
        } else if (out) {
          setMileage(String(out.mileage));
          setFuelLevel(out.fuelLevel);
          setDamages(out.damages.map((d) => ({ ...d })));
        }
        const expected = kind === 'checkout' ? 'approved' : 'picked_up';
        if (b.status !== expected) setBlocked(true);
        if (b.status !== expected) setError(kind === 'checkout' ? `This booking is ${b.status.replace('_', ' ')}: only an approved booking can be handed over.` : `This booking is ${b.status.replace('_', ' ')}: the car can only be returned after pick-up.`);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id, kind]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), [photos]);

  // What the return will cost, shown live so staff can tell the customer before they sign
  const estimate = useMemo(() => {
    if (kind !== 'checkin' || !previous || !settings || !booking) return [];
    const lines: { label: string; amount: number }[] = [];
    const days = Math.max(1, Math.round((Date.parse(`${booking.endDate}T00:00:00Z`) - Date.parse(`${booking.startDate}T00:00:00Z`)) / 86_400_000));
    const driven = Number(mileage) - previous.mileage;
    if (settings.kmPerDayIncluded > 0 && driven > settings.kmPerDayIncluded * days) {
      const over = driven - settings.kmPerDayIncluded * days;
      lines.push({ label: `${over} km over the ${settings.kmPerDayIncluded * days} km included`, amount: over * settings.extraKmPrice });
    }
    if (previous.fuelLevel > fuelLevel) {
      lines.push({ label: `Fuel: ${previous.fuelLevel - fuelLevel}/8 missing`, amount: (previous.fuelLevel - fuelLevel) * settings.fuelChargePerEighth });
    }
    return lines;
  }, [kind, previous, settings, booking, mileage, fuelLevel]);

  function addPhotos(files: FileList | null) {
    const picked = Array.from(files ?? []);
    setPhotos((prev) => [...prev, ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 16));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!booking) return;
    setError('');
    if (photos.length < 4) { setError('Take at least 4 photos: front, back and both sides.'); return; }
    if (!mileage || Number(mileage) < 0) { setError('Enter the mileage shown on the dashboard.'); return; }
    if (kind === 'checkin' && previous && Number(mileage) < previous.mileage) { setError(`Mileage can't be lower than at pick-up (${previous.mileage} km).`); return; }
    if (kind === 'checkout' && !termsAccepted) { setError('The customer must accept the rental conditions.'); return; }
    if (!signature) { setError('The customer must sign.'); return; }

    const fd = new FormData();
    fd.append('type', kind);
    fd.append('mileage', mileage);
    fd.append('fuelLevel', String(fuelLevel));
    fd.append('damages', JSON.stringify(damages));
    fd.append('notes', notes);
    fd.append('signerName', signerName.trim());
    fd.append('signature', signature);
    fd.append('sendEmail', String(sendEmail));
    if (kind === 'checkout') for (const [k, v] of Object.entries(driver)) fd.append(k, v.trim());
    photos.forEach((p) => fd.append('photos', p.file));

    setSaving(true);
    try {
      const res = await api(`/bookings/${booking.id}/inspections`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not save the inspection'); return; }
      setResult(data);
      window.scrollTo(0, 0);
    } catch {
      setError('Network error: nothing was saved, please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function openPdf(path: string) {
    try { await openAuthedPdf(path); } catch (e) { showToast((e as Error).message, 'error'); }
  }

  if (!booking || !car || !settings) {
    return error
      ? <div className="max-w-xl"><p className="text-red-400 mb-4">{error}</p><Link to="/admin/bookings" className="text-sm text-brand-red">← Bookings</Link></div>
      : <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>;
  }

  const title = kind === 'checkout' ? 'Pick-up' : 'Return';

  if (result) {
    const total = result.booking.total + result.booking.extraChargesTotal;
    return (
      <div className="max-w-xl space-y-5">
        <div className="glass-card p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-500/10 flex items-center justify-center text-2xl text-green-400">✓</div>
          <h1 className="font-display text-2xl font-bold text-brand-text">{kind === 'checkout' ? 'Car handed over' : 'Car returned'}</h1>
          <p className="text-sm text-brand-muted mt-1">{booking.reference} · {car.brand} {car.model} · {mileage} km</p>
          <p className="text-xs text-brand-muted mt-2">
            {result.emailed ? `${kind === 'checkout' ? 'The contract' : 'The return report'} was emailed to ${booking.email}.` : booking.email ? 'The email could not be sent; you can print the PDF instead.' : 'No email on this booking: print or share the PDF.'}
          </p>
        </div>
        {kind === 'checkin' && (
          <div className="glass-card p-5 text-sm space-y-1.5">
            <h2 className="font-semibold text-brand-text mb-2">Amount due</h2>
            <div className="flex justify-between text-brand-muted"><span>Rental</span><span>{money(result.booking.total)}</span></div>
            {result.booking.extraCharges.map((c, i) => <div key={i} className="flex justify-between text-brand-muted"><span>{c.label}</span><span>{money(c.amount)}</span></div>)}
            {result.booking.amountPaid > 0 && <div className="flex justify-between text-brand-muted"><span>Already paid</span><span>−{money(result.booking.amountPaid)}</span></div>}
            <div className="flex justify-between pt-2 border-t border-white/10 font-semibold text-brand-text"><span>Balance due</span><span className="text-brand-red">{money(Math.max(0, total - result.booking.amountPaid))}</span></div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openPdf(`/bookings/${booking.id}/contract.pdf`)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500">Open contract (PDF)</button>
          {kind === 'checkin' && <button onClick={() => openPdf(`/bookings/${booking.id}/return-report.pdf`)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-brand-text hover:bg-white/15">Open return report (PDF)</button>}
          <button onClick={() => navigate(`/admin/bookings?id=${booking.id}`)} className="px-4 py-2.5 rounded-xl text-sm text-brand-muted hover:text-brand-text hover:bg-white/5">Back to the booking</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4 pb-10">
      <div>
        <Link to={`/admin/bookings?id=${booking.id}`} className="text-xs text-brand-muted hover:text-brand-text">← {booking.reference}</Link>
        <h1 className="font-display text-2xl font-bold text-brand-text mt-1">{title}: {car.brand} {car.model}{car.plateNumber ? ` · ${car.plateNumber}` : ''}</h1>
        <p className="text-sm text-brand-muted">{booking.guestName} · {booking.phone} · {booking.startDate} {booking.pickupTime} → {booking.endDate} {booking.returnTime}</p>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {kind === 'checkin' && previous && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-brand-muted">
          At pick-up: <span className="text-brand-text">{previous.mileage.toLocaleString()} km</span> · fuel <span className="text-brand-text">{previous.fuelLevel}/8</span> · {previous.damages.length} damage mark(s) · by {previous.staffName} on {new Date(previous.createdAt).toLocaleString('en-GB')}
        </div>
      )}

      <Step n={1} title="Photos" hint="At least 4: front, back, left and right. Add close-ups of any damage.">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-brand-elevated">
              <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-sm leading-none">×</button>
            </div>
          ))}
          {photos.length < 16 && (
            <label className="aspect-[4/3] rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-brand-muted hover:border-brand-red/40 hover:text-brand-text cursor-pointer">
              <span className="text-2xl leading-none">+</span>
              <span className="text-[11px] mt-1">Take photo</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} aria-label="Add photos" />
            </label>
          )}
        </div>
        <p className={`text-xs mt-2 ${photos.length >= 4 ? 'text-green-400' : 'text-brand-muted'}`}>{photos.length} / 4 minimum</p>
      </Step>

      <Step n={2} title="Damage" hint={kind === 'checkin' ? 'Pick-up marks are pre-filled (dashed = where they were). Tap the car to add any new damage.' : 'Tap the car where each scratch or dent is, then describe it.'}>
        <div className="grid sm:grid-cols-[200px_1fr] gap-5 items-start">
          <CarOutline
            className="w-44 sm:w-full mx-auto mt-4"
            damages={damages}
            ghost={kind === 'checkin' ? previous?.damages ?? [] : []}
            selected={selected}
            onSelect={setSelected}
            onAdd={(p) => { setDamages((d) => [...d, { ...p, note: '' }]); setSelected(damages.length); }}
          />
          <div className="space-y-2">
            {damages.length === 0 && <p className="text-sm text-brand-muted">No damage marked.</p>}
            {damages.map((d, i) => (
              <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg ${selected === i ? 'bg-white/5' : ''}`}>
                <span className="w-6 h-6 flex-shrink-0 rounded-full bg-brand-red text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <input
                  value={d.note ?? ''}
                  onFocus={() => setSelected(i)}
                  onChange={(e) => setDamages((prev) => prev.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                  placeholder="e.g. scratch on rear bumper"
                  maxLength={200}
                  className={inputClass}
                  aria-label={`Damage ${i + 1} description`}
                />
                <button type="button" onClick={() => { setDamages((prev) => prev.filter((_, j) => j !== i)); setSelected(null); }} className="px-2 text-brand-muted hover:text-red-400" aria-label={`Remove damage ${i + 1}`}>×</button>
              </div>
            ))}
          </div>
        </div>
      </Step>

      <Step n={3} title="Mileage and fuel">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="mileage">Odometer (km) *</label>
            <input id="mileage" type="number" inputMode="numeric" min={kind === 'checkin' ? previous?.mileage : 0} value={mileage} onChange={(e) => setMileage(e.target.value)} required className={inputClass} />
            {kind === 'checkin' && previous && Number(mileage) >= previous.mileage && (
              <p className="text-xs text-brand-muted mt-1">{(Number(mileage) - previous.mileage).toLocaleString()} km driven</p>
            )}
          </div>
          <div>
            <p className={labelClass}>Fuel level: {fuelLevel}/8</p>
            <div className="flex gap-1" role="radiogroup" aria-label="Fuel level in eighths">
              {Array.from({ length: 9 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={fuelLevel === n}
                  aria-label={`${n} eighths`}
                  onClick={() => setFuelLevel(n)}
                  className={`flex-1 h-10 rounded-md text-[11px] font-semibold ${n === 0 ? 'text-red-400' : ''} ${n <= fuelLevel && n > 0 ? 'bg-brand-red text-white' : 'bg-white/5 text-brand-muted'} ${fuelLevel === n ? 'ring-2 ring-white/60' : ''}`}
                >
                  {n === 0 ? 'E' : n === 8 ? 'F' : n}
                </button>
              ))}
            </div>
          </div>
        </div>
        {estimate.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-sm">
            <p className="text-yellow-300 text-xs font-semibold mb-1">Charges so far (late return is added automatically if it applies)</p>
            {estimate.map((l) => <div key={l.label} className="flex justify-between text-brand-muted"><span>{l.label}</span><span>{money(l.amount)}</span></div>)}
          </div>
        )}
      </Step>

      {kind === 'checkout' && (
        <Step n={4} title="Driver" hint={`Printed on the contract. Minimum age ${settings.minDriverAge}, licence held ${settings.minLicenseYears} year(s).`}>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ['idNumber', 'CIN / passport number', 'text'],
              ['licenseNumber', 'Driving licence number', 'text'],
              ['birthDate', 'Date of birth', 'date'],
              ['licenseIssueDate', 'Licence issued on', 'date'],
              ['licenseExpiry', 'Licence valid until', 'date'],
              ['customerAddress', 'Address', 'text'],
            ] as const).map(([key, label, t]) => (
              <div key={key}>
                <label className={labelClass} htmlFor={`d-${key}`}>{label}</label>
                <input id={`d-${key}`} type={t} value={driver[key]} onChange={(e) => setDriver({ ...driver, [key]: e.target.value })} className={inputClass} />
              </div>
            ))}
          </div>
        </Step>
      )}

      <Step n={kind === 'checkout' ? 5 : 4} title="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} placeholder="Anything else: accessories, cleanliness, spare key..." className={`${inputClass} resize-none`} aria-label="Notes" />
      </Step>

      <Step n={kind === 'checkout' ? 6 : 5} title="Customer signature">
        {kind === 'checkout' && (
          <details className="mb-3 rounded-xl bg-white/[0.03] border border-white/10 p-3 text-xs text-brand-muted">
            <summary className="cursor-pointer text-brand-text">Rental conditions ({settings.contractTerms.split('\n').filter((l) => l.trim()).length})</summary>
            <ol className="list-decimal ps-5 mt-2 space-y-1">
              {settings.contractTerms.split('\n').filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}
            </ol>
          </details>
        )}
        {kind === 'checkout' && (
          <label className="flex items-start gap-2 mb-3 text-sm text-brand-text cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 accent-brand-red" />
            The customer has read and accepts the rental conditions and the condition of the car above.
          </label>
        )}
        <div className="mb-3">
          <label className={labelClass} htmlFor="signer">Signed by *</label>
          <input id="signer" value={signerName} onChange={(e) => setSignerName(e.target.value)} required minLength={2} maxLength={100} className={inputClass} />
        </div>
        <SignaturePad onChange={setSignature} />
        {booking.email && (
          <label className="flex items-center gap-2 mt-3 text-sm text-brand-muted cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-brand-red" />
            Email the {kind === 'checkout' ? 'contract' : 'return report'} to {booking.email}
          </label>
        )}
      </Step>

      <button type="submit" disabled={saving || blocked} className="w-full py-3.5 rounded-xl font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50">
        {saving ? 'Saving and uploading photos...' : kind === 'checkout' ? 'Confirm pick-up' : 'Confirm return'}
      </button>
    </form>
  );
}
