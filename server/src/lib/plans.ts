import { HttpError } from './http';
import { currentAgency } from './tenant';

// What each subscription includes. Prices are in DT per month, tax included; a year costs 10 months.
// Override prices without a release with PLAN_PRICES="starter:49,pro:129,business:249".
export type PlanId = 'starter' | 'pro' | 'business';
export type Feature = 'onlineSignature' | 'customDomain' | 'hideBranding';
export type Cycle = 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  maxCars: number | null; // null = unlimited
  maxUsers: number | null;
  features: Record<Feature, boolean>;
  highlights: string[]; // French, for the platform site
  highlightsEn: string[]; // English, for the agency dashboard
  highlightsAr: string[]; // Arabic, for the general page
}

const BASE: Plan[] = [
  {
    id: 'starter', name: 'Starter', monthly: 49, maxCars: 5, maxUsers: 2,
    features: { onlineSignature: false, customDomain: false, hideBranding: false },
    highlights: ['Site de réservation à votre nom', 'Jusqu’à 5 voitures', '2 comptes', 'Contrats PDF, état des lieux, amendes', 'Présence dans l’annuaire des agences'],
    highlightsEn: ['Booking site under your name', 'Up to 5 cars', '2 accounts', 'PDF contracts, handover checks, fines', 'Listed in the agency directory'],
    highlightsAr: ['موقع حجز باسم وكالتك', 'حتى 5 سيارات', 'حسابان', 'عقود PDF ومعاينة السيارة والمخالفات', 'ظهور في دليل الوكالات'],
  },
  {
    id: 'pro', name: 'Pro', monthly: 129, maxCars: 25, maxUsers: 5,
    features: { onlineSignature: true, customDomain: false, hideBranding: false },
    highlights: ['Tout Starter', 'Jusqu’à 25 voitures', '5 comptes', 'Signature de contrat en ligne', 'Rentabilité par voiture'],
    highlightsEn: ['Everything in Starter', 'Up to 25 cars', '5 accounts', 'Online contract signature', 'Profit per car'],
    highlightsAr: ['كل مزايا Starter', 'حتى 25 سيارة', '5 حسابات', 'توقيع العقد عن بعد', 'ربح كل سيارة'],
  },
  {
    id: 'business', name: 'Business', monthly: 249, maxCars: null, maxUsers: null,
    features: { onlineSignature: true, customDomain: true, hideBranding: true },
    highlights: ['Tout Pro', 'Voitures et comptes illimités', 'Votre propre nom de domaine', 'Sans mention « Propulsé par RentCar »', 'Support prioritaire'],
    highlightsEn: ['Everything in Pro', 'Unlimited cars and accounts', 'Your own domain name', 'No “Powered by RentCar” mention', 'Priority support'],
    highlightsAr: ['كل مزايا Pro', 'سيارات وحسابات بلا حدود', 'اسم نطاق خاص بك', 'دون عبارة «Powered by RentCar»', 'دعم ذو أولوية'],
  },
];

function priceOverrides(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (process.env.PLAN_PRICES ?? '').split(',')) {
    const [id, price] = part.split(':').map((x) => x.trim());
    if (id && Number(price) > 0) out[id] = Number(price);
  }
  return out;
}

export function plans(): Plan[] {
  const prices = priceOverrides();
  return BASE.map((p) => ({ ...p, monthly: prices[p.id] ?? p.monthly }));
}

export const isPlanId = (id: unknown): id is PlanId => BASE.some((p) => p.id === id);

export function getPlan(id: string | undefined | null): Plan {
  return plans().find((p) => p.id === id) ?? plans()[plans().length - 1];
}

export const cycleMonths = (cycle: Cycle) => (cycle === 'yearly' ? 12 : 1);
export const price = (plan: Plan, cycle: Cycle) => (cycle === 'yearly' ? plan.monthly * 10 : plan.monthly);

export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);

// The plan of the agency handling this request (agencies built by hand, e.g. in tests, have no limits)
export function currentPlan(): Plan {
  return getPlan(currentAgency()?.plan ?? 'business');
}

export function requireFeature(feature: Feature, label: string): void {
  if (!currentPlan().features[feature]) {
    throw new HttpError(402, `${label} is not included in your plan. Upgrade in Settings → Subscription.`);
  }
}

export function requireRoom(kind: 'cars' | 'users', count: number): void {
  const plan = currentPlan();
  const max = kind === 'cars' ? plan.maxCars : plan.maxUsers;
  if (max !== null && count >= max) {
    throw new HttpError(402, `Your ${plan.name} plan allows ${max} ${kind === 'cars' ? 'cars' : 'accounts'}. Upgrade in Settings → Subscription to add more.`);
  }
}
