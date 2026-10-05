import { Link } from 'react-router-dom';
import type { Car } from '../../types';
import { useI18n } from '../../i18n';

interface Props {
  car: Car;
  onBook: () => void;
}

export default function CarCard({ car, onBook }: Props) {
  const { t, money } = useI18n();
  const photoCount = (car.image ? 1 : 0) + car.images.length;
  const available = car.available && !car.documentsExpired?.length;

  return (
    <div className="group bg-brand-dark/70 backdrop-blur-sm border border-white/[0.06] hover:border-brand-red/30 transition-all duration-300 hover:-translate-y-1">
      <Link to={`/cars/${car.id}`} className="block cursor-pointer">
        <div className="relative h-48 overflow-hidden bg-brand-surface">
          {car.image ? (
            <img
              src={car.image}
              alt={`${car.brand} ${car.model}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-brand-muted uppercase tracking-[0.2em]">{t('card.noImage')}</span>
            </div>
          )}
          <div className="absolute top-3 start-3">
            <span className={available ? 'badge-available' : 'badge-maintenance'}>
              ● {available ? t('card.available') : t('card.maintenance')}
            </span>
          </div>
          <div className="absolute top-3 end-3">
            <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] bg-brand-dark/80 text-brand-text border border-white/10 backdrop-blur-sm">
              {car.type}
            </span>
          </div>
          {photoCount > 1 && (
            <span className="absolute bottom-3 end-3 px-2 py-0.5 text-[10px] bg-brand-dark/80 text-brand-text border border-white/10">
              {t('card.photos', { count: photoCount })}
            </span>
          )}
        </div>

        <div className="p-5 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em]"><bdi>{car.brand}</bdi></p>
              <h3 className="font-display font-bold text-brand-text text-xl leading-tight tracking-tight"><bdi>{car.model}</bdi></h3>
              <p className="text-[10px] text-brand-muted mt-0.5">{car.year}</p>
            </div>
            <div className="text-end">
              <p className="font-display text-2xl font-bold text-brand-red tracking-tight whitespace-nowrap">{money(car.price)}</p>
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em]">{t('card.perDay')}</p>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-3 mb-4 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] text-brand-muted uppercase tracking-[0.15em]">{t('card.seats')}</p>
              <p className="text-xs font-semibold text-brand-text mt-0.5">{car.seats}</p>
            </div>
            <div>
              <p className="text-[9px] text-brand-muted uppercase tracking-[0.15em]">{t('card.gearbox')}</p>
              <p className="text-xs font-semibold text-brand-text mt-0.5">{car.transmission}</p>
            </div>
            <div>
              <p className="text-[9px] text-brand-muted uppercase tracking-[0.15em]">{t('card.fuel')}</p>
              <p className="text-xs font-semibold text-brand-text mt-0.5">{car.fuel}</p>
            </div>
          </div>

          {car.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {car.features.slice(0, 3).map((f) => (
                <span key={f} className="px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-brand-muted border border-white/[0.08]">{f}</span>
              ))}
              {car.features.length > 3 && (
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-brand-muted border border-white/[0.08]">+{car.features.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </Link>

      <div className="px-5 pb-5">
        <button
          onClick={onBook}
          disabled={!available}
          className="cursor-pointer w-full py-3 text-[11px] font-semibold tracking-[0.2em] uppercase border border-brand-red text-brand-red hover:bg-brand-red hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-brand-red transition-colors duration-300"
        >
          {available ? t('card.bookNow') : t('card.unavailable')}
        </button>
      </div>
    </div>
  );
}
