import prisma from './prisma';
import { slugFromHost } from '../middleware/agency';

// Browsers may call the API from: the configured site, any agency sub-domain, or an agency's own domain
export async function allowedOrigin(origin: string | undefined): Promise<boolean> {
  if (!origin) return true; // same-origin requests, curl, server-to-server
  let host: string;
  try { host = new URL(origin).host; } catch { return false; }
  if (origin === (process.env.CLIENT_URL || 'http://localhost:5173')) return true;
  if (slugFromHost(host)) return true;
  const hostname = host.split(':')[0];
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return !!(await prisma.agency.findUnique({ where: { customDomain: hostname }, select: { id: true } }));
}
