import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// One-time, short-lived login code to carry a session to another address (an agency's sub-domain
// after sign-up, or "open this agency's dashboard" from the console). Browsers keep logins per
// address, so the code travels in the link and is exchanged once for a normal login.
const TTL_SECONDS = 120;
const used = new Map<string, number>(); // jti -> expiry (ms); one server instance is enough for a 2-minute window

export function createHandoff(agencyId: number, adminId: number, by: string): string {
  return jwt.sign({ agencyId, adminId, by }, process.env.JWT_SECRET!, { audience: 'handoff', expiresIn: TTL_SECONDS, jwtid: randomUUID() });
}

// Only used up when presented on the agency it was made for
export function consumeHandoff(code: string, agencyId: number): { agencyId: number; adminId: number; by: string } | null {
  try {
    const p = jwt.verify(code, process.env.JWT_SECRET!, { audience: 'handoff' }) as { agencyId: number; adminId: number; by: string; jti: string; exp: number };
    const now = Date.now();
    for (const [k, exp] of used) if (exp < now) used.delete(k);
    if (used.has(p.jti) || p.agencyId !== agencyId) return null;
    used.set(p.jti, p.exp * 1000);
    return { agencyId: p.agencyId, adminId: p.adminId, by: p.by };
  } catch {
    return null;
  }
}
