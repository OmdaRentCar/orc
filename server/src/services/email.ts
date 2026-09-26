import nodemailer from 'nodemailer';

export type EmailKind = 'received' | 'approved' | 'declined' | 'cancelled';
export type Locale = 'en' | 'fr' | 'ar';

export interface BookingEmailData {
  reference: string;
  name: string;
  car: string;
  start: string;
  end: string;
  pickupTime: string;
  returnTime: string;
  total: number;
  deposit: number;
  locale: string;
}

const BRAND = process.env.BRAND_NAME || 'RentCar';

const TEXT: Record<Locale, {
  subject: Record<EmailKind, string>;
  heading: Record<EmailKind, string>;
  intro: Record<EmailKind, string>;
  labels: { reference: string; car: string; pickup: string; return: string; total: string; deposit: string };
  checkStatus: string;
  help: string;
}> = {
  en: {
    subject: {
      received: 'We received your booking request {ref}',
      approved: 'Booking {ref} confirmed - {car}',
      declined: 'Booking {ref} could not be accepted',
      cancelled: 'Booking {ref} has been cancelled',
    },
    heading: { received: 'Request received', approved: 'Booking confirmed!', declined: 'Booking declined', cancelled: 'Booking cancelled' },
    intro: {
      received: 'Thank you {name}! We received your booking request. Our team will review it and confirm shortly.',
      approved: 'Good news {name}, your rental is confirmed. See you at pick-up!',
      declined: 'Sorry {name}, we cannot accept this booking. Contact us and we will help you find other dates or another car.',
      cancelled: 'Your booking has been cancelled. If this is unexpected, please contact us.',
    },
    labels: { reference: 'Reference', car: 'Car', pickup: 'Pick-up', return: 'Return', total: 'Total', deposit: 'Deposit' },
    checkStatus: 'Check booking status',
    help: 'Need help? Contact us at',
  },
  fr: {
    subject: {
      received: 'Nous avons reçu votre demande de réservation {ref}',
      approved: 'Réservation {ref} confirmée - {car}',
      declined: "La réservation {ref} n'a pas pu être acceptée",
      cancelled: 'La réservation {ref} a été annulée',
    },
    heading: { received: 'Demande reçue', approved: 'Réservation confirmée !', declined: 'Réservation refusée', cancelled: 'Réservation annulée' },
    intro: {
      received: 'Merci {name} ! Nous avons bien reçu votre demande. Notre équipe va l’examiner et vous confirmer rapidement.',
      approved: 'Bonne nouvelle {name}, votre location est confirmée. À bientôt !',
      declined: "Désolé {name}, nous ne pouvons pas accepter cette réservation. Contactez-nous pour trouver d'autres dates ou un autre véhicule.",
      cancelled: "Votre réservation a été annulée. Si ce n'est pas normal, contactez-nous.",
    },
    labels: { reference: 'Référence', car: 'Véhicule', pickup: 'Prise en charge', return: 'Retour', total: 'Total', deposit: 'Caution' },
    checkStatus: 'Voir le statut de la réservation',
    help: "Besoin d'aide ? Écrivez-nous à",
  },
  ar: {
    subject: {
      received: 'استلمنا طلب الحجز {ref}',
      approved: 'تم تأكيد الحجز {ref} - {car}',
      declined: 'تعذّر قبول الحجز {ref}',
      cancelled: 'تم إلغاء الحجز {ref}',
    },
    heading: { received: 'تم استلام الطلب', approved: 'تم تأكيد الحجز!', declined: 'تم رفض الحجز', cancelled: 'تم إلغاء الحجز' },
    intro: {
      received: 'شكرًا {name}! استلمنا طلب الحجز الخاص بك، وسيقوم فريقنا بمراجعته وتأكيده قريبًا.',
      approved: 'خبر سار {name}، تم تأكيد الإيجار. نراك عند الاستلام!',
      declined: 'نأسف {name}، لا يمكننا قبول هذا الحجز. تواصل معنا لنساعدك في اختيار تواريخ أو سيارة أخرى.',
      cancelled: 'تم إلغاء حجزك. إذا لم يكن ذلك متوقعًا، يرجى التواصل معنا.',
    },
    labels: { reference: 'المرجع', car: 'السيارة', pickup: 'الاستلام', return: 'الإرجاع', total: 'المجموع', deposit: 'التأمين' },
    checkStatus: 'متابعة حالة الحجز',
    help: 'تحتاج مساعدة؟ راسلنا على',
  },
};

const ACCENT: Record<EmailKind, string> = { received: '#e8eaea', approved: '#22c55e', declined: '#e72526', cancelled: '#f59e0b' };

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'ssl0.ovh.net',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

function template(kind: EmailKind, b: BookingEmailData, locale: Locale): string {
  const t = TEXT[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const align = locale === 'ar' ? 'left' : 'right';
  const statusUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-status?ref=${encodeURIComponent(b.reference)}`;
  const contact = process.env.SMTP_USER || 'contact@example.com';
  const row = (label: string, value: string, strong = false) => `
    <tr><td style="padding:12px 0;color:#848c88;border-bottom:1px solid rgba(255,255,255,0.04);">${label}</td>
    <td style="padding:12px 0;text-align:${align};font-weight:${strong ? 700 : 600};color:${strong ? '#e72526' : '#e8eaea'};${strong ? 'font-size:20px;' : ''}border-bottom:1px solid rgba(255,255,255,0.04);">${value}</td></tr>`;

  return `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0e;padding:40px 16px;" dir="${dir}">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <h1 style="font-size:28px;font-weight:800;color:#e8eaea;margin:0;">${BRAND}<span style="color:#e72526;">.</span></h1>
        </td></tr>
        <tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:32px;">
          <h2 style="color:${ACCENT[kind]};font-size:24px;font-weight:700;margin:0 0 8px;text-align:center;">${t.heading[kind]}</h2>
          <p style="color:#848c88;font-size:14px;margin:0 0 24px;text-align:center;line-height:1.6;">${escapeHtml(fill(t.intro[kind], { name: b.name }))}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            ${row(t.labels.reference, escapeHtml(b.reference))}
            ${row(t.labels.car, escapeHtml(b.car))}
            ${row(t.labels.pickup, `${b.start} · ${b.pickupTime}`)}
            ${row(t.labels.return, `${b.end} · ${b.returnTime}`)}
            ${kind === 'approved' && b.deposit > 0 ? row(t.labels.deposit, `${b.deposit.toFixed(0)} DT`) : ''}
            ${row(t.labels.total, `${b.total.toFixed(0)} DT`, true)}
          </table>
          <p style="text-align:center;margin:28px 0 0;">
            <a href="${statusUrl}" style="display:inline-block;padding:12px 24px;background:#e72526;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${t.checkStatus}</a>
          </p>
        </td></tr>
        <tr><td style="text-align:center;padding-top:24px;">
          <p style="color:#848c88;font-size:13px;margin:0 0 8px;">${t.help} <a href="mailto:${contact}" style="color:#e72526;text-decoration:none;font-weight:600;">${contact}</a></p>
          <p style="color:#848c88;font-size:12px;margin:0;">${BRAND}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendBookingEmail(kind: EmailKind, to: string | null | undefined, booking: BookingEmailData): Promise<void> {
  const transporter = getTransporter();
  if (!to || !transporter) {
    console.log(`[EMAIL] Skipped (${kind}): ${booking.reference} -> ${to || 'no email'}`);
    return;
  }
  const locale: Locale = (['en', 'fr', 'ar'] as const).includes(booking.locale as Locale) ? (booking.locale as Locale) : 'en';
  try {
    const info = await transporter.sendMail({
      from: `"${BRAND}" <${process.env.SMTP_USER}>`,
      to,
      subject: fill(TEXT[locale].subject[kind], { ref: booking.reference, car: booking.car }),
      html: template(kind, booking, locale),
    });
    console.log(`[EMAIL] Sent (${kind}, ${locale}) ${booking.reference} to ${to} · id ${info.messageId}`);
  } catch (err: unknown) {
    console.error(`[EMAIL] Failed (${kind}) ${booking.reference} to ${to}:`, (err as Error).message);
  }
}
