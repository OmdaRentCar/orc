import type { BusinessSettings } from './settings';

// Whole years from one YYYY-MM-DD date to another (age on a given day)
export function fullYears(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return ty - fy - (tm < fm || (tm === fm && td < fd) ? 1 : 0);
}

export interface DriverInfo {
  birthDate?: string | null;
  licenseIssueDate?: string | null;
  licenseExpiry?: string | null;
}

// Returns why this driver can't rent for these dates, or null if they can
export function driverProblem(driver: DriverInfo, startDate: string, endDate: string, settings: Pick<BusinessSettings, 'minDriverAge' | 'minLicenseYears'>): string | null {
  if (driver.birthDate && fullYears(driver.birthDate, startDate) < settings.minDriverAge) {
    return `The driver must be at least ${settings.minDriverAge} years old`;
  }
  if (driver.licenseIssueDate && fullYears(driver.licenseIssueDate, startDate) < settings.minLicenseYears) {
    return `The driving licence must be at least ${settings.minLicenseYears} year(s) old`;
  }
  if (driver.licenseExpiry && driver.licenseExpiry < endDate) {
    return 'The driving licence expires before the end of the rental';
  }
  return null;
}

export const CAR_DOCUMENTS = [
  { field: 'insuranceExpiry', label: 'Insurance' },
  { field: 'vignetteExpiry', label: 'Vignette' },
  { field: 'inspectionExpiry', label: 'Technical inspection' },
] as const;

type CarDocs = { insuranceExpiry: string | null; vignetteExpiry: string | null; inspectionExpiry: string | null };

// An expiry date is the last valid day: a document is expired on any later day
export function expiredDocuments(car: CarDocs, onDate: string): string[] {
  return CAR_DOCUMENTS.filter((d) => car[d.field] && car[d.field]! < onDate).map((d) => d.label);
}

// Documents that run out before the rental ends, so the car can't legally be out for the whole booking
export function documentsExpiringDuring(car: CarDocs, endDate: string): { label: string; expiry: string }[] {
  return CAR_DOCUMENTS.filter((d) => car[d.field] && car[d.field]! < endDate).map((d) => ({ label: d.label, expiry: car[d.field]! }));
}
