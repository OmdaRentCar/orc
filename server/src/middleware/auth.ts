import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { currentAgency, requireAgency } from '../lib/tenant';

export type AdminRole = 'owner' | 'staff';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ ...user, agencyId: requireAgency().id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
}

// Resolves a token to the admin as currently stored, so deleted accounts and role changes apply immediately
export async function userFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const { id, agencyId } = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; agencyId?: number };
    // A login is only valid on the agency it was made for
    if (agencyId !== currentAgency()?.id) return null;
    const admin = await prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, role: true },
    });
    return admin ? { ...admin, role: admin.role as AdminRole } : null;
  } catch {
    return null;
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  const user = await userFromToken(header.slice(7));
  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  req.user = user;
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'owner') {
    res.status(403).json({ error: 'Only an owner can do this' });
    return;
  }
  next();
}
