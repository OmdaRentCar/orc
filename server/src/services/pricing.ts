import { addDaysISO, rentalDays } from '../lib/dates';
import { HttpError } from '../lib/http';
import type { BusinessSettings, Extra, Season } from './settings';

export interface QuoteInput {
  pricePerDay: number;
  startDate: string;
  endDate: string;
  extraIds: string[];
  deliveryType: 'agency' | 'delivery';
}

export interface QuotedExtra extends Extra {
  total: number;
}

// Days grouped by the rate they were charged at, e.g. "5 × 199 DT" and "2 × 239 DT (Summer)"
export interface QuoteLine {
  label: string;
  days: number;
  rate: number;
  amount: number;
}

export interface Quote {
  days: number;
  dailyRate: number;
  lines: QuoteLine[];
  subtotal: number;
  discountPct: number;
  discount: number;
  extras: QuotedExtra[];
  extrasTotal: number;
  deliveryFee: number;
  total: number;
  deposit: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// A season like 12-15 → 01-05 wraps over the new year
export function seasonFor(date: string, seasons: Season[]): Season | undefined {
  const md = date.slice(5);
  return seasons.find((s) => (s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to));
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// Price of each rented day: the base rate, adjusted for its season and for weekends
export function dailyRates(pricePerDay: number, startDate: string, days: number, settings: Pick<BusinessSettings, 'seasons' | 'weekendPct'>) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysISO(startDate, i);
    const season = seasonFor(date, settings.seasons);
    const weekend = settings.weekendPct !== 0 && isWeekend(date);
    const factor = (1 + (season?.pct ?? 0) / 100) * (1 + (weekend ? settings.weekendPct : 0) / 100);
    const tags = [season?.name, weekend ? 'weekend' : null].filter(Boolean).join(', ');
    return { date, rate: round2(pricePerDay * factor), tags };
  });
}

// The only place prices are calculated; the client asks for a quote instead of computing its own
export function computeQuote(input: QuoteInput, settings: BusinessSettings): Quote {
  const days = rentalDays(input.startDate, input.endDate);
  const perDay = dailyRates(input.pricePerDay, input.startDate, days, settings);

  const grouped = new Map<string, QuoteLine>();
  for (const d of perDay) {
    const key = `${d.rate}|${d.tags}`;
    const line = grouped.get(key) ?? { label: d.tags, days: 0, rate: d.rate, amount: 0 };
    line.days += 1;
    line.amount = round2(line.amount + d.rate);
    grouped.set(key, line);
  }
  const lines = [...grouped.values()];
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));

  const discountPct = days >= 30 ? settings.monthlyDiscountPct : days >= 7 ? settings.weeklyDiscountPct : 0;
  const discount = round2((subtotal * discountPct) / 100);

  const extras: QuotedExtra[] = [...new Set(input.extraIds)].map((id) => {
    const extra = settings.extras.find((e) => e.id === id);
    if (!extra) throw new HttpError(400, `Unknown extra: ${id}`);
    return { ...extra, total: round2(extra.per === 'day' ? extra.price * days : extra.price) };
  });
  const extrasTotal = round2(extras.reduce((sum, e) => sum + e.total, 0));
  const deliveryFee = input.deliveryType === 'delivery' ? settings.deliveryFee : 0;

  return {
    days,
    dailyRate: input.pricePerDay,
    lines,
    subtotal,
    discountPct,
    discount,
    extras,
    extrasTotal,
    deliveryFee,
    total: round2(subtotal - discount + extrasTotal + deliveryFee),
    deposit: settings.depositAmount,
  };
}
