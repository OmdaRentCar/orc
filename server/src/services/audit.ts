import type { Request } from 'express';
import prisma from '../lib/prisma';

// Records who did what in the admin area. Never fails the request it belongs to.
export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId?: number | null,
  details?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id ?? null,
        username: req.user?.username ?? 'system',
        action,
        entity,
        entityId: entityId ?? null,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error('[AUDIT] Failed to record action:', (err as Error).message);
  }
}
