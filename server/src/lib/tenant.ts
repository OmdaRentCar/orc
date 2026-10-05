import { AsyncLocalStorage } from 'async_hooks';

// The agency a piece of work belongs to. Set once per request (from the web address) or per background
// job, and read by the database layer to scope every query automatically.
export interface AgencyContext {
  id: number;
  slug: string;
  name: string;
  customDomain: string | null;
  // Subscription, for plan limits and suspension (absent in hand-made contexts, e.g. tests)
  status?: string;
  plan?: string;
  primaryColor?: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  pastDueSince?: Date | null;
}

// The columns that make an AgencyContext
export const AGENCY_SELECT = {
  id: true, slug: true, name: true, customDomain: true, status: true, plan: true, primaryColor: true,
  trialEndsAt: true, currentPeriodEnd: true, pastDueSince: true,
} as const;

interface TenantState {
  agency: AgencyContext | null;
  // Platform-level work (sign-up, migrations, jobs looping over agencies) may read across agencies
  unscoped: boolean;
}

const store = new AsyncLocalStorage<TenantState>();

// Prisma queries are lazy: they run when awaited, not when created. Resolving the result inside the
// context makes `runAsAgency(a, () => prisma.car.findMany())` run the query as that agency.
function runIn<T>(state: TenantState, fn: () => T): T {
  return store.run(state, () => {
    const result = fn();
    const thenable = result && typeof (result as { then?: unknown }).then === 'function';
    return (thenable ? Promise.resolve(result) : result) as T;
  });
}

export function runAsAgency<T>(agency: AgencyContext, fn: () => T): T {
  return runIn({ agency, unscoped: false }, fn);
}

export function runUnscoped<T>(fn: () => T): T {
  return runIn({ agency: null, unscoped: true }, fn);
}

export function currentAgency(): AgencyContext | null {
  return store.getStore()?.agency ?? null;
}

export function isUnscoped(): boolean {
  return store.getStore()?.unscoped ?? false;
}

export function requireAgency(): AgencyContext {
  const agency = currentAgency();
  if (!agency) throw new Error('No agency for this request');
  return agency;
}

// Public address of an agency's site: its own domain, or its sub-domain on the platform
export function agencySiteUrl(agency: Pick<AgencyContext, 'slug' | 'customDomain'> = requireAgency()): string {
  if (agency.customDomain) return `https://${agency.customDomain}`;
  const template = process.env.AGENCY_URL_TEMPLATE; // e.g. https://{slug}.rentcar.tn or http://{slug}.localhost:5173
  if (template) return template.replace('{slug}', agency.slug).replace(/\/$/, '');
  return (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}
