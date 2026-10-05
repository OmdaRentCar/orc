import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import DateRangeCalendar from '../../components/public/DateRangeCalendar';
import Turnstile, { TURNSTILE_SITE_KEY } from '../../components/public/Turnstile';
import type { Car, Booking, DeliveryType, Quote } from '../../types';
import { apiJSON, api } from '../../services/api';
import { useBusinessSettings } from '../../services/settings';
import { useI18n, LANGS, Lang } from '../../i18n';
import { fullYears, localTodayISO, TIME_SLOTS } from '../../utils/format';

interface Props {
  car: Car | null;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50 transition-colors';
const labelClass = 'block text-xs text-brand-muted mb-1.5';

export default function BookingModal({ car, onClose, onSuccess }: Props) {
  const { t, lang, formatDate, money } = useI18n();
  const settings = useBusinessSettings();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [returnTime, setReturnTime] = useState('10:00');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('agency');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [licenseDate, setLicenseDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [emailLang, setEmailLang] = useState<Lang>(lang);
  const [bookedRanges, setBookedRanges] = useState<{ startDate: string; endDate: string }[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const today = localTodayISO();

  useEffect(() => {
    if (!car) return;
    // Dates can arrive in the address (?start=...&end=...)
    const params = new URLSearchParams(window.location.search);
    const wanted = (k: string) => { const v = params.get(k) ?? ''; return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= localTodayISO() ? v : ''; };
    setStartDate(wanted('start'));
    setEndDate(wanted('start') ? wanted('end') : '');
    setPickupTime('10:00');
    setReturnTime('10:00');
    setDeliveryType('agency');
    setDeliveryAddress('');
    setExtras([]);
    setName('');
    setPhone('');
    setEmail('');
    setBirthDate('');
    setLicenseDate('');
    setFile(null);
    setError('');
    setReference('');
    setQuote(null);
    setEmailLang(lang);
    apiJSON<Pick<Booking, 'startDate' | 'endDate'>[]>(`/bookings/car/${car.id}`)
      .then(setBookedRanges)
      .catch(() => setBookedRanges([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car]);

  // Follows the site language until the customer picks another one for emails
  useEffect(() => { setEmailLang(lang); }, [lang]);

  // Prices always come from the server, so the customer sees exactly what will be charged
  useEffect(() => {
    if (!car || !startDate || !endDate) { setQuote(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiJSON<Quote>('/bookings/quote', {
        method: 'POST',
        body: JSON.stringify({ carId: car.id, startDate, endDate, extras, deliveryType }),
        signal: controller.signal,
      }).then(setQuote).catch(() => {});
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [car, startDate, endDate, extras, deliveryType]);

  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  function toggleExtra(id: string) {
    setExtras((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!car) return;
    if (!startDate || !endDate) { setError(t('booking.errors.dates')); return; }
    if (name.trim().length < 2) { setError(t('booking.errors.name')); return; }
    if (!/^\+?[\d\s\-()]{7,20}$/.test(phone.trim())) { setError(t('booking.errors.phone')); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t('booking.errors.email')); return; }
    if (!birthDate) { setError(t('booking.errors.birthDate')); return; }
    if (!licenseDate) { setError(t('booking.errors.licenseDate')); return; }
    if (settings && fullYears(birthDate, startDate) < settings.minDriverAge) { setError(t('booking.errors.tooYoung', { age: settings.minDriverAge })); return; }
    if (settings && fullYears(licenseDate, startDate) < settings.minLicenseYears) { setError(t('booking.errors.licenseTooRecent', { years: settings.minLicenseYears })); return; }
    if (deliveryType === 'delivery' && !deliveryAddress.trim()) { setError(t('booking.errors.address')); return; }
    if (file && file.size > MAX_FILE_SIZE) { setError(t('booking.errors.fileSize')); return; }
    if (TURNSTILE_SITE_KEY && !captchaToken) { setError(t('booking.errors.captcha')); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('car_id', String(car.id));
      fd.append('guest_name', name.trim());
      fd.append('phone', phone.trim());
      if (email) fd.append('email', email.trim());
      fd.append('start_date', startDate);
      fd.append('end_date', endDate);
      fd.append('pickup_time', pickupTime);
      fd.append('return_time', returnTime);
      fd.append('delivery_type', deliveryType);
      if (deliveryType === 'delivery') fd.append('delivery_address', deliveryAddress.trim());
      fd.append('extras', extras.join(','));
      fd.append('locale', emailLang);
      fd.append('birth_date', birthDate);
      fd.append('license_issue_date', licenseDate);
      if (file) fd.append('document', file);

      const res = await api('/bookings/public', {
        method: 'POST',
        body: fd,
        headers: captchaToken ? { 'X-Captcha-Token': captchaToken } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('booking.errors.failed'));
        return;
      }
      setReference(data.reference);
      onSuccess();
    } catch {
      setError(t('booking.errors.network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!car} onClose={onClose} maxWidth="max-w-2xl">
      {!car ? null : reference ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center text-3xl text-green-400">✓</div>
          <h3 className="font-display text-2xl font-bold text-green-400 mb-2">{t('booking.successTitle')}</h3>
          <p className="text-brand-muted mb-6">{t('booking.successText')}</p>
          <div className="inline-block px-6 py-4 rounded-xl bg-white/5 border border-white/10 mb-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-brand-muted mb-1">{t('booking.yourReference')}</p>
            <p className="font-display text-3xl font-bold tracking-[0.1em] text-brand-text" dir="ltr">{reference}</p>
          </div>
          <p className="text-xs text-brand-muted mb-6">{t('booking.keepReference')}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to={`/booking-status?ref=${encodeURIComponent(reference)}`}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500 transition-colors"
            >
              {t('booking.checkStatus')}
            </Link>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-brand-muted hover:text-brand-text hover:bg-white/5 transition-colors">
              {t('booking.close')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-6 pe-8">
            {car.image && <img src={car.image} alt={car.model} className="w-28 h-20 rounded-xl object-cover flex-shrink-0" />}
            <div>
              <p className="text-xs text-brand-muted"><bdi>{car.brand}</bdi></p>
              <h3 className="font-display text-xl font-bold text-brand-text"><bdi>{car.model}</bdi></h3>
              <p className="text-brand-red font-bold text-lg">{money(car.price)}<span className="text-brand-muted text-sm font-normal">{t('booking.perDay')}</span></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className={labelClass}>{t('booking.chooseDates')} *</p>
              <DateRangeCalendar
                booked={bookedRanges}
                start={startDate}
                end={endDate}
                minDate={today}
                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              />
              {startDate && (
                <p className="mt-2 text-sm text-brand-text">
                  {t('booking.pickupDate')}: <strong>{formatDate(startDate)}</strong>
                  {endDate && <> · {t('booking.returnDate')}: <strong>{formatDate(endDate)}</strong></>}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="pickup-time">{t('booking.pickupTime')}</label>
                <select id="pickup-time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={inputClass} dir="ltr">
                  {TIME_SLOTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="return-time">{t('booking.returnTime')}</label>
                <select id="return-time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className={inputClass} dir="ltr">
                  {TIME_SLOTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <fieldset>
              <legend className={labelClass}>{t('booking.method')}</legend>
              <div className="grid sm:grid-cols-2 gap-2">
                {(['agency', 'delivery'] as const).map((type) => (
                  <label
                    key={type}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${deliveryType === type ? 'border-brand-red/50 bg-brand-red/5 text-brand-text' : 'border-white/10 text-brand-muted hover:border-white/20'}`}
                  >
                    <input type="radio" name="delivery" checked={deliveryType === type} onChange={() => setDeliveryType(type)} className="accent-brand-red" />
                    {type === 'agency' ? t('booking.agency') : t('booking.delivery', { fee: settings?.deliveryFee ?? '…' })}
                  </label>
                ))}
              </div>
              {deliveryType === 'delivery' && (
                <div className="mt-3">
                  <label className={labelClass} htmlFor="delivery-address">{t('booking.address')} *</label>
                  <input id="delivery-address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder={t('booking.addressPlaceholder')} maxLength={300} className={inputClass} />
                </div>
              )}
            </fieldset>

            {settings && settings.extras.length > 0 && (
              <fieldset>
                <legend className={labelClass}>{t('booking.extras')}</legend>
                <div className="grid sm:grid-cols-2 gap-2">
                  {settings.extras.map((extra) => (
                    <label
                      key={extra.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${extras.includes(extra.id) ? 'border-brand-red/50 bg-brand-red/5 text-brand-text' : 'border-white/10 text-brand-muted hover:border-white/20'}`}
                    >
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={extras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} className="accent-brand-red" />
                        {extra.name}
                      </span>
                      <span className="text-xs whitespace-nowrap">{money(extra.price)}{extra.per === 'day' ? t('booking.perDay') : t('booking.perBooking')}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {quote && (
              <div className="p-4 rounded-xl bg-brand-red/5 border border-brand-red/20 space-y-1.5 text-sm">
                {quote.lines.map((line) => (
                  <div key={`${line.rate}-${line.label}`} className="flex justify-between gap-3 text-brand-muted">
                    <span>
                      {t('booking.days', { count: line.days, price: line.rate })}
                      {line.label && <span className="text-brand-text/70"> · {line.label.replace('weekend', t('booking.weekend'))}</span>}
                    </span>
                    <span>{money(line.amount)}</span>
                  </div>
                ))}
                {quote.discount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>{t('booking.discount', { pct: quote.discountPct })}</span>
                    <span>−{money(quote.discount)}</span>
                  </div>
                )}
                {quote.extras.map((extra) => (
                  <div key={extra.id} className="flex justify-between text-brand-muted">
                    <span>{extra.name}</span>
                    <span>{money(extra.total)}</span>
                  </div>
                ))}
                {quote.deliveryFee > 0 && (
                  <div className="flex justify-between text-brand-muted">
                    <span>{t('booking.deliveryFee')}</span>
                    <span>{money(quote.deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
                  <span className="font-semibold text-brand-text">{t('booking.total')}</span>
                  <span className="font-display text-2xl font-bold text-brand-red">{money(quote.total)}</span>
                </div>
                {quote.deposit > 0 && <p className="text-xs text-brand-muted">{t('booking.deposit', { amount: quote.deposit })}</p>}
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="guest-name">{t('booking.name')} *</label>
              <input id="guest-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('booking.namePlaceholder')} required maxLength={100} autoComplete="name" className={inputClass} />
            </div>

            <div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="birth-date">{t('booking.birthDate')} *</label>
                  <input id="birth-date" type="date" value={birthDate} max={today} onChange={(e) => setBirthDate(e.target.value)} required dir="ltr" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="license-date">{t('booking.licenseDate')} *</label>
                  <input id="license-date" type="date" value={licenseDate} max={today} onChange={(e) => setLicenseDate(e.target.value)} required dir="ltr" className={inputClass} />
                </div>
              </div>
              {settings && <p className="text-[11px] text-brand-muted mt-1">{t('booking.driverHint', { age: settings.minDriverAge, years: settings.minLicenseYears })}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="guest-phone">{t('booking.phone')} *</label>
                <input id="guest-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 12 345 678" required autoComplete="tel" dir="ltr" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="guest-email">{t('booking.email')}</label>
                <input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" dir="ltr" className={inputClass} />
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-[11px] text-brand-muted">{t('booking.emailHint')}</p>
                  <div role="group" aria-label={t('booking.emailLanguage')} className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[11px] text-brand-muted">{t('booking.emailLanguage')}:</span>
                    {LANGS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setEmailLang(code)}
                        aria-pressed={emailLang === code}
                        title={t(`lang.${code}`)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase transition-colors ${emailLang === code ? 'bg-brand-red/15 text-brand-red' : 'text-brand-muted hover:text-brand-text'}`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className={labelClass}>{t('booking.document')}</p>
              <button
                type="button"
                className="w-full border border-dashed border-white/15 rounded-xl p-4 text-center cursor-pointer hover:border-brand-red/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <span className={`text-sm ${file ? 'text-brand-text' : 'text-brand-muted'}`}>{file ? file.name : t('booking.uploadHint')}</span>
              </button>
            </div>

            <Turnstile onToken={onCaptcha} lang={lang} />

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !car.available}
              className="w-full py-3 rounded-xl font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('booking.submitting') : t('booking.submit')}
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
