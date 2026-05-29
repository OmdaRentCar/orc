import type { Car } from '../../types';

interface Props {
  car: Car;
  onClick: () => void;
}

const FUEL_ICON: Record<string, string> = {
  Electric: '⚡',
  Hybrid: '🔋',
  Petrol: '⛽',
  Diesel: '🛢️',
};

export default function CarCard({ car, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="glass-card overflow-hidden cursor-pointer group hover:border-brand-red/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-red/5"
    >
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
            <span className="text-6xl opacity-20">🚗</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className={car.available ? 'badge-available' : 'badge-maintenance'}>
            {car.available ? '● Available' : '● Maintenance'}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-dark/80 text-brand-red backdrop-blur-sm">
            {FUEL_ICON[car.fuel] ?? '⛽'} {car.type}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-brand-muted font-medium">{car.brand}</p>
            <h3 className="font-display font-bold text-brand-text text-lg leading-tight">{car.model}</h3>
            <p className="text-xs text-brand-muted">{car.year}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-brand-red">${car.price}</p>
            <p className="text-xs text-brand-muted">/ day</p>
          </div>
        </div>

        <div className="flex gap-3 text-xs text-brand-muted mb-4">
          <span>👥 {car.seats}</span>
          <span>⚙️ {car.transmission}</span>
          <span>{FUEL_ICON[car.fuel] ?? '⛽'} {car.fuel}</span>
        </div>

        {car.features.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {car.features.slice(0, 3).map((f) => (
              <span key={f} className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-brand-muted border border-white/5">{f}</span>
            ))}
            {car.features.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-brand-muted border border-white/5">+{car.features.length - 3}</span>
            )}
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          disabled={!car.available}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {car.available ? 'Book Now' : 'Unavailable'}
        </button>
      </div>
    </div>
  );
}
