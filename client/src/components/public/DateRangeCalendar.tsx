import { useMemo, useState } from 'react';
import { useI18n, INTL_LOCALE } from '../../i18n';
import { addDaysISO } from '../../utils/format';

interface Props {
  booked: { startDate: string; endDate: string }[];
  start: string;
  end: string;
  minDate: string;
  onChange: (start: string, end: string) => void;
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(first: string, delta: number): string {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

export default function DateRangeCalendar({ booked, start, end, minDate, onChange }: Props) {
  const { t, lang } = useI18n();
  const [month, setMonth] = useState(() => monthStart(start || minDate));

  const isBooked = useMemo(() => {
    return (day: string) => booked.some((r) => r.startDate <= day && r.endDate >= day);
  }, [booked]);

  const locale = INTL_LOCALE[lang];
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}T00:00:00Z`));
  // Weeks start on Monday; 2024-01-01 was a Monday
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );

  const firstWeekday = (new Date(`${month}T00:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDaysISO(month, i)),
  ];

  function rangeIsFree(from: string, to: string): boolean {
    for (let d = from; d <= to; d = addDaysISO(d, 1)) if (isBooked(d)) return false;
    return true;
  }

  function pick(day: string) {
    if (!start || end || day < start) {
      onChange(day, '');
    } else if (rangeIsFree(start, day)) {
      onChange(start, day);
    } else {
      // The stay would cross a booked day: start a new selection from here instead
      onChange(day, '');
    }
  }

  const canGoBack = month > monthStart(minDate);

  return (
    <div className="rounded-xl border border-white/10 bg-brand-surface/60 p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          disabled={!canGoBack}
          aria-label={t('calendar.prev')}
          className="w-8 h-8 rounded-lg text-brand-muted hover:text-brand-text hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed rtl:rotate-180"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-brand-text capitalize">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          aria-label={t('calendar.next')}
          className="w-8 h-8 rounded-lg text-brand-muted hover:text-brand-text hover:bg-white/5 rtl:rotate-180"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w, i) => (
          <span key={i} className="text-[10px] uppercase text-brand-muted py-1">{w}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`empty-${i}`} />;
          const past = day < minDate;
          const taken = isBooked(day);
          const disabled = past || taken;
          const isStart = day === start;
          const isEnd = day === end;
          const inRange = start && end && day > start && day < end;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => pick(day)}
              aria-pressed={isStart || isEnd}
              aria-label={`${day}${taken ? ` (${t('calendar.booked')})` : ''}`}
              className={[
                'h-9 rounded-lg text-sm transition-colors',
                isStart || isEnd ? 'bg-brand-red text-white font-semibold' : '',
                inRange ? 'bg-brand-red/20 text-brand-text' : '',
                taken ? 'text-red-400/40 line-through cursor-not-allowed bg-red-500/5' : '',
                past && !taken ? 'text-brand-muted/30 cursor-not-allowed' : '',
                !disabled && !isStart && !isEnd && !inRange ? 'text-brand-text hover:bg-white/10' : '',
              ].join(' ')}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 mt-3 text-[11px] text-brand-muted">
        <span>{!start || end ? t('calendar.pickStart') : t('calendar.pickEnd')}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/10 border border-red-400/30" />
          {t('calendar.booked')}
        </span>
      </div>
    </div>
  );
}
