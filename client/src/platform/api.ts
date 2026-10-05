const BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/platform`;
const TOKEN_KEY = 'console_token';

export const consoleToken = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* session only */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* nothing stored */ } },
};

// Calls the platform API (no agency). Console calls carry the console login, kept apart from agency logins.
export async function platformJSON<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = consoleToken.get();
  if (token && endpoint.startsWith('/console')) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401 && endpoint.startsWith('/console') && endpoint !== '/console/login') {
    consoleToken.clear();
    window.location.href = '/console/login';
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export interface Plan {
  id: 'starter' | 'pro' | 'business';
  name: string;
  monthly: number;
  maxCars: number | null;
  maxUsers: number | null;
  highlights: string[];
}

export interface PlatformInfo {
  name: string;
  email: string;
  trialDays: number;
  plans: Plan[];
  domain: string;
  agencyUrlTemplate: string | null;
}

let info: Promise<PlatformInfo> | null = null;
export const loadInfo = () => (info ??= platformJSON<PlatformInfo>('/info').catch((e) => { info = null; throw e; }));

// "sahel" -> "sahel.rentcar.tn" (or sahel.localhost:5173 in development)
export function agencyAddress(slug: string, p: PlatformInfo | null): string {
  const template = p?.agencyUrlTemplate ?? `https://{slug}.${p?.domain ?? 'rentcar.tn'}`;
  return template.replace('{slug}', slug || 'votre-agence').replace(/^https?:\/\//, '');
}

export const dt = (n: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(n.toFixed(3)))} DT`;
export const frDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
