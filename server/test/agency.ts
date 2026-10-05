import { AgencyContext, runAsAgency } from '../src/lib/tenant';

// The agency every migrated database starts with (id 1); requests with no agency in the address resolve to it
export const MAIN_AGENCY: AgencyContext = { id: 1, slug: 'rentcar', name: 'RentCar', customDomain: null };

// Direct database work in tests runs as that agency, like a request to its site would
export const asMain = <T>(fn: () => T): T => runAsAgency(MAIN_AGENCY, fn);
