// "450 DT", "1502.8 DT": up to 3 decimals (the dinar has millimes), no trailing zeros
export function money(amount: number): string {
  return `${Number(amount.toFixed(3))} DT`;
}

// Same rules as the server: digits only, and Tunisia's 216 prefix for 8-digit local numbers
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  return digits.length === 8 ? `216${digits}` : digits;
}

export function whatsappUrl(phone: string, message?: string): string {
  const base = `https://wa.me/${normalizePhone(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Today's date as YYYY-MM-DD in the visitor's own timezone
export function localTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Every half hour from 07:00 to 21:00
export const TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});
