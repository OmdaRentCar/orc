// Which agency this site belongs to, read from the address it is opened on:
//   {slug}.<VITE_PLATFORM_DOMAIN>  e.g. sahel.rentcar.tn
//   {slug}.localhost               e.g. http://sahel.localhost:5173 in development
// An agency's own domain (or plain localhost) sends no slug: the server recognises the domain itself.
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type Feature = 'onlineSignature' | 'customDomain' | 'hideBranding';

export interface Subscription {
  status: SubscriptionStatus;
  plan: string;
  planName: string;
  cycle: 'monthly' | 'yearly';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  suspendsAt: string | null;
  trialDaysLeft: number | null;
  features: Record<Feature, boolean>;
  limits: { cars: number | null; users: number | null };
}

export interface Agency {
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  customDomain: string | null;
  siteUrl: string;
  city: string | null;
  listed: boolean;
  status: SubscriptionStatus;
  plan: string;
  subscription: Subscription;
  platform: { name: string; url: string; email?: string };
  // Real figures for the website's hero
  stats?: { cars: number; rentals: number; customers: number; since: number };
  // The general page of the platform (not an agency): its figures cover every agency
  isPlatform?: boolean;
  platformStats?: { agencies: number; cars: number; cities: number; trialDays: number };
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

// Sub-domains of the platform itself, never an agency (keep in line with RESERVED_SLUGS on the server)
const PLATFORM_SUBS = new Set(['www', 'app']);

function slugFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  const platform = (import.meta.env.VITE_PLATFORM_DOMAIN ?? '').toLowerCase();
  for (const suffix of [platform && `.${platform}`, '.localhost'].filter(Boolean)) {
    if (host.endsWith(suffix)) {
      const sub = host.slice(0, -suffix.length);
      return SLUG.test(sub) && !PLATFORM_SUBS.has(sub) ? sub : null;
    }
  }
  return null;
}

export const AGENCY_SLUG = slugFromHost(window.location.hostname);

// The platform's own address (general page, sign-up, single login, console):
// <VITE_PLATFORM_DOMAIN>, www.<...> or app.<...>; in development the bare http://localhost:5173
export const IS_PLATFORM = (() => {
  const host = window.location.hostname.toLowerCase();
  const platform = (import.meta.env.VITE_PLATFORM_DOMAIN ?? '').toLowerCase();
  if (platform && [platform, `www.${platform}`, `app.${platform}`].includes(host)) return true;
  return host === 'localhost' || host === '127.0.0.1';
})();

// On the platform address these paths are separate pages; "/" is the general page (the 3D site, platform version)
export const IS_PLATFORM_PAGE = IS_PLATFORM && /^\/(signup|console|login)(\/|$)/.test(window.location.pathname);

// Kept outside React too, for text built outside components (WhatsApp messages, page title)
let brand = 'RentCar';
export const brandName = () => brand;

// "#e72526" -> "231 37 38", the format the Tailwind colour variable expects.
// The site is dark: a colour too dark to read on it (prices, buttons, links) is lightened, keeping its shade.
function hexToRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  let rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (let i = 0; i < 20 && lum(rgb) < 0.13; i++) rgb = rgb.map((v) => Math.round(v + (255 - v) * 0.12));
  return rgb.join(' ');
}

export function applyBranding(agency: Agency): void {
  brand = agency.name;
  document.title = agency.name;
  const rgb = hexToRgb(agency.primaryColor);
  if (rgb) document.documentElement.style.setProperty('--brand-red', rgb);
  if (agency.logoUrl) {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) {
      icon.href = agency.logoUrl;
      icon.type = '';
    }
  }
}
