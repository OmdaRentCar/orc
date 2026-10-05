import nodemailer from 'nodemailer';

// One way out for every email of the platform. The provider is chosen with EMAIL_PROVIDER:
//   smtp   (default) SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS, e.g. Gmail or OVH
//   brevo  BREVO_API_KEY   (sender address must be verified in Brevo)
//   resend RESEND_API_KEY  (sender domain must be verified in Resend)
// EMAIL_FROM is the sending address (defaults to SMTP_USER). Each agency sends under its own name,
// from that platform address, with replies going to the agency's own contact email.

export interface Mail {
  fromName: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  bcc?: string | null;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

type Provider = 'smtp' | 'brevo' | 'resend';

export function emailProvider(): Provider | null {
  const chosen = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  if (chosen === 'brevo') return process.env.BREVO_API_KEY ? 'brevo' : null;
  if (chosen === 'resend') return process.env.RESEND_API_KEY ? 'resend' : null;
  return process.env.SMTP_USER && process.env.SMTP_PASS ? 'smtp' : null;
}

export const senderAddress = () => process.env.EMAIL_FROM || process.env.SMTP_USER || '';

const cleanName = (name: string) => name.replace(/["<>\r\n]/g, '').trim() || 'RentCar';

let transporter: nodemailer.Transporter | null = null;
function smtp(): nodemailer.Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'ssl0.ovh.net',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<{ id?: string; messageId?: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${(data as { message?: string }).message ?? JSON.stringify(data).slice(0, 200)}`);
  return data as { id?: string; messageId?: string };
}

// Sends the email; returns the provider's message id. Throws when sending fails, or when no provider is set up.
export async function deliver(mail: Mail): Promise<string> {
  const provider = emailProvider();
  if (!provider) throw new Error('No email provider configured');
  const fromName = cleanName(mail.fromName);
  const from = senderAddress();
  const replyTo = mail.replyTo && mail.replyTo !== from ? mail.replyTo : undefined;

  if (provider === 'brevo') {
    const data = await postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': process.env.BREVO_API_KEY! }, {
      sender: { name: fromName, email: from },
      to: [{ email: mail.to }],
      ...(mail.bcc ? { bcc: [{ email: mail.bcc }] } : {}),
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject: mail.subject,
      htmlContent: mail.html,
      ...(mail.attachments?.length ? { attachment: mail.attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') })) } : {}),
    });
    return data.messageId ?? 'brevo';
  }

  if (provider === 'resend') {
    const data = await postJson('https://api.resend.com/emails', { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, {
      from: `${fromName} <${from}>`,
      to: [mail.to],
      ...(mail.bcc ? { bcc: [mail.bcc] } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: mail.subject,
      html: mail.html,
      ...(mail.attachments?.length ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })) } : {}),
    });
    return data.id ?? 'resend';
  }

  const info = await smtp().sendMail({
    from: `"${fromName}" <${from}>`,
    to: mail.to,
    bcc: mail.bcc ?? undefined,
    replyTo,
    subject: mail.subject,
    html: mail.html,
    attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType ?? 'application/pdf' })),
  });
  return info.messageId;
}
