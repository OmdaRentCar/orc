import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Handover photos go to Cloudinary in real life; here they are kept in memory so the flow can run offline
vi.mock('../src/services/cloudinary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/cloudinary')>();
  const multer = (await import('multer')).default;
  let n = 0;
  const memoryStorage = {
    _handleFile(_req: unknown, file: { stream: NodeJS.ReadableStream }, cb: (e: Error | null, info?: { path: string }) => void) {
      file.stream.resume();
      file.stream.on('end', () => cb(null, { path: `https://res.cloudinary.com/test/image/authenticated/v1/rentcar/handover/photo${++n}.jpg` }));
    },
    _removeFile(_req: unknown, _file: unknown, cb: (e: Error | null) => void) { cb(null); },
  };
  return {
    ...actual,
    uploadHandoverPhotos: multer({ storage: memoryStorage as never, limits: { fieldSize: 2 * 1024 * 1024 } }).array('photos', 16),
    uploadPrivateImage: async () => 'https://res.cloudinary.com/test/image/authenticated/v1/rentcar/handover/signature.png',
    deleteAsset: async () => {},
    signedImageUrl: (url: string) => url,
  };
});
// PDFs try to download the photos; with no network in tests they are simply left out
vi.stubGlobal('fetch', async () => ({ ok: false }));

const { createApp } = await import('../src/app');
const { default: prisma } = await import('../src/lib/prisma');
const { addDaysISO, todayISO } = await import('../src/lib/dates');
const { returnCharges } = await import('../src/services/handover');
const { runReminders, runCarAlerts } = await import('../src/services/jobs');
const { DEFAULT_SETTINGS } = await import('../src/services/settings');

const app = createApp();
const day = (n: number) => addDaysISO(todayISO(), n);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });

async function newCar(fields: Record<string, string> = {}) {
  const req = request(app).post('/api/cars').set(auth());
  for (const [k, v] of Object.entries({ brand: 'Ops', model: `Car ${Math.random().toString(36).slice(2, 7)}`, type: 'Sedan', year: '2024', price: '100', ...fields })) req.field(k, v);
  const res = await req;
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: number; plateNumber: string | null };
}

async function adminBooking(carId: number, startDate: string, endDate: string, extra: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/bookings').set(auth()).send({ carId, guestName: 'Ops Guest', phone: '+216 29 000 000', startDate, endDate, status: 'approved', ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: number; reference: string };
}

function inspection(bookingId: number, fields: Record<string, string>, photos = 4) {
  const req = request(app).post(`/api/bookings/${bookingId}/inspections`).set(auth());
  for (const [k, v] of Object.entries({ signature: PNG, signerName: 'Ops Guest', ...fields })) req.field(k, v);
  for (let i = 0; i < photos; i++) req.attach('photos', Buffer.from(`photo-${i}`), { filename: `p${i}.jpg`, contentType: 'image/jpeg' });
  return req;
}

async function setSettings(patch: Record<string, unknown>) {
  const current = (await request(app).get('/api/settings')).body;
  const res = await request(app).put('/api/settings').set(auth()).send({ ...current, ...patch });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

beforeAll(async () => {
  await prisma.adminUser.upsert({
    where: { username: 'ops-owner' },
    create: { username: 'ops-owner', email: 'ops-owner@test.local', role: 'owner', passwordHash: await bcrypt.hash('ops-password-1', 4) },
    update: {},
  });
  token = (await request(app).post('/api/auth/login').send({ username: 'ops-owner', password: 'ops-password-1' })).body.token;
});

afterAll(async () => {
  await request(app).put('/api/settings').set(auth()).send(DEFAULT_SETTINGS);
  // The other test file checks "at least one owner" rules, so leave no extra owner behind
  await prisma.adminUser.delete({ where: { username: 'ops-owner' } });
  await prisma.$disconnect();
});

describe('seasonal and weekend pricing', () => {
  it('charges each day at its season rate', async () => {
    const car = await newCar();
    await setSettings({ seasons: [{ name: 'Summer', from: '07-01', to: '08-31', pct: 20 }], weekendPct: 0 });
    // 29 and 30 June at 100, 1 and 2 July at 120
    const q = (await request(app).post('/api/bookings/quote').send({ carId: car.id, startDate: '2027-06-29', endDate: '2027-07-03' })).body;
    expect(q.subtotal).toBe(440);
    expect(q.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ days: 2, rate: 100 }),
      expect.objectContaining({ days: 2, rate: 120, label: 'Summer' }),
    ]));
  });

  it('adds the weekend percentage on Saturdays and Sundays', async () => {
    const car = await newCar();
    await setSettings({ seasons: [], weekendPct: 50 });
    // Friday 8, Saturday 9, Sunday 10 January 2027
    const q = (await request(app).post('/api/bookings/quote').send({ carId: car.id, startDate: '2027-01-08', endDate: '2027-01-11' })).body;
    expect(q.subtotal).toBe(400);
    await setSettings({ weekendPct: 0 });
  });
});

describe('driver requirements', () => {
  const book = (carId: number, fields: Record<string, string>) => {
    const req = request(app).post('/api/bookings/public');
    for (const [k, v] of Object.entries({ car_id: String(carId), guest_name: 'Young Driver', phone: '+216 21 000 001', start_date: day(30), end_date: day(32), birth_date: '1990-01-01', license_issue_date: '2015-01-01', ...fields })) req.field(k, v);
    return req;
  };

  it('refuses drivers under the minimum age or with a too recent licence', async () => {
    const car = await newCar();
    const young = await book(car.id, { birth_date: addDaysISO(day(30), -365 * 19) });
    expect(young.status).toBe(400);
    expect(young.body.error).toMatch(/at least 21/);
    const newLicence = await book(car.id, { license_issue_date: day(-100) });
    expect(newLicence.status).toBe(400);
    expect(newLicence.body.error).toMatch(/licence/);
    expect((await book(car.id, { license_expiry: day(31) })).status).toBe(400);
    expect((await book(car.id, {})).status).toBe(201);
  });

  it('requires date of birth and licence date on online bookings', async () => {
    const car = await newCar();
    const req = request(app).post('/api/bookings/public');
    for (const [k, v] of Object.entries({ car_id: String(car.id), guest_name: 'No Dates', phone: '+216 21 000 002', start_date: day(30), end_date: day(31) })) req.field(k, v);
    expect((await req).status).toBe(400);
  });
});

describe('car documents', () => {
  it('blocks bookings past an insurance expiry and flags expired documents', async () => {
    const car = await newCar({ insuranceExpiry: day(5) });
    const pub = request(app).post('/api/bookings/public');
    for (const [k, v] of Object.entries({ car_id: String(car.id), guest_name: 'Doc Check', phone: '+216 21 000 003', start_date: day(3), end_date: day(10), birth_date: '1990-01-01', license_issue_date: '2015-01-01' })) pub.field(k, v);
    expect((await pub).status).toBe(400);

    const admin = await request(app).post('/api/bookings').set(auth()).send({ carId: car.id, guestName: 'Doc Check', phone: '+216 21 000 003', startDate: day(3), endDate: day(10), status: 'approved' });
    expect(admin.status).toBe(409);
    expect(admin.body.error).toMatch(/Insurance expires/);

    expect((await adminBooking(car.id, day(1), day(4))).id).toBeGreaterThan(0);

    const expired = await newCar({ vignetteExpiry: day(-1) });
    const listed = (await request(app).get('/api/cars')).body.find((c: { id: number }) => c.id === expired.id);
    expect(listed.documentsExpired).toEqual(['Vignette']);
  });

  it('sends each document alert once', async () => {
    await newCar({ inspectionExpiry: day(5) });
    expect(await runCarAlerts()).toBeGreaterThan(0);
    expect(await runCarAlerts()).toBe(0);
  });
});

describe('handover: pick-up and return', () => {
  let carId = 0;
  let booking = { id: 0, reference: '' };

  beforeAll(async () => {
    await setSettings({ kmPerDayIncluded: 200, extraKmPrice: 0.5, fuelChargePerEighth: 10, lateGraceHours: 1 });
    carId = (await newCar({ plateNumber: '123 TU 4567' })).id;
    booking = await adminBooking(carId, day(0), day(2));
  });

  it('refuses a pick-up without 4 photos or a signature', async () => {
    expect((await inspection(booking.id, { type: 'checkout', mileage: '10000', fuelLevel: '8' }, 2)).status).toBe(400);
    expect((await inspection(booking.id, { type: 'checkout', mileage: '10000', fuelLevel: '8', signature: '' })).status).toBe(400);
  });

  it('records the pick-up, driver details and odometer', async () => {
    const res = await inspection(booking.id, {
      type: 'checkout', mileage: '10000', fuelLevel: '8',
      damages: JSON.stringify([{ x: 30, y: 20, note: 'Scratch front left' }]),
      idNumber: '09876543', licenseNumber: 'TN-123456', birthDate: '1990-01-01', licenseIssueDate: '2012-01-01',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.booking.status).toBe('picked_up');
    expect(res.body.booking.licenseNumber).toBe('TN-123456');
    expect((await request(app).get(`/api/cars/${carId}`)).body.mileage).toBe(10000);
    expect((await inspection(booking.id, { type: 'checkout', mileage: '10000', fuelLevel: '8' })).status).toBe(409);
  });

  it('produces the signed contract as a PDF', async () => {
    const res = await request(app).get(`/api/bookings/${booking.id}/contract.pdf`).set(auth()).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('refuses a return with a lower mileage', async () => {
    expect((await inspection(booking.id, { type: 'checkin', mileage: '9000', fuelLevel: '8' })).status).toBe(400);
  });

  it('charges extra km and missing fuel at return', async () => {
    // 2 days x 200 km included = 400 km; 500 driven -> 100 km x 0.5 = 50 DT; 2/8 fuel missing x 10 = 20 DT
    const res = await inspection(booking.id, { type: 'checkin', mileage: '10500', fuelLevel: '6' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.booking.status).toBe('completed');
    expect(res.body.charges.map((c: { kind: string; amount: number }) => [c.kind, c.amount])).toEqual([['km', 50], ['fuel', 20]]);
    expect(res.body.booking.extraChargesTotal).toBe(70);

    const report = await request(app).get(`/api/bookings/${booking.id}/return-report.pdf`).set(auth());
    expect(report.status).toBe(200);
    const inspections = (await request(app).get(`/api/bookings/${booking.id}/inspections`).set(auth())).body;
    expect(inspections.map((i: { type: string }) => i.type)).toEqual(['checkout', 'checkin']);
    expect(inspections[0].damages).toHaveLength(1);
  });

  it('adds and removes manual charges', async () => {
    const added = await request(app).post(`/api/bookings/${booking.id}/charges`).set(auth()).send({ label: 'Rear bumper scratch', amount: 30, kind: 'damage' });
    expect(added.body.extraChargesTotal).toBe(100);
    const removed = await request(app).delete(`/api/bookings/${booking.id}/charges/2`).set(auth());
    expect(removed.body.extraChargesTotal).toBe(70);
  });

  it('charges a late return by the started day', () => {
    const charges = returnCharges(
      { startDate: '2027-03-01', endDate: '2027-03-03', returnTime: '10:00', dailyRate: 100 },
      { mileage: 0, fuelLevel: 8 }, { mileage: 100, fuelLevel: 8 },
      new Date('2027-03-03T14:00:00Z'), // 15:00 in Tunis: 5 hours late
      { kmPerDayIncluded: 0, extraKmPrice: 0, fuelChargePerEighth: 0, lateGraceHours: 1 },
    );
    expect(charges).toEqual([expect.objectContaining({ kind: 'late', amount: 100 })]);
  });
});

describe('traffic fines', () => {
  it('finds who had the car at the time of the offence and charges them', async () => {
    const car = await newCar({ plateNumber: '200 TU 9999' });
    const b = await adminBooking(car.id, day(10), day(13), { pickupTime: '09:00', returnTime: '18:00' });

    const hit = await request(app).get('/api/fines/lookup').set(auth()).query({ plate: '200tu9999', date: day(11), time: '14:30' });
    expect(hit.status).toBe(200);
    expect(hit.body.matches.map((m: { reference: string }) => m.reference)).toEqual([b.reference]);
    expect(hit.body.matches[0].basedOn).toBe('booking');

    const miss = await request(app).get('/api/fines/lookup').set(auth()).query({ carId: car.id, date: day(13), time: '19:00' });
    expect(miss.body.matches).toEqual([]);

    const fine = await request(app).post('/api/fines').set(auth()).send({ carId: car.id, bookingId: b.id, date: day(11), time: '14:30', amount: 60, description: 'Radar' });
    expect(fine.status).toBe(201);
    expect(fine.body.status).toBe('charged');
    const booking = (await request(app).get(`/api/bookings/${b.id}`).set(auth())).body;
    expect(booking.extraChargesTotal).toBe(60);
  });
});

describe('expenses and profit per car', () => {
  it('reports revenue, expenses and profit for each car', async () => {
    const car = await newCar();
    await adminBooking(car.id, day(-20), day(-18)); // 2 days x 100
    await request(app).post('/api/expenses').set(auth()).send({ carId: car.id, date: day(-5), category: 'tyres', amount: 150 });
    const report = (await request(app).get('/api/reports/cars').set(auth())).body;
    const row = report.cars.find((r: { carId: number }) => r.carId === car.id);
    expect(row).toMatchObject({ revenue: 200, expenses: 150, profit: 50, bookedDays: 2 });
    expect(row.byCategory.tyres).toBe(150);
  });
});

describe('automatic reminders', () => {
  it('flags pick-up reminders once and detects late returns', async () => {
    const car = await newCar();
    const soon = await adminBooking(car.id, day(1), day(3));
    const late = await adminBooking(car.id, day(-3), day(-1));
    await request(app).put(`/api/bookings/${late.id}/status`).set(auth()).send({ status: 'picked_up' });

    const first = await runReminders();
    expect(first.pickup).toBeGreaterThanOrEqual(1);
    expect(first.late).toBeGreaterThanOrEqual(1);
    const [s, l] = await Promise.all([prisma.booking.findUnique({ where: { id: soon.id } }), prisma.booking.findUnique({ where: { id: late.id } })]);
    expect(s?.pickupReminderSent).toBe(true);
    expect(l?.lateNotified).toBe(true);

    const second = await runReminders();
    expect(second.pickup).toBe(0);
    expect(second.late).toBe(0);
  });
});
