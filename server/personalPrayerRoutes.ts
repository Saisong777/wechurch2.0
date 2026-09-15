import { Router, type Request } from 'express';
import { z } from 'zod';
import { personalPrayerInput } from '../shared/personalPrayer';
import { listPersonalPrayers, savePersonalPrayer } from './personalPrayerRepository';

export function personalPrayerRoutes(resolveUserId: (req: Request) => Promise<string | null>) {
  const router = Router();
  router.use(async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'private, no-store');
      const userId = await resolveUserId(req);
      if (!userId) return void res.status(401).json({ error: 'Unauthorized' });
      res.locals.prayerOwnerId = userId;
      next();
    } catch (error) { next(error); }
  });
  router.get('/', async (_req, res, next) => {
    try { res.json(await listPersonalPrayers(res.locals.prayerOwnerId)); }
    catch (error) { next(error); }
  });
  router.put('/:id', async (req, res, next) => {
    try {
      const id = z.string().uuid().safeParse(req.params.id);
      const input = personalPrayerInput.safeParse(req.body);
      if (!id.success || !input.success) return void res.status(400).json({ error: 'Invalid prayer' });
      const saved = await savePersonalPrayer(res.locals.prayerOwnerId, id.data, input.data, true);
      if (!saved) return void res.status(404).json({ error: 'Prayer not found' });
      res.json(saved);
    } catch (error) { next(error); }
  });
  router.patch('/:id', async (req, res, next) => {
    try {
      const id = z.string().uuid().safeParse(req.params.id);
      const input = personalPrayerInput.safeParse(req.body);
      if (!id.success || !input.success) return void res.status(400).json({ error: 'Invalid prayer' });
      const saved = await savePersonalPrayer(res.locals.prayerOwnerId, id.data, input.data, false);
      if (!saved) return void res.status(404).json({ error: 'Prayer not found' });
      res.json(saved);
    } catch (error) { next(error); }
  });
  return router;
}
