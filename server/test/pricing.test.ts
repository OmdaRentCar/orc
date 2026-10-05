import { describe, expect, it } from 'vitest';
import { computeQuote } from '../src/services/pricing';
import { DEFAULT_SETTINGS } from '../src/services/settings';
import { rentalDays, isValidISODate, addDaysISO } from '../src/lib/dates';
import { normalizePhone } from '../src/lib/phone';

const settings = { ...DEFAULT_SETTINGS, weeklyDiscountPct: 10, monthlyDiscountPct: 20, deliveryFee: 30, depositAmount: 500 };

describe('rentalDays', () => {
  it('counts nights, with a same-day rental as one day', () => {
    expect(rentalDays('2027-01-01', '2027-01-01')).toBe(1);
    expect(rentalDays('2027-01-01', '2027-01-02')).toBe(1);
    expect(rentalDays('2027-01-01', '2027-01-04')).toBe(3);
  });

  it('is not affected by daylight saving changes', () => {
    expect(rentalDays('2027-03-27', '2027-03-29')).toBe(2);
    expect(rentalDays('2027-10-30', '2027-11-01')).toBe(2);
  });
});

describe('dates', () => {
  it('rejects impossible dates', () => {
    expect(isValidISODate('2027-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2027-13-01')).toBe(false);
    expect(isValidISODate('27-01-01')).toBe(false);
  });

  it('adds days across month ends', () => {
    expect(addDaysISO('2027-01-31', 1)).toBe('2027-02-01');
  });
});

describe('normalizePhone', () => {
  it('matches the same Tunisian number written different ways', () => {
    const expected = '21612345678';
    expect(normalizePhone('+216 12 345 678')).toBe(expected);
    expect(normalizePhone('0021612345678')).toBe(expected);
    expect(normalizePhone('12 345 678')).toBe(expected);
    expect(normalizePhone('(216) 12-345-678')).toBe(expected);
  });
});

describe('computeQuote', () => {
  const base = { pricePerDay: 100, extraIds: [] as string[], deliveryType: 'agency' as const };

  it('charges days x price with no discount under a week', () => {
    const q = computeQuote({ ...base, startDate: '2027-01-01', endDate: '2027-01-04' }, settings);
    expect(q).toMatchObject({ days: 3, subtotal: 300, discountPct: 0, discount: 0, total: 300, deposit: 500 });
  });

  it('applies the weekly discount from 7 days and the monthly one from 30', () => {
    expect(computeQuote({ ...base, startDate: '2027-01-01', endDate: '2027-01-08' }, settings)).toMatchObject({ days: 7, discountPct: 10, total: 630 });
    expect(computeQuote({ ...base, startDate: '2027-01-01', endDate: '2027-01-31' }, settings)).toMatchObject({ days: 30, discountPct: 20, total: 2400 });
  });

  it('prices per-day and per-booking extras, and delivery', () => {
    const q = computeQuote(
      { ...base, startDate: '2027-01-01', endDate: '2027-01-03', extraIds: ['gps', 'child-seat'], deliveryType: 'delivery' },
      { ...settings, extras: [{ id: 'gps', name: 'GPS', price: 5, per: 'day' }, { id: 'child-seat', name: 'Seat', price: 20, per: 'booking' }] },
    );
    expect(q.extras.map((e) => e.total)).toEqual([10, 20]);
    expect(q).toMatchObject({ extrasTotal: 30, deliveryFee: 30, total: 260 });
  });

  it('ignores duplicate extras and rejects unknown ones', () => {
    const q = computeQuote({ ...base, startDate: '2027-01-01', endDate: '2027-01-02', extraIds: ['gps', 'gps'] }, settings);
    expect(q.extras).toHaveLength(1);
    expect(() => computeQuote({ ...base, startDate: '2027-01-01', endDate: '2027-01-02', extraIds: ['jetpack'] }, settings)).toThrow('Unknown extra');
  });
});
