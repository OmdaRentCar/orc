import { z } from 'zod';

// Bookings use plain YYYY-MM-DD dates in the business's own timezone
const BUSINESS_TZ = process.env.BUSINESS_TZ || 'Africa/Tunis';

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const isoDate = z.string().refine(isValidISODate, 'must be a date in YYYY-MM-DD format');
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time in HH:MM format');

export function todayISO(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

// Number of billed days: return date minus pick-up date, with a same-day rental counting as one day.
// Computed in UTC so the result never depends on the server's timezone.
export function rentalDays(startDate: string, endDate: string): number {
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000));
}

// The UTC instant of a local date + time in the business timezone (e.g. "2027-07-01", "10:00" in Tunis)
export function localInstant(date: string, time: string, timeZone = BUSINESS_TZ): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const local = new Date(guess.toLocaleString('en-US', { timeZone }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}
