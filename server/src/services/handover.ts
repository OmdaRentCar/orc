import { localInstant, rentalDays } from '../lib/dates';
import type { BusinessSettings } from './settings';

export interface ExtraCharge {
  label: string;
  amount: number;
  kind: 'km' | 'fuel' | 'late' | 'damage' | 'fine' | 'other';
}

interface Reading {
  mileage: number;
  fuelLevel: number; // eighths
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Hours between the agreed return (date + time, business timezone) and the actual return
export function hoursLate(endDate: string, returnTime: string, returnedAt: Date): number {
  return (returnedAt.getTime() - localInstant(endDate, returnTime).getTime()) / 3_600_000;
}

// Charges owed at return: kilometres over the allowance, missing fuel, and late return
export function returnCharges(
  booking: { startDate: string; endDate: string; returnTime: string; dailyRate: number },
  checkout: Reading,
  checkin: Reading,
  returnedAt: Date,
  settings: Pick<BusinessSettings, 'kmPerDayIncluded' | 'extraKmPrice' | 'fuelChargePerEighth' | 'lateGraceHours'>,
): ExtraCharge[] {
  const charges: ExtraCharge[] = [];
  const days = rentalDays(booking.startDate, booking.endDate);

  if (settings.kmPerDayIncluded > 0) {
    const driven = checkin.mileage - checkout.mileage;
    const allowance = settings.kmPerDayIncluded * days;
    const over = driven - allowance;
    if (over > 0 && settings.extraKmPrice > 0) {
      charges.push({ kind: 'km', label: `${over} km over the ${allowance} km included`, amount: round2(over * settings.extraKmPrice) });
    }
  }

  const missingEighths = checkout.fuelLevel - checkin.fuelLevel;
  if (missingEighths > 0 && settings.fuelChargePerEighth > 0) {
    charges.push({ kind: 'fuel', label: `Fuel: ${missingEighths}/8 tank missing`, amount: round2(missingEighths * settings.fuelChargePerEighth) });
  }

  const late = hoursLate(booking.endDate, booking.returnTime, returnedAt);
  if (late > settings.lateGraceHours) {
    const lateDays = Math.ceil(late / 24);
    charges.push({ kind: 'late', label: `Late return: ${Math.round(late)} h (${lateDays} extra day${lateDays > 1 ? 's' : ''})`, amount: round2(lateDays * booking.dailyRate) });
  }

  return charges;
}

export function chargesTotal(charges: ExtraCharge[]): number {
  return round2(charges.reduce((sum, c) => sum + c.amount, 0));
}
