import { deliver, emailProvider } from './mailer';
import { platform } from '../lib/platform';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface PlatformMail {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  attachments?: { filename: string; content: Buffer }[];
}

// Emails from the platform to an agency (welcome, trial ending, receipts, suspension), in French
export async function sendPlatformEmail(to: string | null | undefined, subject: string, mail: PlatformMail): Promise<boolean> {
  const p = platform();
  if (!to || to.endsWith('@example.com') || !emailProvider()) {
    console.log(`[EMAIL] Skipped (platform): "${subject}" -> ${to || 'no email'}`);
    return false;
  }
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0e0e0e;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="text-align:center;padding-bottom:28px;"><h1 style="font-size:26px;font-weight:800;color:#e8eaea;margin:0;">${esc(p.name)}<span style="color:#e72526;">.</span></h1></td></tr>
<tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;">
<h2 style="color:#e8eaea;font-size:22px;margin:0 0 16px;">${esc(mail.heading)}</h2>
${mail.paragraphs.map((t) => `<p style="color:#b9bdbb;font-size:14px;line-height:1.65;margin:0 0 12px;">${esc(t)}</p>`).join('')}
${mail.action ? `<p style="text-align:center;margin:26px 0 4px;"><a href="${esc(mail.action.url)}" style="display:inline-block;padding:12px 26px;background:#e72526;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${esc(mail.action.label)}</a></p>` : ''}
</td></tr>
<tr><td style="text-align:center;padding-top:22px;color:#848c88;font-size:12px;">${esc(p.company)} · <a href="mailto:${esc(p.email)}" style="color:#e72526;text-decoration:none;">${esc(p.email)}</a></td></tr>
</table></td></tr></table></body></html>`;
  try {
    await deliver({ fromName: p.name, to, replyTo: p.email, subject: `${subject} · ${p.name}`, html, attachments: mail.attachments });
    console.log(`[EMAIL] Sent (platform) "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed (platform) "${subject}" to ${to}:`, (err as Error).message);
    return false;
  }
}
