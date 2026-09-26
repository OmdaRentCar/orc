import { Router, Request, Response } from 'express';
import { parseBody } from '../lib/http';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { getSettings, saveSettings, settingsSchema } from '../services/settings';
import { audit } from '../services/audit';

const router = Router();

// Public: the booking form needs the extras, delivery fee and contact details
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  res.json(await getSettings());
});

router.put('/', authMiddleware, requireOwner, async (req: Request, res: Response): Promise<void> => {
  const saved = await saveSettings(parseBody(settingsSchema, req.body));
  await audit(req, 'update', 'settings', null, 'business settings');
  res.json(saved);
});

export default router;
