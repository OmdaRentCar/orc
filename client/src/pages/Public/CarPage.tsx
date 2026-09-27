import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import BookingModal from '../Home/BookingModal';
import type { Car } from '../../types';
import { apiJSON } from '../../services/api';
import { useI18n } from '../../i18n';

export default function CarPage() {
  const { id } = useParams();
  const { t, money } = useI18n();
  const [car, setCar] = useState<Car | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [active, setActive] = useState(0);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    setCar(null);
    setNotFound(false);
    setActive(0);
    apiJSON<Car>(`/cars/${id}`).then(setCar).catch(() => setNotFound(true));
    window.scrollTo(0, 0);
  }, [id]);

  const photos = car ? [car.image, ...car.images].filter((p): p is string => !!p) : [];
  const available = !!car && car.available && !car.documentsExpired?.length;

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pt-28 pb-16">
        <Link to="/#section-fleet" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand-muted hover:text-brand-red mb-8">
          <span className="rtl:rotate-180">←</span> {t('carPage.back')}
        </Link>

        {notFound && <p className="text-brand-muted py-20 text-center">{t('carPage.notFound')}</p>}
        {!car && !notFound && (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>
        )}

        {car && (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
            <div>
              <div className="aspect-[3/2] bg-brand-surface overflow-hidden border border-white/[0.06]">
                {photos.length > 0 ? (
                  <img src={photos[active]} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs uppercase tracking-[0.2em] text-brand-muted">{t('card.noImage')}</div>
                )}
              </div>
              {photos.length > 1 && (
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-3">
                  {photos.map((photo, i) => (
                    <button
                      key={photo}
                      onClick={() => setActive(i)}
                      aria-label={`${i + 1} / ${photos.length}`}
                      aria-current={i === active}
                      className={`aspect-[3/2] overflow-hidden border transition-colors ${i === active ? 'border-brand-red' : 'border-white/10 hover:border-white/30'}`}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-brand-muted uppercase tracking-[0.2em]"><bdi>{car.brand}</bdi></p>
              <h1 className="font-display text-5xl font-extrabold uppercase tracking-tight text-brand-text leading-none mt-1 mb-4"><bdi>{car.model}</bdi></h1>
              <div className="flex items-center gap-3 mb-6">
                <span className={available ? 'badge-available' : 'badge-maintenance'}>
                  ● {available ? t('card.available') : t('card.maintenance')}
                </span>
              </div>
              <p className="font-display text-4xl font-bold text-brand-red mb-8">
                {money(car.price)} <span className="text-base text-brand-muted font-normal">{t('card.perDay')}</span>
              </p>

              <button
                onClick={() => setBooking(true)}
                disabled={!available}
                className="w-full py-4 mb-10 text-xs font-semibold tracking-[0.2em] uppercase bg-brand-red text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {available ? t('card.bookNow') : t('card.unavailable')}
              </button>

              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-muted mb-3">{t('carPage.specs')}</h2>
              <dl className="mb-8">
                {[
                  [t('carPage.type'), car.type],
                  [t('carPage.year'), String(car.year)],
                  [t('card.seats'), String(car.seats)],
                  [t('card.gearbox'), car.transmission],
                  [t('card.fuel'), car.fuel],
                ].map(([label, value]) => (
                  <div key={label} className="spec-row">
                    <dt className="spec-name">{label}</dt>
                    <dd className="spec-val">{value}</dd>
                  </div>
                ))}
              </dl>

              {car.features.length > 0 && (
                <>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-muted mb-3">{t('carPage.features')}</h2>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {car.features.map((f) => (
                      <span key={f} className="px-3 py-1 text-xs text-brand-text border border-white/10">{f}</span>
                    ))}
                  </div>
                </>
              )}

              {car.description && (
                <>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-muted mb-3">{t('carPage.about')}</h2>
                  <p className="text-sm text-brand-muted leading-relaxed">{car.description}</p>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
      <BookingModal car={booking ? car : null} onClose={() => setBooking(false)} onSuccess={() => {}} />
    </div>
  );
}
