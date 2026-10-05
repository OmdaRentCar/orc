import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody } from '../lib/http';
import { requireAgency } from '../lib/tenant';
import { requireFeature } from '../lib/plans';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { forgetAgency } from '../middleware/agency';
import { audit } from '../services/audit';
import { platformEvent } from '../services/billing';

// The agency's own domain (Business plan). Ownership is proven with a TXT record; traffic reaches the
// platform through a CNAME (or A record for a bare domain) set up by the agency at its registrar.
const router = Router();
router.use(authMiddleware, requireOwner);

const DOMAIN = /^(?=.{4,200}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/;
const target = () => process.env.CUSTOM_DOMAIN_TARGET || `cname.${process.env.PLATFORM_DOMAIN || 'rentcar.tn'}`;
const txtName = (domain: string) => `_rentcar-verify.${domain}`;

async function view() {
  const a = await (prisma.agency.findUniqueOrThrow({ where: { id: requireAgency().id } }));
  return {
    customDomain: a.customDomain,
    verifiedAt: a.domainVerifiedAt,
    pending: a.pendingDomain
      ? { domain: a.pendingDomain, records: [
        { type: 'TXT', name: txtName(a.pendingDomain), value: a.domainToken },
        { type: 'CNAME', name: a.pendingDomain, value: target() },
      ] }
      : null,
    target: target(),
    platformIp: process.env.CUSTOM_DOMAIN_IP || null,
  };
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  res.json(await view());
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  requireFeature('customDomain', 'Your own domain');
  const { domain } = parseBody(z.object({ domain: z.string().trim().toLowerCase().transform((d) => d.replace(/^https?:\/\//, '').replace(/\/.*$/, '')) }), req.body);
  if (!DOMAIN.test(domain)) throw new HttpError(400, 'Enter a domain like location-sfax.tn or www.location-sfax.tn');
  const platformDomain = (process.env.PLATFORM_DOMAIN || '').toLowerCase();
  if (platformDomain && (domain === platformDomain || domain.endsWith(`.${platformDomain}`))) throw new HttpError(400, 'This is a platform address, not your own domain');
  const taken = await (prisma.agency.findFirst({ where: { OR: [{ customDomain: domain }, { pendingDomain: domain }], NOT: { id: requireAgency().id } } }));
  if (taken) throw new HttpError(409, 'This domain is already used by another agency');
  await (prisma.agency.update({
    where: { id: requireAgency().id },
    data: { pendingDomain: domain, domainToken: `rentcar-${randomBytes(12).toString('hex')}` },
  }));
  await audit(req, 'domain:add', 'agency', requireAgency().id, domain);
  res.json(await view());
});

// Looks the records up in public DNS. Only the TXT record is required (it proves ownership);
// the CNAME is reported so the owner knows whether visitors already reach the site.
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  requireFeature('customDomain', 'Your own domain');
  const a = await (prisma.agency.findUniqueOrThrow({ where: { id: requireAgency().id } }));
  if (!a.pendingDomain || !a.domainToken) throw new HttpError(400, 'Add a domain first');
  const txt = await dns.resolveTxt(txtName(a.pendingDomain)).then((r) => r.map((parts) => parts.join('')), () => [] as string[]);
  const cname = await dns.resolveCname(a.pendingDomain).catch(() => [] as string[]);
  const ownership = txt.includes(a.domainToken);
  const pointing = cname.some((c) => c.replace(/\.$/, '') === target());
  if (!ownership) {
    res.json({ verified: false, ownership, pointing, message: 'The TXT record was not found yet. DNS changes can take up to a few hours.' });
    return;
  }
  await (prisma.agency.update({
    where: { id: a.id },
    data: { customDomain: a.pendingDomain, pendingDomain: null, domainToken: null, domainVerifiedAt: new Date() },
  }));
  forgetAgency();
  await registerWithHost(a.pendingDomain);
  await audit(req, 'domain:verified', 'agency', a.id, a.pendingDomain);
  await platformEvent(`agency: ${a.slug}`, 'custom-domain', a.id, a.pendingDomain);
  res.json({ verified: true, ownership, pointing, ...(await view()) });
});

router.delete('/', async (req: Request, res: Response): Promise<void> => {
  const a = await (prisma.agency.findUniqueOrThrow({ where: { id: requireAgency().id } }));
  await (prisma.agency.update({ where: { id: a.id }, data: { customDomain: null, pendingDomain: null, domainToken: null, domainVerifiedAt: null } }));
  forgetAgency();
  await audit(req, 'domain:remove', 'agency', a.id, a.customDomain ?? a.pendingDomain ?? '');
  res.json(await view());
});

// On Render, a domain must also be added to the web service so it gets an HTTPS certificate
async function registerWithHost(domain: string): Promise<void> {
  const key = process.env.RENDER_API_KEY, service = process.env.RENDER_SERVICE_ID;
  if (!key || !service) return;
  try {
    const res = await fetch(`https://api.render.com/v1/services/${service}/custom-domains`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: domain }),
    });
    if (!res.ok && res.status !== 409) console.error(`[DOMAIN] Render refused ${domain}: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`[DOMAIN] Could not register ${domain} with Render:`, (err as Error).message);
  }
}

export default router;
