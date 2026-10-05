import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Each agency's links point to its own sub-domain
process.env.AGENCY_URL_TEMPLATE = 'http://{slug}.localhost:5173';

// Emails are captured instead of sent
const sent: { kind: string; opts?: { actionUrl?: string } }[] = [];
vi.mock('../src/services/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/email')>();
  return {
    ...actual,
    sendBookingEmail: async (kind: string, _to: unknown, _b: unknown, _a: unknown = [], opts = {}) => {
      sent.push({ kind, opts });
      return true;
    },
  };
});

const { createApp } = await import('../src/app');
const { default: prisma } = await import('../src/lib/prisma');
const { runAsAgency, runUnscoped, AGENCY_SELECT } = await import('../src/lib/tenant');
const { addDaysISO, todayISO } = await import('../src/lib/dates');
type Agency = { id: number; slug: string; name: string; customDomain: string | null };

// Two agencies on the same platform, each with an owner called "boss" and one car
const app = createApp();
const PASSWORD = 'isolation-pass-1';
const day = (n: number) => addDaysISO(todayISO(), n);
const as = { a: null as unknown as Agency, b: null as unknown as Agency };
const token = { a: '', b: '' };
const car = { a: 0, b: 0 };

// A request "to the site of" an agency, as its sub-domain would send it
const to = (who: 'a' | 'b') => ({ 'X-Agency-Slug': as[who].slug });
const admin = (who: 'a' | 'b', tok = token[who]) => ({ ...to(who), Authorization: `Bearer ${tok}` });

function book(who: 'a' | 'b', phone = '+216 22 333 444') {
  const req = request(app).post('/api/bookings/public').set(to(who));
  for (const [k, v] of Object.entries({
    car_id: String(car[who]), guest_name: `Guest ${who.toUpperCase()}`, phone, email: `${who}@guest.test`,
    birth_date: '1990-05-01', license_issue_date: '2012-01-01', start_date: day(5), end_date: day(7),
  })) req.field(k, v);
  return req;
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const who of ['a', 'b'] as const) {
    const slug = `iso-${who}`;
    as[who] = await runUnscoped(async () => {
      await prisma.agency.deleteMany({ where: { slug } });
      return prisma.agency.create({ data: { slug, name: `Agency ${who.toUpperCase()}` }, select: AGENCY_SELECT });
    });
    await runAsAgency(as[who], async () => {
      await prisma.adminUser.create({ data: { username: 'boss', email: 'boss@agency.test', role: 'owner', passwordHash } });
      car[who] = (await prisma.car.create({ data: { brand: `Brand${who.toUpperCase()}`, model: 'Iso', type: 'SUV', year: 2024, price: 100 } })).id;
    });
    token[who] = (await request(app).post('/api/auth/login').set(to(who)).send({ username: 'boss', password: PASSWORD })).body.token;
  }
});

afterAll(async () => {
  // Removing an agency removes everything it owns
  await runUnscoped(() => prisma.agency.deleteMany({ where: { slug: { in: ['iso-a', 'iso-b'] } } }));
  await prisma.$disconnect();
});

describe('agency isolation', () => {
  it('lets two agencies use the same username, each logging into its own dashboard', () => {
    expect(token.a).toBeTruthy();
    expect(token.b).toBeTruthy();
    expect(token.a).not.toBe(token.b);
  });

  it('refuses a login token on another agency', async () => {
    expect((await request(app).get('/api/auth/me').set(admin('a'))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(admin('b', token.a))).status).toBe(401);
    expect((await request(app).get('/api/bookings').set(admin('b', token.a))).status).toBe(401);
  });

  it('shows each site only its own cars', async () => {
    const a = (await request(app).get('/api/cars').set(to('a'))).body as { id: number }[];
    expect(a.map((c) => c.id)).toEqual([car.a]);
    expect((await request(app).get(`/api/cars/${car.b}`).set(to('a'))).status).toBe(404);
    expect((await request(app).put(`/api/cars/${car.b}`).set(admin('a')).send({ price: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/cars/${car.b}`).set(admin('a'))).status).toBe(404);
  });

  it('refuses to book another agency’s car', async () => {
    const req = request(app).post('/api/bookings/public').set(to('a'));
    for (const [k, v] of Object.entries({ car_id: String(car.b), guest_name: 'Sneaky', phone: '+216 20 111 222', birth_date: '1990-05-01', license_issue_date: '2012-01-01', start_date: day(5), end_date: day(7) })) req.field(k, v);
    expect((await req).status).toBe(404);
  });

  it('keeps bookings, customers and their status pages apart', async () => {
    const b = await book('b');
    expect(b.status).toBe(201);

    expect((await request(app).get('/api/bookings').set(admin('a'))).body.bookings ?? []).toEqual([]);
    expect((await request(app).get(`/api/bookings/${b.body.id}`).set(admin('a'))).status).toBe(404);
    expect((await request(app).put(`/api/bookings/${b.body.id}/status`).set(admin('a')).send({ status: 'approved' })).status).toBe(404);
    expect((await request(app).get('/api/customers').set(admin('a'))).body).toEqual([]);
    expect((await request(app).get('/api/bookings/status').set(to('a')).query({ reference: b.body.reference, phone: '22333444' })).status).toBe(404);
    expect((await request(app).get('/api/bookings/status').set(to('b')).query({ reference: b.body.reference, phone: '22333444' })).status).toBe(200);
  });

  it('keeps blacklists separate: a customer blocked by one agency can still book with another', async () => {
    expect((await request(app).post('/api/customers/block').set(admin('a')).send({ phone: '+216 55 666 777', reason: 'Unpaid' })).status).toBe(201);
    expect((await book('a', '+216 55 666 777')).status).toBe(403);
    expect((await book('b', '+216 55 666 777')).status).toBe(201);
  });

  it('keeps settings separate', async () => {
    const before = (await request(app).get('/api/settings').set(to('b'))).body;
    expect((await request(app).put('/api/settings').set(admin('a')).send({ ...before, whatsappNumber: '21671999999' })).status).toBe(200);
    expect((await request(app).get('/api/settings').set(to('a'))).body.whatsappNumber).toBe('21671999999');
    expect((await request(app).get('/api/settings').set(to('b'))).body.whatsappNumber).toBe(before.whatsappNumber);
  });

  it('keeps fines, the dashboard and notifications separate', async () => {
    const fine = await request(app).post('/api/fines').set(admin('b')).send({ carId: car.b, date: day(6), time: '10:00', amount: 40 });
    expect(fine.status).toBe(201);
    expect((await request(app).get('/api/fines').set(admin('a'))).body).toEqual([]);
    expect((await request(app).post('/api/fines').set(admin('a')).send({ carId: car.b, date: day(6), time: '10:00', amount: 40 })).status).toBe(404);

    const statsA = (await request(app).get('/api/dashboard').set(admin('a'))).body;
    const statsB = (await request(app).get('/api/dashboard').set(admin('b'))).body;
    expect(statsA).toMatchObject({ totalCars: 1, totalBookings: 0, revenue: 0 });
    expect(statsB).toMatchObject({ totalCars: 1, totalBookings: 2 });
    const notesA = (await request(app).get('/api/dashboard/notifications').set(admin('a'))).body as { message: string }[];
    expect(notesA.some((n) => n.message.includes('Guest B'))).toBe(false);
  });

  it('makes a signing link from one agency useless on another agency’s site', async () => {
    const b = (await request(app).get('/api/bookings').set(admin('b'))).body;
    const id = (b.bookings ?? b)[0].id;
    expect((await request(app).put(`/api/bookings/${id}/status`).set(admin('b')).send({ status: 'approved' })).status).toBe(200);
    const link = (await request(app).post(`/api/bookings/${id}/contract/send`).set(admin('b')).send({})).body.link as string;
    const t = link.split('/sign/')[1];
    expect(link).toContain('iso-b');
    expect((await request(app).get(`/api/sign/${t}`).set(to('a'))).status).toBe(404);
    expect((await request(app).get(`/api/sign/${t}`).set(to('b'))).status).toBe(200);
    expect((await request(app).post(`/api/bookings/${id}/contract/send`).set(admin('a')).send({})).status).toBe(404);
  });

  it('stores each agency’s uploads in its own folder', async () => {
    const { cloudinary } = await import('../src/services/cloudinary');
    const { PassThrough } = await import('stream');
    const folders: string[] = [];
    const spy = vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(((opts: { folder: string }, cb: (e: unknown, r: unknown) => void) => {
      folders.push(opts.folder);
      const sink = new PassThrough();
      sink.on('finish', () => cb(null, { secure_url: `https://res.cloudinary.com/x/image/upload/v1/${opts.folder}/p.jpg`, public_id: 'p' }));
      sink.resume();
      return sink;
    }) as never);
    try {
      const res = await request(app).post('/api/cars').set(admin('b'))
        .field('brand', 'Up').field('model', 'Load').field('type', 'SUV').field('year', '2024').field('price', '90')
        .attach('image', Buffer.alloc(2048, 1), { filename: 'car.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(201);
      expect(folders).toEqual([`agencies/${as.b.id}/cars`]);
      expect(res.body.image).toContain(`agencies/${as.b.id}/cars`);
      expect((await request(app).get(`/api/cars/${res.body.id}`).set(to('a'))).status).toBe(404);
    } finally {
      spy.mockRestore();
    }
  });

  it('answers 404 for an agency that does not exist', async () => {
    const res = await request(app).get('/api/cars').set('X-Agency-Slug', 'no-such-agency');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Unknown agency');
  });

  it('refuses any database query made outside an agency', async () => {
    await expect(prisma.car.findMany()).rejects.toThrow(/no agency/);
    await expect(runAsAgency(as.a, () => prisma.car.count())).resolves.toBe(1);
  });
});
