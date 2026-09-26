// Digits only, with Tunisia's 216 prefix added to 8-digit local numbers,
// so "+216 12 345 678", "0021612345678" and "12345678" all match the same customer
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  return digits.length === 8 ? `216${digits}` : digits;
}
