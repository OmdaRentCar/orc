import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError, parseBody, parseId } from '../lib/http';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { audit } from '../services/audit';
import { requireRoom } from '../lib/plans';

// Team management: owners add, change and remove admin accounts
const router = Router();
router.use(authMiddleware, requireOwner);

const select = { id: true, username: true, email: true, role: true, createdAt: true } as const;

const createSchema = z.object({
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_.-]+$/, 'letters, numbers, dot, dash and underscore only'),
  email: z.email().max(200),
  password: z.string().min(8, 'password must be at least 8 characters').max(200),
  role: z.enum(['owner', 'staff']).default('staff'),
});

const updateSchema = z.object({
  role: z.enum(['owner', 'staff']).optional(),
  password: z.string().min(8, 'password must be at least 8 characters').max(200).optional(),
});

async function assertAnotherOwnerRemains(excludingId: number): Promise<void> {
  const owners = await prisma.adminUser.count({ where: { role: 'owner', id: { not: excludingId } } });
  if (owners === 0) throw new HttpError(400, 'There must always be at least one owner');
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  res.json(await prisma.adminUser.findMany({ select, orderBy: { createdAt: 'asc' } }));
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const input = parseBody(createSchema, req.body);
  requireRoom('users', await prisma.adminUser.count());
  const clash = await prisma.adminUser.findFirst({ where: { OR: [{ username: input.username }, { email: input.email }] } });
  if (clash) throw new HttpError(409, clash.username === input.username ? 'Username already taken' : 'Email already in use');

  const admin = await prisma.adminUser.create({
    data: { username: input.username, email: input.email, role: input.role, passwordHash: await bcrypt.hash(input.password, 10) },
    select,
  });
  await audit(req, 'create', 'admin', admin.id, `${admin.username} (${admin.role})`);
  res.status(201).json(admin);
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  const input = parseBody(updateSchema, req.body);
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) throw new HttpError(404, 'Admin not found');
  if (input.role === 'staff' && admin.role === 'owner') await assertAnotherOwnerRemains(id);

  const updated = await prisma.adminUser.update({
    where: { id },
    data: { role: input.role, passwordHash: input.password ? await bcrypt.hash(input.password, 10) : undefined },
    select,
  });
  const changes = [input.role && `role -> ${input.role}`, input.password && 'password reset'].filter(Boolean).join(', ');
  await audit(req, 'update', 'admin', id, `${updated.username}: ${changes || 'no changes'}`);
  res.json(updated);
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === req.user!.id) throw new HttpError(400, 'You cannot delete your own account');
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) throw new HttpError(404, 'Admin not found');
  if (admin.role === 'owner') await assertAnotherOwnerRemains(id);

  await prisma.adminUser.delete({ where: { id } });
  await audit(req, 'delete', 'admin', id, admin.username);
  res.json({ message: 'Admin deleted' });
});

export default router;
