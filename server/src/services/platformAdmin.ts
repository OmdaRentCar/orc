import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { runUnscoped } from '../lib/tenant';

// First console account, from PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD, created once if missing.
// Later accounts are added from the console itself.
export async function ensurePlatformAdmin(): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) return;
  await runUnscoped(async () => {
    if (await prisma.platformAdmin.findUnique({ where: { email } })) return;
    await prisma.platformAdmin.create({ data: { email, name: process.env.PLATFORM_ADMIN_NAME || 'Platform owner', passwordHash: await bcrypt.hash(password, 10) } });
    console.log(`[PLATFORM] Console account created: ${email}`);
  });
}
