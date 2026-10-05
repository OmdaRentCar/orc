import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

process.env.AGENCY_URL_TEMPLATE = 'http://{slug}.localhost:5173';

// Platform emails are captured instead of sent
const mails: { to: string | null | undefined; subject: string }[] = [];
vi.mock('../src/services/platformEmail', () => ({
  sendPlatformEmail: async (to: string | null | undefined, subject: string) => {
    mails.push({ to, subject });
    return true;
  },
}));

const { createApp } = await import('../src/app');
const { default: prisma } = await import('../src/lib/prisma');
const { runAsAgency, runUnscoped, AGENCY_SELECT } = await import('../src/lib/tenant');
const { effectiveStatus } = await import('../src/lib/subscription');
const { runSubscriptionJobs } = await import('../src/services/subscriptionJobs');
const { forgetAgency } = await import('../src/middleware/agency');
const { addDaysISO, todayISO } = await import('../src/lib/dates');

const app = createApp();
const DAY = 86_400_000;
const SLUGS = ['saas-new', 'saas-starter', 'saas-paused', 'saas-other'];
const site = (slug: string) => ({ 'X-Agency-Slug': slug });
const bearer = (slug: string, token: string) => ({ ...site(slug), Authorization: `Bearer ${token}` });

async function makeAgency(slug: string, data: Record<string, unknown>) {
  const agency = await runUnscoped(() => prisma.agency.create({ data: { slug, name: slug, ownerEmail: `${slug}@agency.test`, ...data }, select: AGENCY_SELECT }));
  await runAsAgency(agency, async () => {
    await prisma.adminUser.create({ data: { username: 'boss', email: `${slug}@agency.test`, role: 'owner', passwordHash: await bcrypt.hash('saas-pass-1', 4) } });
  });
  return agency;
}
const login = async (slug: string) => (await request(app).post('/api/auth/login').set(site(slug)).send({ username: 'boss', password: 'saas-pass-1' })).body.token as string;
const addCar = (slug: string, token: string, brand = 'Kia') =>
  request(app).post('/api/cars').set(bearer(slug, token)).field('brand', brand).field('model', 'Picanto').field('type', 'Sedan').field('year', '2023').field('price', '80');

let consoleToken = '';

beforeAll(async () => {
  await runUnscoped(async () => {
    await prisma.agency.deleteMany({ where: { slug: { in: SLUGS } } });
    await prisma.platformAdmin.deleteMany({ where: { email: 'console@saas.test' } });
    await prisma.platformAdmin.create({ data: { email: 'console@saas.test', name: 'Console', passwordHash: await bcrypt.hash('console-pass-1', 4) } });
  });
  consoleToken = (await request(app).post('/api/platform/console/login').send({ email: 'console@saas.test', password: 'console-pass-1' })).body.token;
});

afterAll(async () => {
  await runUnscoped(async () => {
    await prisma.agency.deleteMany({ where: { slug: { in: SLUGS } } });
    await prisma.platformAdmin.deleteMany({ where: { email: 'console@saas.test' } });
  });
  await prisma.$disconnect();
});

describe('subscription status', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const ago = (d: number) => new Date(now.getTime() - d * DAY);
  it('follows the dates: trial, past due during the grace period, then suspended', () => {
    expect(effectiveStatus({ status: 'trial', trialEndsAt: ago(-3) }, now)).toBe('trial');
    expect(effectiveStatus({ status: 'trial', trialEndsAt: ago(2) }, now)).toBe('past_due');
    expect(effectiveStatus({ status: 'trial', trialEndsAt: ago(9) }, now)).toBe('suspended');
    expect(effectiveStatus({ status: 'active', currentPeriodEnd: null }, now)).toBe('active');
    expect(effectiveStatus({ status: 'active', currentPeriodEnd: ago(1) }, now)).toBe('past_due');
    expect(effectiveStatus({ status: 'suspended' }, now)).toBe('suspended');
  });
});

describe('sign-up', () => {
  it('checks addresses: format, reserved words, taken, with a suggestion', async () => {
    expect((await request(app).get('/api/platform/slug').query({ slug: 'Saas New' })).body).toMatchObject({ slug: 'saas-new', available: true });
    expect((await request(app).get('/api/platform/slug').query({ slug: 'www' })).body.available).toBe(false);
    expect((await request(app).get('/api/platform/slug').query({ slug: 'rentcar' })).body).toMatchObject({ available: false, suggestion: 'rentcar-2' });
  });

  it('creates an agency on a free trial with its owner, and hands the owner over to the new dashboard', async () => {
    const res = await request(app).post('/api/platform/signup').send({
      agencyName: 'Saas New', slug: 'saas-new', city: 'Sfax', phone: '+216 74 111 222',
      username: 'founder', email: 'founder@saas.test', password: 'founder-pass-1', plan: 'pro', acceptTerms: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.siteUrl).toBe('http://saas-new.localhost:5173');
    expect(mails.some((m) => m.to === 'founder@saas.test')).toBe(true);

    const code = res.body.loginUrl.split('#handoff=')[1];
    // The code only works on the new agency's site, and only once
    expect((await request(app).post('/api/auth/handoff').set(site('rentcar')).send({ code })).status).toBe(401);
    const handed = await request(app).post('/api/auth/handoff').set(site('saas-new')).send({ code });
    expect(handed.status).toBe(200);
    expect(handed.body.user).toMatchObject({ username: 'founder', role: 'owner' });
    expect((await request(app).post('/api/auth/handoff').set(site('saas-new')).send({ code })).status).toBe(401);

    const profile = (await request(app).get('/api/agency').set(site('saas-new'))).body;
    expect(profile).toMatchObject({ name: 'Saas New', city: 'Sfax', status: 'trial', plan: 'pro' });
    expect(profile.subscription.trialDaysLeft).toBe(14);
    const settings = (await request(app).get('/api/settings').set(site('saas-new'))).body;
    expect(settings).toMatchObject({ contactEmail: 'founder@saas.test', companyName: 'Saas New', whatsappNumber: '21674111222' });
  });

  it('refuses a taken address and a missing acceptance', async () => {
    const base = { agencyName: 'XY Cars', slug: 'saas-new', city: 'Sfax', phone: '+216 74 111 222', username: 'x-user', email: 'x@saas.test', password: 'x-pass-123', plan: 'starter', acceptTerms: true };
    expect((await request(app).post('/api/platform/signup').send(base)).status).toBe(409);
    expect((await request(app).post('/api/platform/signup').send({ ...base, slug: 'saas-other', acceptTerms: false })).status).toBe(400);
  });
});

describe('plan limits', () => {
  let token = '';
  beforeAll(async () => {
    await makeAgency('saas-starter', { plan: 'starter', status: 'trial', trialEndsAt: new Date(Date.now() + 5 * DAY) });
    token = await login('saas-starter');
  });

  it('stops at the number of cars in the plan', async () => {
    for (let i = 0; i < 5; i++) expect((await addCar('saas-starter', token, `Car${i}`)).status).toBe(201);
    const sixth = await addCar('saas-starter', token);
    expect(sixth.status).toBe(402);
    expect(sixth.body.error).toMatch(/Starter plan allows 5 cars/);
  });

  it('stops at the number of accounts in the plan', async () => {
    const add = (n: number) => request(app).post('/api/admins').set(bearer('saas-starter', token)).send({ username: `staff${n}`, email: `staff${n}@saas.test`, password: 'staff-pass-1', role: 'staff' });
    expect((await add(1)).status).toBe(201);
    expect((await add(2)).status).toBe(402);
  });

  it('keeps online signature for higher plans', async () => {
    const car = await runUnscoped(() => prisma.car.findFirst({ where: { agency: { slug: 'saas-starter' } } }));
    const booking = await runAsAgency((await runUnscoped(() => prisma.agency.findUniqueOrThrow({ where: { slug: 'saas-starter' }, select: AGENCY_SELECT }))), () => prisma.booking.create({
      data: { reference: 'RC-SAASX1', carId: car!.id, guestName: 'Client', phone: '20000000', email: 'c@saas.test', startDate: addDaysISO(todayISO(), 3), endDate: addDaysISO(todayISO(), 5), status: 'approved', subtotal: 160, total: 160 },
    }));
    const res = await request(app).post(`/api/bookings/${booking.id}/contract/send`).set(bearer('saas-starter', token)).send({});
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/not included in your plan/);
  });

  it('pays online (test mode) to upgrade: plan, period and invoice follow', async () => {
    const before = (await request(app).get('/api/billing').set(bearer('saas-starter', token))).body;
    expect(before).toMatchObject({ provider: 'manual', usage: { cars: 5, users: 2 } });
    expect(before.subscription).toMatchObject({ status: 'trial', plan: 'starter' });

    const checkout = await request(app).post('/api/billing/checkout').set(bearer('saas-starter', token)).send({ plan: 'pro', cycle: 'yearly' });
    expect(checkout.status).toBe(200);
    expect(checkout.body.payUrl).toBe(`http://saas-starter.localhost:5173/admin/billing/test-pay/${checkout.body.invoiceId}`);

    // Staff cannot see or pay the subscription
    const staffToken = (await request(app).post('/api/auth/login').set(site('saas-starter')).send({ username: 'staff1', password: 'staff-pass-1' })).body.token;
    expect((await request(app).get('/api/billing').set(bearer('saas-starter', staffToken))).status).toBe(403);

    const pay = await request(app).post(`/api/billing/invoices/${checkout.body.invoiceId}/test-pay`).set(bearer('saas-starter', token)).send({ outcome: 'paid' });
    expect(pay.body.state).toBe('paid');
    // Paying twice changes nothing
    expect((await request(app).post(`/api/billing/invoices/${checkout.body.invoiceId}/test-pay`).set(bearer('saas-starter', token)).send({ outcome: 'paid' })).status).toBe(409);

    const after = (await request(app).get('/api/billing').set(bearer('saas-starter', token))).body;
    expect(after.subscription).toMatchObject({ status: 'active', plan: 'pro', cycle: 'yearly' });
    const days = (new Date(after.subscription.currentPeriodEnd).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThan(367);
    expect(after.invoices[0]).toMatchObject({ status: 'paid', amount: 1290, planName: 'Pro' });
    expect(after.invoices[0].number).toMatch(/^INV-\d{4}-\d{5}$/);

    const pdf = await request(app).get(`/api/billing/invoices/${after.invoices[0].id}/pdf`).set(bearer('saas-starter', token)).buffer(true);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');

    // The Pro plan now allows a 6th car and an online signature
    expect((await addCar('saas-starter', token, 'Sixth')).status).toBe(201);
  });
});

describe('suspension', () => {
  let token = '';
  beforeAll(async () => {
    await makeAgency('saas-paused', { plan: 'starter', status: 'trial', trialEndsAt: new Date(Date.now() - 2 * DAY), city: 'Bizerte' });
    token = await login('saas-paused');
  });

  it('marks an expired trial past due, then suspends it after the grace period, emailing the owner', async () => {
    const first = await runSubscriptionJobs();
    expect(first.pastDue).toBeGreaterThanOrEqual(1);
    const row = await runUnscoped(() => prisma.agency.findUniqueOrThrow({ where: { slug: 'saas-paused' } }));
    expect(row.status).toBe('past_due');
    expect((await request(app).get('/api/cars').set(site('saas-paused'))).status).toBe(200);

    const later = new Date(Date.now() + 8 * DAY);
    const second = await runSubscriptionJobs(later);
    expect(second.suspended).toBeGreaterThanOrEqual(1);
    expect(mails.filter((m) => m.to === 'saas-paused@agency.test').map((m) => m.subject)).toEqual(expect.arrayContaining(['Paiement en attente', 'Site mis en pause']));
    forgetAgency();
  });

  it('closes the site and dashboard of a suspended agency, except login and billing', async () => {
    const cars = await request(app).get('/api/cars').set(site('saas-paused'));
    expect(cars.status).toBe(402);
    expect(cars.body.code).toBe('agency_suspended');
    expect((await request(app).get('/api/bookings').set(bearer('saas-paused', token))).status).toBe(402);
    expect((await request(app).get('/api/agency').set(site('saas-paused'))).body.status).toBe('suspended');
    expect((await request(app).get('/api/billing').set(bearer('saas-paused', token))).status).toBe(200);
    expect((await request(app).post('/api/auth/login').set(site('saas-paused')).send({ username: 'boss', password: 'saas-pass-1' })).status).toBe(200);
  });

  it('reopens everything as soon as the agency pays', async () => {
    const checkout = (await request(app).post('/api/billing/checkout').set(bearer('saas-paused', token)).send({ plan: 'starter', cycle: 'monthly' })).body;
    await request(app).post(`/api/billing/invoices/${checkout.invoiceId}/test-pay`).set(bearer('saas-paused', token)).send({ outcome: 'paid' });
    expect((await request(app).get('/api/cars').set(site('saas-paused'))).status).toBe(200);
    expect((await request(app).get('/api/agency').set(site('saas-paused'))).body.status).toBe('active');
  });
});

describe('platform console', () => {
  const auth = () => ({ Authorization: `Bearer ${consoleToken}` });

  it('is closed without a console login, and agency logins do not open it', async () => {
    expect((await request(app).get('/api/platform/console/overview')).status).toBe(401);
    const agencyToken = await login('saas-starter');
    expect((await request(app).get('/api/platform/console/overview').set({ Authorization: `Bearer ${agencyToken}` })).status).toBe(401);
    // ...and a console token is not an agency login
    expect((await request(app).get('/api/bookings').set(bearer('saas-starter', consoleToken))).status).toBe(401);
  });

  it('shows every agency with its status and revenue', async () => {
    const overview = (await request(app).get('/api/platform/console/overview').set(auth())).body;
    expect(overview.total).toBeGreaterThanOrEqual(3);
    expect(overview.mrr).toBeGreaterThan(0);
    expect(overview.revenue).toHaveLength(12);
    const list = (await request(app).get('/api/platform/console/agencies').set(auth()).query({ q: 'saas' })).body as { slug: string; status: string; counts: { cars: number } }[];
    expect(list.find((a) => a.slug === 'saas-starter')).toMatchObject({ status: 'active', counts: { cars: 6 } });
  });

  it('records a bank transfer, extends a trial, and opens an agency dashboard for support', async () => {
    const other = await makeAgency('saas-other', { plan: 'starter', status: 'trial', trialEndsAt: new Date(Date.now() + DAY) });
    const ext = await request(app).post(`/api/platform/console/agencies/${other.id}/extend-trial`).set(auth()).send({ days: 10 });
    expect(Math.round((new Date(ext.body.trialEndsAt).getTime() - Date.now()) / DAY)).toBe(11);

    const pay = await request(app).post(`/api/platform/console/agencies/${other.id}/payment`).set(auth()).send({ plan: 'business', cycle: 'monthly', method: 'transfer', note: 'Virement BIAT' });
    expect(pay.status).toBe(201);
    expect(pay.body).toMatchObject({ status: 'paid', provider: 'transfer', amount: 249 });
    const detail = (await request(app).get(`/api/platform/console/agencies/${other.id}`).set(auth())).body;
    expect(detail).toMatchObject({ status: 'active', plan: 'business', totalPaid: 249 });
    expect(detail.events.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['extend-trial', 'payment']));

    const open = await request(app).post(`/api/platform/console/agencies/${other.id}/impersonate`).set(auth());
    const code = open.body.url.split('#handoff=')[1];
    const handed = await request(app).post('/api/auth/handoff').set(site('saas-other')).send({ code });
    expect(handed.body.user.username).toBe('boss');
  });

  it('deletes an agency only when its address is typed', async () => {
    const other = (await request(app).get('/api/platform/console/agencies').set(auth()).query({ q: 'saas-other' })).body[0];
    expect((await request(app).delete(`/api/platform/console/agencies/${other.id}`).set(auth()).send({ confirm: 'nope' })).status).toBe(400);
    expect((await request(app).delete(`/api/platform/console/agencies/${other.id}`).set(auth()).send({ confirm: 'saas-other' })).status).toBe(200);
    expect((await request(app).get('/api/agency').set(site('saas-other'))).status).toBe(404);
  });
});

describe('general page', () => {
  it('lists the agencies that have cars, linking to their own site', async () => {
    const agency = await runUnscoped(() => prisma.agency.findUniqueOrThrow({ where: { slug: 'saas-starter' }, select: AGENCY_SELECT }));
    await runUnscoped(() => prisma.agency.update({ where: { id: agency.id }, data: { city: 'Gabès' } }));
    const list = (await request(app).get('/api/platform/agencies')).body as { slug: string; city: string; cars: number; siteUrl: string }[];
    expect(list.find((a) => a.slug === 'saas-starter')).toMatchObject({ city: 'Gabès', cars: 6, siteUrl: 'http://saas-starter.localhost:5173' });
    // Saas New has no car yet: nothing to show
    expect(list.some((a) => a.slug === 'saas-new')).toBe(false);
    const stats = (await request(app).get('/api/platform/stats')).body;
    expect(stats.agencies).toBeGreaterThanOrEqual(2);
    expect(stats.cities).toBeGreaterThanOrEqual(1);
    expect(stats.trialDays).toBe(14);
  });

  it('hides agencies that opted out, and has no car marketplace any more', async () => {
    await runUnscoped(() => prisma.agency.update({ where: { slug: 'saas-starter' }, data: { listed: false } }));
    expect(((await request(app).get('/api/platform/agencies')).body as { slug: string }[]).some((a) => a.slug === 'saas-starter')).toBe(false);
    expect((await request(app).get('/api/platform/marketplace/cars')).status).toBe(404);
  });

  it('ignores webhooks for unknown payments', async () => {
    expect((await request(app).get('/api/platform/payments/konnect/webhook').query({ payment_ref: 'nope' })).status).toBe(404);
  });
});

describe('single login', () => {
  it('finds every agency this login opens, and the console', async () => {
    const res = await request(app).post('/api/platform/login').send({ login: 'boss', password: 'saas-pass-1' });
    expect(res.status).toBe(200);
    const slugs = (res.body.agencies as { slug: string }[]).map((a) => a.slug);
    expect(slugs).toEqual(expect.arrayContaining(['saas-starter', 'saas-paused']));
    expect(res.body.console).toBeNull();
    // Each entry carries a one-time link that logs straight into that agency
    const entry = res.body.agencies.find((a: { slug: string }) => a.slug === 'saas-starter');
    const code = entry.loginUrl.split('#handoff=')[1];
    expect((await request(app).post('/api/auth/handoff').set(site('saas-starter')).send({ code })).body.user.username).toBe('boss');
  });

  it('works with the email too, and opens the console for the platform team', async () => {
    const byEmail = await request(app).post('/api/platform/login').send({ login: 'SAAS-STARTER@agency.test', password: 'saas-pass-1' });
    expect(byEmail.body.agencies.map((a: { slug: string }) => a.slug)).toEqual(['saas-starter']);
    const consoleLogin = await request(app).post('/api/platform/login').send({ login: 'console@saas.test', password: 'console-pass-1' });
    expect(consoleLogin.body.console.token).toBeTruthy();
    expect((await request(app).get('/api/platform/console/me').set({ Authorization: `Bearer ${consoleLogin.body.console.token}` })).status).toBe(200);
  });

  it('refuses a wrong password and skips closed agencies', async () => {
    expect((await request(app).post('/api/platform/login').send({ login: 'boss', password: 'nope' })).status).toBe(401);
    await runUnscoped(() => prisma.agency.update({ where: { slug: 'saas-paused' }, data: { status: 'cancelled' } }));
    const res = await request(app).post('/api/platform/login').send({ login: 'boss', password: 'saas-pass-1' });
    expect(res.body.agencies.map((a: { slug: string }) => a.slug)).not.toContain('saas-paused');
  });
});
