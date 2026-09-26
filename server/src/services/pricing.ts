import { rentalDays } from '../lib/dates';
import { HttpError } from '../lib/http';
import type { BusinessSettings, Extra } from './settings';

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

export interface Quote {
  days: number;
  dailyRate: number;
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

// The only place prices are calculated; the client asks for a quote instead of computing its own
export function computeQuote(input: QuoteInput, settings: BusinessSettings): Quote {
  const days = rentalDays(input.startDate, input.endDate);
  const subtotal = round2(days * input.pricePerDay);
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
