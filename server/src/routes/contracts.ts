import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { authMiddleware } from '../middleware/auth';
import { contractPdf } from '../services/pdf';
import { getSettings } from '../services/settings';
import { sendBookingEmail } from '../services/email';
import { uploadPrivateImage, uploadPrivatePdf, downloadPrivateFile, deleteAsset } from '../services/cloudinary';
import { emitBookingUpdate } from '../socket';
import { audit } from '../services/audit';

// Remote contract signature: the agency sends a personal link by email, the customer proves it is them
// with a one-time code sent to the same email, reads the contract and signs on screen. The signed PDF is
// then frozen (stored, never regenerated) and its SHA-256 fingerprint recorded, so either party can prove
// later that the document was not changed.
const router = Router();

const LINK_DAYS = 7;
const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const MAX_CODES_SENT = 5;
const CODE_COOLDOWN_SECONDS = 60;
const SIGNABLE_STATUSES = ['approved', 'picked_up'];

const inTests = process.env.NODE_ENV === 'test';
const limiter = (minutes: number, max: number) => rateLimit({ windowMs: minutes * 60_000, max, skip: () => inTests, message: { error: 'Too many requests, please try again later' } });
const publicLimiter = limiter(15, 60);
const codeLimiter = limiter(15, 8);

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function verificationCode(): string {
  let code = '';
  for (let i = 0; i < 10; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

const fullBooking = (id: number) => prisma.booking.findUnique({ where: { id }, include: { car: true, inspections: true, onlineContract: true } });

function emailData(b: NonNullable<Awaited<ReturnType<typeof fullBooking>>>) {
  return {
    reference: b.reference, name: b.guestName, car: `${b.car.brand} ${b.car.model}`, start: b.startDate, end: b.endDate,
    pickupTime: b.pickupTime, returnTime: b.returnTime, total: b.total, deposit: b.deposit, locale: b.locale,
  };
}

// What the agency sees about a booking's online contract (never the token)
function contractStatus(c: { sentAt: Date; sentBy: string; expiresAt: Date; viewedAt: Date | null; signedAt: Date | null; signerName: string | null; signerIp: string | null; documentHash: string | null; verificationCode: string | null; revokedAt: Date | null } | null) {
  if (!c) return { state: 'none' as const };
  const state = c.signedAt ? 'signed' : c.revokedAt ? 'revoked' : c.expiresAt < new Date() ? 'expired' : 'sent';
  return {
    state,
    sentAt: c.sentAt, sentBy: c.sentBy, expiresAt: c.expiresAt, viewedAt: c.viewedAt,
    signedAt: c.signedAt, signerName: c.signerName, signerIp: c.signerIp,
    documentHash: c.documentHash, verificationCode: c.verificationCode,
    verifyUrl: c.verificationCode ? `${clientUrl()}/verify?code=${c.verificationCode}` : null,
  };
}

// ─── Agency ───────────────────────────────────────────────────────────────

router.get('/bookings/:id/contract', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const c = await prisma.onlineContract.findUnique({ where: { bookingId: parseId(req.params.id) } });
  res.json(contractStatus(c));
});

router.post('/bookings/:id/contract/send', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const { sendEmail } = parseBody(z.object({ sendEmail: z.boolean().default(true) }), req.body ?? {});
  const b = await fullBooking(id);
  if (!b) throw new HttpError(404, 'Booking not found');
  if (!SIGNABLE_STATUSES.includes(b.status)) throw new HttpError(400, 'Only an approved booking can be sent for signature');
  if (!b.email) throw new HttpError(400, 'Add the customer’s email first: the signing code is sent there');
  if (b.onlineContract?.signedAt) throw new HttpError(409, 'This contract is already signed');

  // A new link replaces any previous one
  const token = randomBytes(32).toString('base64url');
  const data = {
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000),
    sentAt: new Date(),
    sentBy: req.user!.username,
    otpHash: null, otpExpiresAt: null, otpAttempts: 0, otpSentCount: 0, otpLastSentAt: null,
    viewedAt: null, revokedAt: null,
  };
  const contract = await prisma.onlineContract.upsert({ where: { bookingId: id }, create: { bookingId: id, ...data }, update: data });
  const link = `${clientUrl()}/sign/${token}`;

  const emailed = sendEmail ? await sendBookingEmail('sign_request', b.email, emailData(b), [], { actionUrl: link }) : false;
  await audit(req, 'contract:sent', 'booking', id, `${b.reference} to ${b.email}${emailed ? '' : ' (link only)'}`);
  res.status(201).json({ ...contractStatus(contract), link, emailed });
});

router.post('/bookings/:id/contract/revoke', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const c = await prisma.onlineContract.findUnique({ where: { bookingId: id } });
  if (!c) throw new HttpError(404, 'No contract was sent for this booking');
  if (c.signedAt) throw new HttpError(409, 'A signed contract cannot be revoked');
  const updated = await prisma.onlineContract.update({ where: { bookingId: id }, data: { revokedAt: new Date(), otpHash: null } });
  await audit(req, 'contract:revoked', 'booking', id);
  res.json(contractStatus(updated));
});

router.get('/bookings/:id/contract/signed.pdf', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const c = await prisma.onlineContract.findUnique({ where: { bookingId: parseId(req.params.id) }, include: { booking: { select: { reference: true } } } });
  if (!c?.pdfUrl) throw new HttpError(404, 'This contract has not been signed online');
  const pdf = await downloadPrivateFile(c.pdfUrl);
  if (sha256(pdf) !== c.documentHash) throw new HttpError(500, 'The stored contract does not match its fingerprint');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="contrat-signe-${c.booking.reference}.pdf"`);
  res.send(pdf);
});

// ─── Customer (public, by link) ───────────────────────────────────────────

async function contractForToken(token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new HttpError(404, 'This signing link is not valid');
  const c = await prisma.onlineContract.findUnique({ where: { tokenHash: sha256(token) }, include: { booking: { include: { car: true, inspections: true, onlineContract: true } } } });
  if (!c) throw new HttpError(404, 'This signing link is not valid');
  if (c.signedAt) throw new HttpError(410, 'This contract is already signed. The signed copy was sent to you by email.');
  if (c.revokedAt) throw new HttpError(410, 'This signing link was cancelled by the agency.');
  if (c.expiresAt < new Date()) throw new HttpError(410, 'This signing link has expired. Ask the agency for a new one.');
  if (!SIGNABLE_STATUSES.includes(c.booking.status)) throw new HttpError(410, 'This booking can no longer be signed.');
  return c;
}

router.get('/sign/:token', publicLimiter, async (req: Request, res: Response): Promise<void> => {
  const c = await contractForToken(req.params.token);
  if (!c.viewedAt) await prisma.onlineContract.update({ where: { id: c.id }, data: { viewedAt: new Date() } });
  const b = c.booking;
  const s = await getSettings();
  res.json({
    reference: b.reference,
    guestName: b.guestName,
    email: maskEmail(b.email!),
    locale: b.locale,
    company: s.companyName,
    car: { brand: b.car.brand, model: b.car.model, image: b.car.image },
    startDate: b.startDate, endDate: b.endDate, pickupTime: b.pickupTime, returnTime: b.returnTime,
    deliveryType: b.deliveryType, deliveryAddress: b.deliveryAddress,
    extras: b.extras, subtotal: b.subtotal, discount: b.discount, extrasTotal: b.extrasTotal,
    deliveryFee: b.deliveryFee, total: b.total, deposit: b.deposit,
    kmPerDayIncluded: s.kmPerDayIncluded, extraKmPrice: s.extraKmPrice,
    terms: s.contractTerms.split('\n').map((l) => l.trim()).filter(Boolean),
    expiresAt: c.expiresAt,
    codeSent: !!c.otpHash && !!c.otpExpiresAt && c.otpExpiresAt > new Date(),
  });
});

router.get('/sign/:token/preview.pdf', publicLimiter, async (req: Request, res: Response): Promise<void> => {
  const c = await contractForToken(req.params.token);
  const pdf = await contractPdf(c.booking, await getSettings(), { preview: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="apercu-contrat-${c.booking.reference}.pdf"`);
  res.send(pdf);
});

router.post('/sign/:token/code', codeLimiter, async (req: Request, res: Response): Promise<void> => {
  const c = await contractForToken(req.params.token);
  if (c.otpSentCount >= MAX_CODES_SENT) throw new HttpError(429, 'Too many codes were requested. Ask the agency for a new link.');
  if (c.otpLastSentAt && Date.now() - c.otpLastSentAt.getTime() < CODE_COOLDOWN_SECONDS * 1000) {
    throw new HttpError(429, `Please wait a minute before asking for a new code.`);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.onlineContract.update({
    where: { id: c.id },
    data: {
      otpHash: sha256(`${c.id}:${code}`),
      otpExpiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
      otpAttempts: 0,
      otpSentCount: { increment: 1 },
      otpLastSentAt: new Date(),
    },
  });
  const sent = await sendBookingEmail('sign_code', c.booking.email, emailData(c.booking), [], { code });
  if (!sent && !inTests) throw new HttpError(502, 'The code could not be emailed. Please try again later.');
  res.json({ sentTo: maskEmail(c.booking.email!), expiresInMinutes: CODE_MINUTES });
});

const signSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'enter the 6-digit code'),
  signerName: z.string().trim().min(2).max(100),
  signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'signature is required').max(1_500_000),
  accept: z.literal(true, { message: 'you must accept the contract' }),
});

router.post('/sign/:token', publicLimiter, async (req: Request, res: Response): Promise<void> => {
  const c = await contractForToken(req.params.token);
  const input = parseBody(signSchema, req.body);

  if (!c.otpHash || !c.otpExpiresAt) throw new HttpError(400, 'Ask for a code first');
  if (c.otpExpiresAt < new Date()) throw new HttpError(400, 'This code has expired. Ask for a new one.');
  if (c.otpAttempts >= MAX_CODE_ATTEMPTS) throw new HttpError(429, 'Too many wrong codes. Ask for a new one.');
  if (!sameHash(sha256(`${c.id}:${input.code}`), c.otpHash)) {
    await prisma.onlineContract.update({ where: { id: c.id }, data: { otpAttempts: { increment: 1 } } });
    throw new HttpError(400, 'Wrong code');
  }

  const signedAt = new Date();
  const code = verificationCode();
  const signatureBuffer = Buffer.from(input.signature.split(',')[1], 'base64');
  const settings = await getSettings();
  const ip = req.ip ?? '';
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300);

  const pdf = await contractPdf(c.booking, settings, {
    online: {
      signerName: input.signerName,
      signerEmail: c.booking.email!,
      signedAt,
      ip,
      userAgent,
      signature: signatureBuffer,
      sentBy: c.sentBy,
      sentAt: c.sentAt,
      verificationCode: code,
      verifyUrl: `${clientUrl()}/verify`,
    },
  });
  const documentHash = sha256(pdf);

  let signatureUrl: string | null = null;
  let pdfUrl: string | null = null;
  try {
    signatureUrl = await uploadPrivateImage(input.signature, 'rentcar/contracts');
    pdfUrl = await uploadPrivatePdf(pdf, `rentcar/contracts/${c.booking.reference}-${code}.pdf`);
    // Only one signature can ever win, even if the form is submitted twice at once
    const updated = await prisma.onlineContract.updateMany({
      where: { id: c.id, signedAt: null },
      data: {
        signedAt, signerName: input.signerName, signerIp: ip, signerUserAgent: userAgent,
        signature: signatureUrl, pdfUrl, documentHash, verificationCode: code,
        otpHash: null, otpExpiresAt: null,
      },
    });
    if (updated.count === 0) throw new HttpError(409, 'This contract is already signed');
  } catch (err) {
    await Promise.all([signatureUrl, pdfUrl].map(deleteAsset));
    throw err;
  }

  await prisma.auditLog.create({
    data: { username: `customer: ${input.signerName}`, action: 'contract:signed', entity: 'booking', entityId: c.booking.id, details: `${c.booking.reference} from ${ip} · SHA-256 ${documentHash.slice(0, 16)}…` },
  });
  await prisma.notification.create({ data: { type: 'contract_signed', message: `${c.booking.reference}: contract signed online by ${input.signerName}`, bookingId: c.booking.id } });
  emitBookingUpdate({ type: 'contract_signed', message: `${c.booking.reference} signed`, bookingId: c.booking.id });

  const agencyCopy = (settings.contactEmail && !settings.contactEmail.endsWith('@example.com') ? settings.contactEmail : process.env.SMTP_USER) || undefined;
  const emailed = await sendBookingEmail(
    'contract_signed', c.booking.email, emailData(c.booking),
    [{ filename: `contrat-signe-${c.booking.reference}.pdf`, content: pdf }],
    { bcc: agencyCopy },
  );

  res.status(201).json({ signedAt, verificationCode: code, documentHash, emailed });
});

// ─── Anyone: check a contract is genuine ──────────────────────────────────

router.get('/verify/:code', publicLimiter, async (req: Request, res: Response): Promise<void> => {
  const code = req.params.code.trim().toUpperCase();
  const c = /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code)
    ? await prisma.onlineContract.findUnique({ where: { verificationCode: code }, include: { booking: { select: { reference: true, car: { select: { brand: true, model: true } } } } } })
    : null;
  if (!c?.signedAt) throw new HttpError(404, 'No signed contract has this verification code');
  const [first, ...rest] = (c.signerName ?? '').split(' ');
  res.json({
    valid: true,
    reference: c.booking.reference,
    car: `${c.booking.car.brand} ${c.booking.car.model}`,
    signer: `${first} ${rest.map((r) => `${r[0]}.`).join(' ')}`.trim(), // no full name on a public page
    signedAt: c.signedAt,
    company: (await getSettings()).companyName,
    documentHash: c.documentHash,
  });
});

export default router;
