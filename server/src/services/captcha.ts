// Cloudflare Turnstile. Disabled (always passes) until TURNSTILE_SECRET_KEY is set,
// so local development works without a Cloudflare account.
export function captchaEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyCaptcha(token: string | undefined, ip: string | undefined): Promise<boolean> {
  if (!captchaEnabled()) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[CAPTCHA] Verification request failed:', (err as Error).message);
    return false;
  }
}
