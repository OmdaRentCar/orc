import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import prisma from '../src/lib/prisma';
import { asMain } from './agency';
import { addDaysISO, todayISO } from '../src/lib/dates';

const app = createApp();
const PASSWORD = 'correct-horse-battery';

let ownerToken = '';
let staffToken = '';
let carId = 0;

const day = (n: number) => addDaysISO(todayISO(), n);
const owner = () => ({ Authorization: `Bearer ${ownerToken}` });
const staff = () => ({ Authorization: `Bearer ${staffToken}` });

function publicBooking(fields: Record<string, string>) {
  const req = request(app).post('/api/bookings/public');
  for (const [k, v] of Object.entries({ car_id: String(carId), guest_name: 'Test Guest', phone: '+216 20 000 000', birth_date: '1990-05-01', license_issue_date: '2012-01-01', ...fields })) req.field(k, v);
  return req;
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  await asMain(() => prisma.adminUser.createMany({
    data: [
      { username: 'owner', email: 'owner@test.local', passwordHash, role: 'owner' },
      { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff' },
    ],
  }));
  ownerToken = (await request(app).post('/api/auth/login').send({ username: 'owner', password: PASSWORD })).body.token;
  staffToken = (await request(app).post('/api/auth/login').send({ username: 'staff', password: PASSWORD })).body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth and roles', () => {
  it('rejects a wrong password and returns the role on login', async () => {
    expect((await request(app).post('/api/auth/login').send({ username: 'owner', password: 'nope' })).status).toBe(401);
    const res = await request(app).get('/api/auth/me').set(staff());
    expect(res.body).toMatchObject({ username: 'staff', role: 'staff' });
  });

  it('answers a wrong current password with 400, not 401', async () => {
    const res = await request(app).put('/api/auth/me').set(staff()).send({ currentPassword: 'wrong', email: 'x@test.local' });
    expect(res.status).toBe(400);
  });

  it('keeps owner-only routes from staff', async () => {
    expect((await request(app).get('/api/admins').set(staff())).status).toBe(403);
    expect((await request(app).get('/api/audit').set(staff())).status).toBe(403);
    expect((await request(app).put('/api/settings').set(staff()).send({})).status).toBe(403);
    expect((await request(app).get('/api/admins').set(owner())).status).toBe(200);
  });

  it('never leaves the business without an owner', async () => {
    const me = (await request(app).get('/api/auth/me').set(owner())).body;
    const res = await request(app).put(`/api/admins/${me.id}`).set(owner()).send({ role: 'staff' });
    expect(res.status).toBe(400);
    expect((await request(app).delete(`/api/admins/${me.id}`).set(owner())).status).toBe(400);
  });

  it('signs out deleted admins immediately', async () => {
    const created = await request(app).post('/api/admins').set(owner()).send({ username: 'temp', email: 'temp@test.local', password: PASSWORD });
    expect(created.status).toBe(201);
    const token = (await request(app).post('/api/auth/login').send({ username: 'temp', password: PASSWORD })).body.token;
    await request(app).delete(`/api/admins/${created.body.id}`).set(owner());
    expect((await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${token}` })).status).toBe(401);
  });
});

describe('input validation', () => {
  it('returns 400 for malformed ids and 404 for missing records', async () => {
    expect((await request(app).get('/api/cars/abc')).status).toBe(400);
    expect((await request(app).get('/api/cars/999999')).status).toBe(404);
    expect((await request(app).put('/api/dashboard/notifications/999999/read').set(owner())).status).toBe(404);
    expect((await request(app).get('/api/nope')).status).toBe(404);
  });

  it('rejects invalid JSON and bad fields with a clear message', async () => {
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    const res = await request(app).post('/api/cars').set(owner()).field('brand', 'X').field('model', 'Y').field('type', 'SUV').field('year', '1800').field('price', '10');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^year:/);
  });
});

describe('cars', () => {
  it('creates, updates and lists a car', async () => {
    const res = await request(app).post('/api/cars').set(staff())
      .field('brand', 'Testla').field('model', 'One').field('type', 'Sedan').field('year', '2025').field('price', '100')
      .field('features', 'GPS, Bluetooth , ,Camera');
    expect(res.status).toBe(201);
    expect(res.body.features).toEqual(['GPS', 'Bluetooth', 'Camera']);
    expect(res.body.images).toEqual([]);
    carId = res.body.id;

    const upd = await request(app).put(`/api/cars/${carId}`).set(staff()).send({ available: false });
    expect(upd.body.available).toBe(false);
    await request(app).put(`/api/cars/${carId}`).set(staff()).send({ available: true });
  });

  it('only lets owners delete cars', async () => {
    const tmp = await request(app).post('/api/cars').set(owner())
      .field('brand', 'Tmp').field('model', 'Car').field('type', 'SUV').field('year', '2020').field('price', '50');
    expect((await request(app).delete(`/api/cars/${tmp.body.id}`).set(staff())).status).toBe(403);
    expect((await request(app).delete(`/api/cars/${tmp.body.id}`).set(owner())).status).toBe(200);
  });
});

describe('public booking flow', () => {
  let reference = '';
  let bookingId = 0;

  it('quotes a price with extras, delivery and discount', async () => {
    const res = await request(app).post('/api/bookings/quote').send({ carId, startDate: day(10), endDate: day(17), extras: ['gps'], deliveryType: 'delivery' });
    expect(res.status).toBe(200);
    // 7 days x 100, 10% weekly discount, GPS 5/day, 30 delivery
    expect(res.body).toMatchObject({ days: 7, subtotal: 700, discount: 70, extrasTotal: 35, deliveryFee: 30, total: 695 });
  });

  it('rejects bookings in the past, without an address for delivery, or with unknown extras', async () => {
    expect((await publicBooking({ start_date: day(-2), end_date: day(1) })).status).toBe(400);
    expect((await publicBooking({ start_date: day(1), end_date: day(2), delivery_type: 'delivery' })).status).toBe(400);
    expect((await publicBooking({ start_date: day(1), end_date: day(2), extras: 'jetpack' })).status).toBe(400);
  });

  it('creates a pending booking with a reference and a server-side price', async () => {
    const res = await publicBooking({ start_date: day(0), end_date: day(3), extras: 'gps,child-seat', pickup_time: '09:30', locale: 'fr', email: 'guest@test.local' });
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^RC-[A-Z2-9]{6}$/);
    expect(res.body).toMatchObject({ status: 'pending', pickupTime: '09:30', locale: 'fr', subtotal: 300, extrasTotal: 45, total: 345 });
    expect(res.body).not.toHaveProperty('documentImage');
    reference = res.body.reference;
    bookingId = res.body.id;
  });

  it('shows the status only with the matching phone number', async () => {
    const wrong = await request(app).get('/api/bookings/status').query({ reference, phone: '99999999' });
    expect(wrong.status).toBe(404);
    const right = await request(app).get('/api/bookings/status').query({ reference: reference.toLowerCase(), phone: '20000000' });
    expect(right.status).toBe(200);
    expect(right.body).toMatchObject({ reference, status: 'pending', total: 345 });
    expect(right.body).not.toHaveProperty('phone');
  });

  it('runs the rental lifecycle and refuses invalid jumps', async () => {
    expect((await request(app).put(`/api/bookings/${bookingId}/status`).set(staff()).send({ status: 'completed' })).status).toBe(400);
    for (const status of ['approved', 'picked_up', 'completed']) {
      const res = await request(app).put(`/api/bookings/${bookingId}/status`).set(staff()).send({ status });
      expect(res.status, status).toBe(200);
    }
    expect((await request(app).put(`/api/bookings/${bookingId}/status`).set(staff()).send({ status: 'pending' })).status).toBe(400);
  });

  it('lets staff change the language used for the customer\'s emails', async () => {
    const res = await request(app).put(`/api/bookings/${bookingId}`).set(staff()).send({ locale: 'ar' });
    expect(res.status).toBe(200);
    expect(res.body.locale).toBe('ar');
    expect(res.body.total).toBe(345); // changing the language does not re-price the booking
    expect((await request(app).put(`/api/bookings/${bookingId}`).set(staff()).send({ locale: 'de' })).status).toBe(400);
  });

  it('records payments', async () => {
    const res = await request(app).put(`/api/bookings/${bookingId}/payment`).set(staff()).send({ paymentStatus: 'paid', amountPaid: 345 });
    expect(res.body).toMatchObject({ paymentStatus: 'paid', amountPaid: 345 });
  });

  it('says so when a booking has no ID document', async () => {
    expect((await request(app).get(`/api/bookings/${bookingId}/document`).set(staff())).status).toBe(404);
  });

  it('logs admin actions in the activity log', async () => {
    const res = await request(app).get('/api/audit').set(owner());
    const actions = res.body.filter((e: { entityId: number }) => e.entityId === bookingId).map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['status:approved', 'status:picked_up', 'status:completed', 'payment']));
  });
});

describe('double booking protection', () => {
  it('lets only one of two overlapping approvals through, even at the same moment', async () => {
    const a = await publicBooking({ start_date: day(40), end_date: day(45), phone: '+216 21 111 111' });
    const b = await publicBooking({ start_date: day(43), end_date: day(48), phone: '+216 22 222 222' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const results = await Promise.all([
      request(app).put(`/api/bookings/${a.body.id}/status`).set(owner()).send({ status: 'approved' }),
      request(app).put(`/api/bookings/${b.body.id}/status`).set(staff()).send({ status: 'approved' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('refuses a public request over approved dates and shows them as booked', async () => {
    expect((await publicBooking({ start_date: day(44), end_date: day(46) })).status).toBe(409);
    const booked = await request(app).get(`/api/bookings/car/${carId}`);
    expect(booked.body.some((r: { startDate: string }) => r.startDate === day(40) || r.startDate === day(43))).toBe(true);
  });

  it('checks conflicts when an admin moves an approved booking', async () => {
    const created = await request(app).post('/api/bookings').set(staff()).send({
      carId, guestName: 'Walk In', phone: '+216 23 333 333', startDate: day(60), endDate: day(62), status: 'approved',
    });
    expect(created.status).toBe(201);
    expect(created.body.source).toBe('admin');
    const moved = await request(app).put(`/api/bookings/${created.body.id}`).set(staff()).send({ startDate: day(44), endDate: day(46) });
    expect(moved.status).toBe(409);
    const ok = await request(app).put(`/api/bookings/${created.body.id}`).set(staff()).send({ endDate: day(64) });
    expect(ok.status).toBe(200);
    expect(ok.body.subtotal).toBe(400);
  });
});

describe('customers and blacklist', () => {
  it('groups bookings by phone number however it was written', async () => {
    await publicBooking({ start_date: day(80), end_date: day(81), phone: '00216 25 555 555', guest_name: 'Repeat Rita' });
    await publicBooking({ start_date: day(82), end_date: day(83), phone: '25555555', guest_name: 'Repeat Rita' });
    const res = await request(app).get('/api/customers').set(staff());
    const rita = res.body.find((c: { normalizedPhone: string }) => c.normalizedPhone === '21625555555');
    expect(rita.bookings).toBe(2);
  });

  it('blocks a phone number from booking online, and unblocks it', async () => {
    expect((await request(app).post('/api/customers/block').set(staff()).send({ phone: '+216 26 666 666', reason: 'unpaid' })).status).toBe(201);
    expect((await publicBooking({ start_date: day(90), end_date: day(91), phone: '26666666' })).status).toBe(403);
    expect((await request(app).delete('/api/customers/block/21626666666').set(staff())).status).toBe(200);
    expect((await publicBooking({ start_date: day(90), end_date: day(91), phone: '26666666' })).status).toBe(201);
  });
});

describe('business settings and dashboard', () => {
  it('lets owners change prices used by new quotes', async () => {
    const current = (await request(app).get('/api/settings')).body;
    const res = await request(app).put('/api/settings').set(owner()).send({ ...current, deliveryFee: 50 });
    expect(res.status).toBe(200);
    const quote = await request(app).post('/api/bookings/quote').send({ carId, startDate: day(1), endDate: day(2), deliveryType: 'delivery' });
    expect(quote.body.deliveryFee).toBe(50);
  });

  it('reports twelve months and today’s active rentals', async () => {
    const res = await request(app).get('/api/dashboard').set(staff());
    expect(res.status).toBe(200);
    expect(res.body.monthly).toHaveLength(12);
    expect(res.body.monthly[11].month).toBe(todayISO().slice(0, 7));
    expect(typeof res.body.activeRentals).toBe('number');
  });
});
