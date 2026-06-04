import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again later' },
});

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, email: admin.email },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { id: admin.id, username: admin.username, email: admin.email } });
});

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: req.user!.id },
    select: { id: true, username: true, email: true },
  });
  if (!admin) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(admin);
});

router.put('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username, email, currentPassword, newPassword } = req.body;

  if (!currentPassword) {
    res.status(400).json({ error: 'Current password is required' });
    return;
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: req.user!.id } });
  if (!admin) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  if (username && username !== admin.username) {
    const taken = await prisma.adminUser.findUnique({ where: { username } });
    if (taken) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
  }

  const data: { username?: string; email?: string; passwordHash?: string } = {};
  if (username) data.username = username;
  if (email) data.email = email;
  if (newPassword) data.passwordHash = await bcrypt.hash(newPassword, 10);

  const updated = await prisma.adminUser.update({
    where: { id: req.user!.id },
    data,
    select: { id: true, username: true, email: true },
  });

  const token = jwt.sign(
    { id: updated.id, username: updated.username, email: updated.email },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );

  res.json({ token, user: updated });
});

export default router;
