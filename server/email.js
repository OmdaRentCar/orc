import nodemailer from 'nodemailer';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

function template(booking) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0e;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="text-align:center;padding-bottom:32px;">
            <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#e8eaea;margin:0;font-family:'Inter',Arial,sans-serif;">Omda<span style="color:#e72526;">.</span></h1>
            <p style="color:#848c88;font-size:14px;margin:4px 0 0;">Car Rental</p>
          </td>
        </tr>
        <tr>
          <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="text-align:center;padding-bottom:24px;">
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr><td style="width:64px;height:64px;background:rgba(34,197,94,0.1);border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="color:#22c55e;font-size:32px;line-height:64px;">&#10003;</span>
                  </td></tr>
                </table>
                <h2 style="color:#22c55e;font-size:24px;font-weight:700;margin:16px 0 4px;font-family:'Inter',Arial,sans-serif;">Booking Confirmed!</h2>
                <p style="color:#848c88;font-size:14px;margin:0;">Your rental request has been approved.</p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              <tr><td style="padding:12px 0;color:#848c88;border-bottom:1px solid rgba(255,255,255,0.04);">Booking ID</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e8eaea;border-bottom:1px solid rgba(255,255,255,0.04);">#${booking.id}</td></tr>
              <tr><td style="padding:12px 0;color:#848c88;border-bottom:1px solid rgba(255,255,255,0.04);">Name</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e8eaea;border-bottom:1px solid rgba(255,255,255,0.04);">${booking.name}</td></tr>
              <tr><td style="padding:12px 0;color:#848c88;border-bottom:1px solid rgba(255,255,255,0.04);">Car</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e8eaea;border-bottom:1px solid rgba(255,255,255,0.04);">${booking.car}</td></tr>
              <tr><td style="padding:12px 0;color:#848c88;border-bottom:1px solid rgba(255,255,255,0.04);">Pick-up</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e8eaea;border-bottom:1px solid rgba(255,255,255,0.04);">${booking.start}</td></tr>
              <tr><td style="padding:12px 0;color:#848c88;border-bottom:1px solid rgba(255,255,255,0.04);">Return</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e8eaea;border-bottom:1px solid rgba(255,255,255,0.04);">${booking.end}</td></tr>
              <tr><td style="padding:14px 0;color:#848c88;border:none;">Total</td><td style="padding:14px 0;text-align:right;font-weight:700;color:#e72526;font-size:20px;border:none;">$${booking.total}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="text-align:center;padding-top:24px;">
            <p style="color:#848c88;font-size:13px;margin:0 0 8px;">Need help? Contact us 24/7 at <a href="mailto:support@omdarentcar.com" style="color:#e72526;text-decoration:none;font-weight:600;">support@omdarentcar.com</a></p>
            <p style="color:#848c88;font-size:12px;margin:0;">Omda Rent Car</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendBookingConfirmation(to, booking) {
  const transporter = getTransporter();
  if (!to || !transporter) {
    console.log(`[EMAIL] Skipped (no credentials or no email): Booking #${booking.id} for ${booking.car} → ${to || 'no email'}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Omda Rent Car" <${process.env.SMTP_USER}>`,
      to,
      subject: `Booking #${booking.id} Confirmed - ${booking.car}`,
      html: template(booking),
    });
    console.log(`[EMAIL] Confirmation sent to ${to}`);
  } catch (err) {
    console.error('[EMAIL] Failed to send:', err.message);
  }
}