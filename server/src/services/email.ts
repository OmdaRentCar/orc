import { deliver, emailProvider } from './mailer';
import { getSettings } from './settings';

export type EmailKind = 'received' | 'approved' | 'declined' | 'cancelled' | 'pickup_reminder' | 'return_reminder' | 'contract' | 'return_report' | 'sign_request' | 'sign_code' | 'contract_signed' | 'contract_copy';
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

import { agencySiteUrl, currentAgency } from '../lib/tenant';

// Emails go out under the agency's own name
const brand = () => currentAgency()?.name ?? process.env.BRAND_NAME ?? 'RentCar';

const TEXT: Record<Locale, {
  subject: Record<EmailKind, string>;
  heading: Record<EmailKind, string>;
  intro: Record<EmailKind, string>;
  labels: { reference: string; car: string; pickup: string; return: string; total: string; deposit: string };
  checkStatus: string;
  signAction: string;
  help: string;
}> = {
  en: {
    subject: {
      received: 'We received your booking request {ref}',
      approved: 'Booking {ref} confirmed - {car}',
      declined: 'Booking {ref} could not be accepted',
      cancelled: 'Booking {ref} has been cancelled',
      pickup_reminder: 'Reminder: your {car} is ready tomorrow ({ref})',
      return_reminder: 'Reminder: your {car} is due back today ({ref})',
      contract: 'Your rental contract {ref} - {car}',
      return_report: 'Return report {ref} - thank you!',
      sign_request: 'Please sign your rental contract {ref}',
      sign_code: 'Your signature code: {code}',
      contract_signed: 'Signed contract {ref} - {car}',
      contract_copy: 'Your rental contract {ref} - {car}',
    },
    heading: { received: 'Request received', approved: 'Booking confirmed!', declined: 'Booking declined', cancelled: 'Booking cancelled', pickup_reminder: 'See you tomorrow!', return_reminder: 'Return due today', contract: 'Enjoy your drive!', return_report: 'Car returned', sign_request: 'Your contract is ready', sign_code: 'Signature code', contract_signed: 'Contract signed', contract_copy: 'Your rental contract' },
    intro: {
      received: 'Thank you {name}! We received your booking request. Our team will review it and confirm shortly.',
      approved: 'Good news {name}, your rental is confirmed. See you at pick-up!',
      declined: 'Sorry {name}, we cannot accept this booking. Contact us and we will help you find other dates or another car.',
      cancelled: 'Your booking has been cancelled. If this is unexpected, please contact us.',
      pickup_reminder: 'Hello {name}, a quick reminder that your car is ready for pick-up tomorrow. Please bring your ID and driving licence.',
      return_reminder: 'Hello {name}, your rental ends today. Please return the car on time with the same fuel level to avoid extra charges.',
      contract: 'Hello {name}, your signed rental contract and the pick-up inspection report are attached. Keep them with you during the rental.',
      return_report: 'Thank you {name}! The car has been returned. The return report, with any extra charges, is attached.',
      sign_request: 'Hello {name}, your rental contract is ready. Read it and sign it online from your phone: it only takes a minute, and saves time at pick-up. The link is personal and valid for 7 days.',
      sign_code: 'Enter this code on the signing page to confirm it is you. It is valid for 10 minutes. If you did not ask for it, ignore this email.',
      contract_signed: 'Thank you {name}, your contract is signed. The signed PDF is attached: keep it. Its authenticity can be checked at any time with the verification code printed on it.',
      contract_copy: 'Hello {name}, please find your rental contract attached. Keep it with you during the rental, and contact us if anything is not right.',
    },
    labels: { reference: 'Reference', car: 'Car', pickup: 'Pick-up', return: 'Return', total: 'Total', deposit: 'Deposit' },
    checkStatus: 'Check booking status',
    signAction: 'Review and sign',
    help: 'Need help? Contact us at',
  },
  fr: {
    subject: {
      received: 'Nous avons reçu votre demande de réservation {ref}',
      approved: 'Réservation {ref} confirmée - {car}',
      declined: "La réservation {ref} n'a pas pu être acceptée",
      cancelled: 'La réservation {ref} a été annulée',
      pickup_reminder: 'Rappel : votre {car} vous attend demain ({ref})',
      return_reminder: 'Rappel : retour de votre {car} aujourd’hui ({ref})',
      contract: 'Votre contrat de location {ref} - {car}',
      return_report: 'Rapport de retour {ref} - merci !',
      sign_request: 'Merci de signer votre contrat de location {ref}',
      sign_code: 'Votre code de signature : {code}',
      contract_signed: 'Contrat signé {ref} - {car}',
      contract_copy: 'Votre contrat de location {ref} - {car}',
    },
    heading: { received: 'Demande reçue', approved: 'Réservation confirmée !', declined: 'Réservation refusée', cancelled: 'Réservation annulée', pickup_reminder: 'À demain !', return_reminder: 'Retour prévu aujourd’hui', contract: 'Bonne route !', return_report: 'Véhicule restitué', sign_request: 'Votre contrat est prêt', sign_code: 'Code de signature', contract_signed: 'Contrat signé', contract_copy: 'Votre contrat de location' },
    intro: {
      received: 'Merci {name} ! Nous avons bien reçu votre demande. Notre équipe va l’examiner et vous confirmer rapidement.',
      approved: 'Bonne nouvelle {name}, votre location est confirmée. À bientôt !',
      declined: "Désolé {name}, nous ne pouvons pas accepter cette réservation. Contactez-nous pour trouver d'autres dates ou un autre véhicule.",
      cancelled: "Votre réservation a été annulée. Si ce n'est pas normal, contactez-nous.",
      pickup_reminder: 'Bonjour {name}, petit rappel : votre véhicule est prêt demain. Pensez à apporter votre pièce d’identité et votre permis de conduire.',
      return_reminder: 'Bonjour {name}, votre location se termine aujourd’hui. Merci de rendre le véhicule à l’heure avec le même niveau de carburant pour éviter des frais.',
      contract: 'Bonjour {name}, vous trouverez en pièce jointe votre contrat de location signé et l’état des lieux de départ. Gardez-les avec vous pendant la location.',
      return_report: 'Merci {name} ! Le véhicule a été restitué. Le rapport de retour, avec les éventuels frais supplémentaires, est en pièce jointe.',
      sign_request: 'Bonjour {name}, votre contrat de location est prêt. Lisez-le et signez-le en ligne depuis votre téléphone : cela prend une minute et vous fait gagner du temps au départ. Le lien est personnel et valable 7 jours.',
      sign_code: 'Saisissez ce code sur la page de signature pour confirmer votre identité. Il est valable 10 minutes. Si vous ne l’avez pas demandé, ignorez cet e-mail.',
      contract_signed: 'Merci {name}, votre contrat est signé. Le PDF signé est en pièce jointe : conservez-le. Son authenticité peut être vérifiée à tout moment grâce au code de vérification imprimé dessus.',
      contract_copy: 'Bonjour {name}, vous trouverez votre contrat de location en pièce jointe. Gardez-le avec vous pendant la location et contactez-nous si quelque chose ne va pas.',
    },
    labels: { reference: 'Référence', car: 'Véhicule', pickup: 'Prise en charge', return: 'Retour', total: 'Total', deposit: 'Caution' },
    checkStatus: 'Voir le statut de la réservation',
    signAction: 'Lire et signer',
    help: "Besoin d'aide ? Écrivez-nous à",
  },
  ar: {
    subject: {
      received: 'استلمنا طلب الحجز {ref}',
      approved: 'تم تأكيد الحجز {ref} - {car}',
      declined: 'تعذّر قبول الحجز {ref}',
      cancelled: 'تم إلغاء الحجز {ref}',
      pickup_reminder: 'تذكير: سيارتك {car} جاهزة غدًا ({ref})',
      return_reminder: 'تذكير: موعد إرجاع {car} اليوم ({ref})',
      contract: 'عقد الكراء {ref} - {car}',
      return_report: 'تقرير الإرجاع {ref} - شكرًا!',
      sign_request: 'يرجى توقيع عقد الكراء {ref}',
      sign_code: 'رمز التوقيع: {code}',
      contract_signed: 'العقد الموقّع {ref} - {car}',
      contract_copy: 'عقد الكراء {ref} - {car}',
    },
    heading: { received: 'تم استلام الطلب', approved: 'تم تأكيد الحجز!', declined: 'تم رفض الحجز', cancelled: 'تم إلغاء الحجز', pickup_reminder: 'نراك غدًا!', return_reminder: 'موعد الإرجاع اليوم', contract: 'رحلة سعيدة!', return_report: 'تم إرجاع السيارة', sign_request: 'عقدك جاهز', sign_code: 'رمز التوقيع', contract_signed: 'تم توقيع العقد', contract_copy: 'عقد الكراء' },
    intro: {
      received: 'شكرًا {name}! استلمنا طلب الحجز الخاص بك، وسيقوم فريقنا بمراجعته وتأكيده قريبًا.',
      approved: 'خبر سار {name}، تم تأكيد الإيجار. نراك عند الاستلام!',
      declined: 'نأسف {name}، لا يمكننا قبول هذا الحجز. تواصل معنا لنساعدك في اختيار تواريخ أو سيارة أخرى.',
      cancelled: 'تم إلغاء حجزك. إذا لم يكن ذلك متوقعًا، يرجى التواصل معنا.',
      pickup_reminder: 'مرحبًا {name}، نذكّرك بأن سيارتك جاهزة للاستلام غدًا. لا تنس بطاقة التعريف ورخصة السياقة.',
      return_reminder: 'مرحبًا {name}، ينتهي الكراء اليوم. يرجى إرجاع السيارة في الموعد وبنفس مستوى الوقود لتجنّب أي رسوم إضافية.',
      contract: 'مرحبًا {name}، تجد في المرفقات عقد الكراء الموقّع ومحضر حالة السيارة عند الاستلام. احتفظ بهما طوال مدة الكراء.',
      return_report: 'شكرًا {name}! تم إرجاع السيارة. تجد في المرفقات تقرير الإرجاع مع أي رسوم إضافية.',
      sign_request: 'مرحبًا {name}، عقد الكراء جاهز. اقرأه ووقّعه عبر الإنترنت من هاتفك: الأمر يستغرق دقيقة ويوفّر عليك الوقت عند الاستلام. الرابط شخصي وصالح لمدة 7 أيام.',
      sign_code: 'أدخل هذا الرمز في صفحة التوقيع لتأكيد هويتك. الرمز صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.',
      contract_signed: 'شكرًا {name}، تم توقيع عقدك. تجد العقد الموقّع في المرفقات، احتفظ به. يمكن التحقق من صحته في أي وقت بواسطة رمز التحقق المطبوع عليه.',
      contract_copy: 'مرحبًا {name}، تجد عقد الكراء في المرفقات. احتفظ به طوال مدة الكراء وتواصل معنا إذا كان هناك أي خطأ.',
    },
    labels: { reference: 'المرجع', car: 'السيارة', pickup: 'الاستلام', return: 'الإرجاع', total: 'المجموع', deposit: 'التأمين' },
    checkStatus: 'متابعة حالة الحجز',
    signAction: 'قراءة العقد وتوقيعه',
    help: 'تحتاج مساعدة؟ راسلنا على',
  },
};

const ACCENT: Record<EmailKind, string> = {
  received: '#e8eaea', approved: '#22c55e', declined: '#e72526', cancelled: '#f59e0b',
  pickup_reminder: '#e8eaea', return_reminder: '#f59e0b', contract: '#22c55e', return_report: '#e8eaea',
  sign_request: '#e8eaea', sign_code: '#e8eaea', contract_signed: '#22c55e', contract_copy: '#e8eaea',
};

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

interface TemplateOptions {
  actionUrl?: string; // replaces the status-page button
  code?: string; // shown large (one-time codes)
  bcc?: string; // silent copy, e.g. the agency's copy of a signed contract
}

function template(kind: EmailKind, b: BookingEmailData, locale: Locale, opts: TemplateOptions = {}, contact = 'contact@example.com'): string {
  const t = TEXT[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const align = locale === 'ar' ? 'left' : 'right';
  const BRAND = escapeHtml(brand());
  const statusUrl = `${agencySiteUrl()}/booking-status?ref=${encodeURIComponent(b.reference)}`;
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
          ${opts.code ? `<p style="text-align:center;font-size:36px;letter-spacing:10px;font-weight:800;color:#e8eaea;margin:8px 0 24px;font-family:monospace;">${escapeHtml(opts.code)}</p>` : ''}
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;${opts.code ? 'display:none;' : ''}">
            ${row(t.labels.reference, escapeHtml(b.reference))}
            ${row(t.labels.car, escapeHtml(b.car))}
            ${row(t.labels.pickup, `${b.start} · ${b.pickupTime}`)}
            ${row(t.labels.return, `${b.end} · ${b.returnTime}`)}
            ${kind === 'approved' && b.deposit > 0 ? row(t.labels.deposit, `${b.deposit.toFixed(0)} DT`) : ''}
            ${row(t.labels.total, `${b.total.toFixed(0)} DT`, true)}
          </table>
          <p style="text-align:center;margin:28px 0 0;">
            ${opts.code ? '' : `<a href="${opts.actionUrl ?? statusUrl}" style="display:inline-block;padding:12px 24px;background:#e72526;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${opts.actionUrl ? t.signAction : t.checkStatus}</a>`}
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

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendBookingEmail(kind: EmailKind, to: string | null | undefined, booking: BookingEmailData, attachments: EmailAttachment[] = [], opts: TemplateOptions = {}): Promise<boolean> {
  if (!to || !emailProvider()) {
    console.log(`[EMAIL] Skipped (${kind}): ${booking.reference} -> ${to || 'no email'}`);
    return false;
  }
  const locale: Locale = (['en', 'fr', 'ar'] as const).includes(booking.locale as Locale) ? (booking.locale as Locale) : 'en';
  try {
    // Customers reply to the agency itself, not to the platform's sending address
    const own = (await getSettings()).contactEmail;
    const contact = own && !own.endsWith('@example.com') ? own : process.env.SMTP_USER || 'contact@example.com';
    const id = await deliver({
      fromName: brand(),
      to,
      replyTo: contact,
      subject: fill(TEXT[locale].subject[kind], { ref: booking.reference, car: booking.car, code: opts.code ?? '' }),
      html: template(kind, booking, locale, opts, contact),
      bcc: opts.bcc,
      attachments,
    });
    console.log(`[EMAIL] Sent (${kind}, ${locale}) ${booking.reference} to ${to} · id ${id}`);
    return true;
  } catch (err: unknown) {
    console.error(`[EMAIL] Failed (${kind}) ${booking.reference} to ${to}:`, (err as Error).message);
    return false;
  }
}

// Plain internal email to the agency (car alerts)
export async function sendAdminEmail(to: string, subject: string, lines: string[]): Promise<boolean> {
  const recipient = to && !to.endsWith('@example.com') ? to : process.env.SMTP_USER;
  if (!emailProvider() || !recipient) {
    console.log(`[EMAIL] Skipped (admin): ${subject}`);
    return false;
  }
  try {
    await deliver({
      fromName: brand(),
      to: recipient,
      subject: `[${brand()}] ${subject}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2><ul>${lines.map((l) => `<li style="margin:6px 0">${escapeHtml(l)}</li>`).join('')}</ul><p style="color:#777;font-size:12px">Sent automatically by ${escapeHtml(brand())}.</p></div>`,
    });
    console.log(`[EMAIL] Sent (admin) "${subject}" to ${recipient}`);
    return true;
  } catch (err) {
    console.error('[EMAIL] Failed (admin):', (err as Error).message);
    return false;
  }
}
