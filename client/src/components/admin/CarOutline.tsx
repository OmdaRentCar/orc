import type { Damage } from '../../types';

interface Props {
  damages: Damage[];
  onAdd?: (point: { x: number; y: number }) => void;
  onSelect?: (index: number) => void;
  selected?: number | null;
  ghost?: Damage[]; // damages from the pick-up, shown faintly at return for comparison
  className?: string;
}

// Top view of a car. Coordinates are 0-100 on both axes, the same as the PDF diagram.
export default function CarOutline({ damages, onAdd, onSelect, selected = null, ghost = [], className = '' }: Props) {
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onAdd) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    onAdd({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  }

  return (
    <div
      onClick={handleClick}
      className={`relative select-none ${onAdd ? 'cursor-crosshair' : ''} ${className}`}
      style={{ aspectRatio: '12 / 17' }}
      role={onAdd ? 'button' : 'img'}
      aria-label={onAdd ? 'Tap the car where the damage is' : 'Car diagram with damage marks'}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="0.8" vectorEffect="non-scaling-stroke" className="text-brand-text/70">
          <rect x="28" y="4" width="44" height="92" rx="12" ry="8" vectorEffect="non-scaling-stroke" />
          <path d="M31 27 Q50 22 69 27 L66 37 L34 37 Z" vectorEffect="non-scaling-stroke" />
          <path d="M33 76 L67 76 L65 84 L35 84 Z" vectorEffect="non-scaling-stroke" />
          <rect x="34" y="40" width="32" height="33" className="text-brand-text/25" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        </g>
        <g className="fill-brand-text/80">
          <rect x="24" y="16" width="4" height="12" rx="1.5" />
          <rect x="72" y="16" width="4" height="12" rx="1.5" />
          <rect x="24" y="72" width="4" height="12" rx="1.5" />
          <rect x="72" y="72" width="4" height="12" rx="1.5" />
        </g>
      </svg>
      <span className="absolute left-1/2 -translate-x-1/2 top-0 -mt-4 text-[10px] uppercase tracking-widest text-brand-muted">Front</span>
      {ghost.map((d, i) => (
        <span key={`g${i}`} title={d.note} style={{ left: `${d.x}%`, top: `${d.y}%` }} className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border border-dashed border-brand-muted/70 text-[9px] text-brand-muted flex items-center justify-center pointer-events-none">
          {i + 1}
        </span>
      ))}
      {damages.map((d, i) => (
        <button
          key={i}
          type="button"
          title={d.note}
          onClick={(e) => { e.stopPropagation(); onSelect?.(i); }}
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
          className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full text-[11px] font-bold text-white flex items-center justify-center shadow ${selected === i ? 'bg-white text-brand-dark ring-2 ring-brand-red' : 'bg-brand-red'}`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
