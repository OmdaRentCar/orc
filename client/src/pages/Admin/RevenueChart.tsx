import { useState } from 'react';
import { money } from '../../utils/format';

interface Point {
  month: string; // YYYY-MM
  revenue: number;
  bookings: number;
}

const W = 720;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 26, left: 52 };

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4)! * magnitude;
  return Math.ceil(value / step) * step;
}

function monthLabel(month: string, withYear = false): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

// Single-series bar chart: revenue per rental-start month, bookings shown in the tooltip
export default function RevenueChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.revenue)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(28, slot - 2); // at least a 2px gap between bars
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Revenue per month for the last 12 months">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#888888">
              {tick >= 1000 ? `${Number((tick / 1000).toFixed(1))}k` : tick}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const top = y(d.revenue);
          const height = PAD.top + innerH - top;
          const r = Math.min(4, height);
          return (
            <g key={d.month}>
              {height > 0 && (
                // Rounded data-end on top, square on the baseline
                <path
                  d={`M${x},${PAD.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.top + innerH} Z`}
                  fill="#e72526"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={hover === i ? '#f0ede8' : '#888888'}>
                {monthLabel(d.month)}
              </text>
              {/* Hit target covers the whole column, larger than the bar */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      </svg>

      {active && hover !== null && (
        <div
          className="absolute top-0 pointer-events-none px-3 py-2 rounded-lg bg-brand-elevated border border-white/10 shadow-xl text-xs whitespace-nowrap"
          style={{
            left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`,
            transform: `translateX(${hover > data.length / 2 ? '-100%' : '0'})`,
          }}
        >
          <p className="text-brand-muted mb-0.5">{monthLabel(active.month, true)}</p>
          <p className="text-brand-text font-semibold">{money(active.revenue)}</p>
          <p className="text-brand-muted">{active.bookings} booking{active.bookings === 1 ? '' : 's'}</p>
        </div>
      )}

      <table className="sr-only">
        <caption>Revenue per month</caption>
        <thead><tr><th>Month</th><th>Revenue</th><th>Bookings</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}><td>{monthLabel(d.month, true)}</td><td>{money(d.revenue)}</td><td>{d.bookings}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
