import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, requireOwner } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, requireOwner, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1), 1000);
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  res.json(logs);
});

export default router;
