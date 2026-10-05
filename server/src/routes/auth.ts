import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody } from '../lib/http';
import { authMiddleware, signToken, AdminRole } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many login attempts, try again later' },
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username and password required').max(60),
  password: z.string().min(1, 'Username and password required').max(200),
});

const updateMeSchema = z.object({
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_.-]+$/, 'letters, numbers, dot, dash and underscore only').optional(),
  email: z.email().max(200).optional(),
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200).optional(),
});

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = parseBody(loginSchema, req.body);

  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const user = { id: admin.id, username: admin.username, email: admin.email, role: admin.role as AdminRole };
  res.json({ token: signToken(user), user });
});

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  res.json(req.user);
});

router.put('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username, email, currentPassword, newPassword } = parseBody(updateMeSchema, req.body);

  const admin = await prisma.adminUser.findUnique({ where: { id: req.user!.id } });
  if (!admin) throw new HttpError(404, 'User not found');

  // 400, not 401: the session is still valid, and the client logs out on any 401
  if (!(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }

  if (username && username !== admin.username && await prisma.adminUser.findUnique({ where: { username } })) {
    throw new HttpError(409, 'Username already taken');
  }
  if (email && email !== admin.email && await prisma.adminUser.findUnique({ where: { email } })) {
    throw new HttpError(409, 'Email already in use');
  }

  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      username,
      email,
      passwordHash: newPassword ? await bcrypt.hash(newPassword, 10) : undefined,
    },
    select: { id: true, username: true, email: true, role: true },
  });

  const user = { ...updated, role: updated.role as AdminRole };
  const changed = [username && 'username', email && 'email', newPassword && 'password'].filter(Boolean).join(', ');
  req.user = user;
  await audit(req, 'update-account', 'admin', user.id, changed || 'no changes');
  res.json({ token: signToken(user), user });
});

export default router;
