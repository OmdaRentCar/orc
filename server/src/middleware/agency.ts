import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AgencyContext, runAsAgency, AGENCY_SELECT } from '../lib/tenant';
import { effectiveStatus } from '../lib/subscription';
import { RESERVED_SLUGS } from '../lib/platform';

declare global {
  namespace Express {
    interface Request {
      agency?: AgencyContext;
    }
  }
}

// Which agency a request is for, from (in order):
//  1. the X-Agency-Slug header, sent by the site from its own address (needed when the API is on another domain)
//  2. the host: {slug}.<PLATFORM_DOMAIN>, {slug}.localhost, or an agency's own domain
//  3. DEFAULT_AGENCY_SLUG (defaults to "rentcar", so a plain single-agency setup keeps working; set it empty to disable)

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const CACHE_MS = 30_000;
const cache = new Map<string, { agency: AgencyContext | null; at: number }>();

function toContext(a: AgencyContext): AgencyContext {
  return { ...a };
}

async function lookup(key: string, where: { slug: string } | { customDomain: string }): Promise<AgencyContext | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.agency;
  const row = await prisma.agency.findUnique({ where, select: AGENCY_SELECT });
  const agency = row ? toContext(row) : null;
  cache.set(key, { agency, at: Date.now() });
  return agency;
}

export function forgetAgency(): void {
  cache.clear();
}

export function slugFromHost(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase();
  const platform = (process.env.PLATFORM_DOMAIN ?? '').toLowerCase();
  for (const suffix of [platform && `.${platform}`, '.localhost'].filter(Boolean) as string[]) {
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, -suffix.length);
      return SLUG.test(sub) ? sub : null;
    }
  }
  return null;
}

export async function resolveAgency(req: Request): Promise<AgencyContext | null> {
  const header = String(req.header('x-agency-slug') ?? '').toLowerCase();
  if (header && SLUG.test(header)) return lookup(`slug:${header}`, { slug: header });

  const host = String(req.header('x-forwarded-host') ?? req.header('host') ?? '').split(',')[0].trim();
  const fromSub = slugFromHost(host);
  // The platform's own sub-domains (www, app) show the main agency's site, like the bare domain
  if (fromSub && !RESERVED_SLUGS.has(fromSub)) return lookup(`slug:${fromSub}`, { slug: fromSub });

  const hostname = host.split(':')[0].toLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname === (process.env.PLATFORM_DOMAIN ?? '').toLowerCase();
  if (!isLocal && hostname.includes('.')) {
    const own = await lookup(`domain:${hostname}`, { customDomain: hostname });
    if (own) return own;
  }

  const fallback = process.env.DEFAULT_AGENCY_SLUG ?? 'rentcar';
  return fallback ? lookup(`slug:${fallback}`, { slug: fallback }) : null;
}

// Runs the rest of the request "inside" its agency, so every database query is scoped to it
export async function agencyContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const agency = await resolveAgency(req);
  if (!agency) {
    res.status(404).json({ error: 'Unknown agency' });
    return;
  }
  req.agency = agency;
  runAsAgency(agency, () => next());
}

// A suspended or closed agency: its site and dashboard stay reachable only for logging in and paying
const OPEN_WHEN_SUSPENDED = [/^\/agency(\/|$)/, /^\/auth\//, /^\/billing(\/|$)/];

export function subscriptionGuard(req: Request, res: Response, next: NextFunction): void {
  const status = req.agency ? effectiveStatus(req.agency) : 'active';
  if ((status !== 'suspended' && status !== 'cancelled') || OPEN_WHEN_SUSPENDED.some((r) => r.test(req.path))) {
    next();
    return;
  }
  res.status(402).json({
    error: status === 'cancelled' ? 'This agency is closed' : 'This agency\u2019s subscription is suspended. The owner can reactivate it in Settings \u2192 Subscription.',
    code: 'agency_suspended',
  });
}
