import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

// Emails are captured instead of sent, so the test can read the signing link and the one-time code
const sent: { kind: string; to: string | null | undefined; opts?: { actionUrl?: string; code?: string; bcc?: string }; attachments: { filename: string; content: Buffer }[] }[] = [];
vi.mock('../src/services/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/email')>();
  return {
    ...actual,
    sendBookingEmail: async (kind: string, to: string | null | undefined, _b: unknown, attachments: { filename: string; content: Buffer }[] = [], opts = {}) => {
      sent.push({ kind, to, opts, attachments });
      return true;
    },
  };
});

// Signed PDFs are stored on Cloudinary in real life; here they are kept in memory
const stored = new Map<string, Buffer>();
vi.mock('../src/services/cloudinary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/cloudinary')>();
  return {
    ...actual,
    uploadPrivateImage: async () => 'https://res.cloudinary.com/test/image/authenticated/v1/rentcar/contracts/sig.png',
    uploadPrivatePdf: async (pdf: Buffer, publicId: string) => {
      const url = `https://res.cloudinary.com/test/raw/authenticated/v1/${publicId}`;
      stored.set(url, pdf);
      return url;
    },
    downloadPrivateFile: async (url: string) => stored.get(url)!,
    deleteAsset: async () => {},
  };
});
vi.stubGlobal('fetch', async () => ({ ok: false }));

const { createApp } = await import('../src/app');
const { default: prisma } = await import('../src/lib/prisma');
const { addDaysISO, todayISO } = await import('../src/lib/dates');

const app = createApp();
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pdfParser = (r: NodeJS.ReadableStream, cb: (e: Error | null, b: Buffer) => void) => {
  const chunks: Buffer[] = [];
  r.on('data', (c: Buffer) => chunks.push(c));
  r.on('end', () => cb(null, Buffer.concat(chunks)));
};

async function newBooking(email: string | null = 'signer@test.local') {
  const car = await request(app).post('/api/cars').set(auth()).field('brand', 'Sign').field('model', `Car ${Math.random().toString(36).slice(2, 6)}`).field('type', 'Sedan').field('year', '2024').field('price', '100');
  const b = await request(app).post('/api/bookings').set(auth()).send({
    carId: car.body.id, guestName: 'Amira Ben Salah', phone: '+216 20 111 222', ...(email ? { email } : {}),
    startDate: addDaysISO(todayISO(), 3), endDate: addDaysISO(todayISO(), 5), status: 'approved', locale: 'fr',
  });
  expect(b.status, JSON.stringify(b.body)).toBe(201);
  return b.body as { id: number; reference: string };
}

const lastEmail = (kind: string) => [...sent].reverse().find((e) => e.kind === kind)!;
const tokenFrom = (link: string) => link.split('/sign/')[1];

beforeAll(async () => {
  await prisma.adminUser.upsert({
    where: { username: 'sign-owner' },
    create: { username: 'sign-owner', email: 'sign-owner@test.local', role: 'owner', passwordHash: await bcrypt.hash('sign-password-1', 4) },
    update: {},
  });
  token = (await request(app).post('/api/auth/login').send({ username: 'sign-owner', password: 'sign-password-1' })).body.token;
  const settings = (await request(app).get('/api/settings')).body;
  await request(app).put('/api/settings').set(auth()).send({ ...settings, contactEmail: 'agency@test.local' });
});

afterAll(async () => {
  await prisma.adminUser.delete({ where: { username: 'sign-owner' } });
  await prisma.$disconnect();
});

describe('online contract signature', () => {
  let booking = { id: 0, reference: '' };
  let link = '';

  beforeAll(async () => { booking = await newBooking(); });

  it('needs the customer’s email', async () => {
    const noEmail = await newBooking(null);
    const res = await request(app).post(`/api/bookings/${noEmail.id}/contract/send`).set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('emails a personal link, without storing the link itself', async () => {
    const res = await request(app).post(`/api/bookings/${booking.id}/contract/send`).set(auth()).send({});
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('sent');
    link = res.body.link;
    expect(lastEmail('sign_request').opts?.actionUrl).toBe(link);
    const row = await prisma.onlineContract.findUnique({ where: { bookingId: booking.id } });
    expect(row?.tokenHash).not.toContain(tokenFrom(link));
  });

  it('shows the contract and an unsigned preview to the link holder only', async () => {
    const page = await request(app).get(`/api/sign/${tokenFrom(link)}`);
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ reference: booking.reference, guestName: 'Amira Ben Salah', email: 'si****@test.local' });
    expect(page.body.terms.length).toBeGreaterThan(3);
    expect((await request(app).get('/api/sign/not-a-real-token-at-all-000000000000')).status).toBe(404);
    const preview = await request(app).get(`/api/sign/${tokenFrom(link)}/preview.pdf`).buffer(true).parse(pdfParser);
    expect(preview.status).toBe(200);
    expect((preview.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('sends a one-time code and limits how often', async () => {
    const res = await request(app).post(`/api/sign/${tokenFrom(link)}/code`);
    expect(res.status).toBe(200);
    expect(lastEmail('sign_code').opts?.code).toMatch(/^\d{6}$/);
    expect((await request(app).post(`/api/sign/${tokenFrom(link)}/code`)).status).toBe(429);
  });

  it('refuses a wrong code and a missing acceptance', async () => {
    const code = lastEmail('sign_code').opts!.code!;
    const wrong = code === '000000' ? '111111' : '000000';
    const bad = await request(app).post(`/api/sign/${tokenFrom(link)}`).send({ code: wrong, signerName: 'Amira Ben Salah', signature: PNG, accept: true });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Wrong code');
    const noAccept = await request(app).post(`/api/sign/${tokenFrom(link)}`).send({ code, signerName: 'Amira Ben Salah', signature: PNG, accept: false });
    expect(noAccept.status).toBe(400);
  });

  it('signs, freezes the PDF with its fingerprint and sends it to both parties', async () => {
    const code = lastEmail('sign_code').opts!.code!;
    const res = await request(app).post(`/api/sign/${tokenFrom(link)}`).set('User-Agent', 'VitestPhone/1.0').send({ code, signerName: 'Amira Ben Salah', signature: PNG, accept: true });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.verificationCode).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    const mail = lastEmail('contract_signed');
    expect(mail.to).toBe('signer@test.local');
    expect(mail.opts?.bcc).toBe('agency@test.local');
    expect(sha256(mail.attachments[0].content)).toBe(res.body.documentHash);

    const status = (await request(app).get(`/api/bookings/${booking.id}/contract`).set(auth())).body;
    expect(status).toMatchObject({ state: 'signed', signerName: 'Amira Ben Salah', documentHash: res.body.documentHash });

    const pdf = await request(app).get(`/api/bookings/${booking.id}/contract/signed.pdf`).set(auth()).buffer(true).parse(pdfParser);
    expect(pdf.status).toBe(200);
    expect(sha256(pdf.body as Buffer)).toBe(res.body.documentHash);

    const log = await prisma.auditLog.findFirst({ where: { entityId: booking.id, action: 'contract:signed' } });
    expect(log?.username).toBe('customer: Amira Ben Salah');
  });

  it('makes the link useless after signing', async () => {
    expect((await request(app).get(`/api/sign/${tokenFrom(link)}`)).status).toBe(410);
    expect((await request(app).post(`/api/bookings/${booking.id}/contract/send`).set(auth()).send({})).status).toBe(409);
  });

  it('lets anyone check a contract with its verification code, without personal details', async () => {
    const { verificationCode } = (await request(app).get(`/api/bookings/${booking.id}/contract`).set(auth())).body;
    const res = await request(app).get(`/api/verify/${verificationCode}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valid: true, reference: booking.reference, signer: 'Amira B. S.' });
    expect((await request(app).get('/api/verify/AAAAA-BBBBB')).status).toBe(404);
  });

  it('locks the code after 5 wrong attempts, and the agency can revoke a link', async () => {
    const other = await newBooking('other@test.local');
    const sentLink = (await request(app).post(`/api/bookings/${other.id}/contract/send`).set(auth()).send({})).body.link;
    const t = tokenFrom(sentLink);
    await request(app).post(`/api/sign/${t}/code`);
    const code = lastEmail('sign_code').opts!.code!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await request(app).post(`/api/sign/${t}`).send({ code: wrong, signerName: 'X Y', signature: PNG, accept: true });
    const locked = await request(app).post(`/api/sign/${t}`).send({ code, signerName: 'X Y', signature: PNG, accept: true });
    expect(locked.status).toBe(429);

    expect((await request(app).post(`/api/bookings/${other.id}/contract/revoke`).set(auth())).body.state).toBe('revoked');
    expect((await request(app).get(`/api/sign/${t}`)).status).toBe(410);
  });

  it('keeps the agency routes private', async () => {
    expect((await request(app).post(`/api/bookings/${booking.id}/contract/send`).send({})).status).toBe(401);
    expect((await request(app).get(`/api/bookings/${booking.id}/contract/signed.pdf`)).status).toBe(401);
  });
});
