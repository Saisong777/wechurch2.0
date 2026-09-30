import { Router, type Request, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { prayerSharingInput } from '../shared/prayerSharing';
import { GroupError } from './lifeGroupRepository';
import { listPrayerDeliveries, sharePersonalPrayers, withdrawPrayerDelivery } from './prayerSharingRepository';

export function prayerSharingRoutes(resolveUserId: (req: Request) => Promise<string | null>) {
  const router = Router();
  router.use(async (req,res,next) => {
    res.setHeader('Cache-Control','private, no-store');
    const actor = await resolveUserId(req);
    if (!actor) return void res.status(401).json({ error: '請先登入。' });
    if (req.method !== 'GET') {
      const origin = req.get('origin');
      let invalid = req.get('sec-fetch-site') === 'cross-site';
      if (origin) { try { invalid ||= new URL(origin).host !== req.get('host'); } catch { invalid = true; } }
      if (invalid) return void res.status(403).json({ error: '不接受跨網站寫入。' });
    }
    res.locals.actor = actor; next();
  });
  router.get('/', async (_req,res) => { res.json(await listPrayerDeliveries(res.locals.actor)); });
  router.post('/', async (req,res) => { res.json(await sharePersonalPrayers(res.locals.actor,prayerSharingInput.parse(req.body))); });
  router.delete('/:prayerId/:destination', async (req,res) => {
    res.json(await withdrawPrayerDelivery(res.locals.actor,z.string().uuid().parse(req.params.prayerId),z.union([z.literal('public'),z.string().uuid()]).parse(req.params.destination)));
  });
  const errors: ErrorRequestHandler = (error,_req,res,_next) => {
    if (error instanceof z.ZodError) return void res.status(400).json({ error: error.issues.map(i => i.message).join('；') });
    if (error instanceof GroupError) return void res.status(error.status).json({ error: error.message });
    console.error('[prayer-sharing]',error?.code || error?.name);
    res.status(503).json({ error: '分享尚未完成，請稍後重試。私人原稿不受影響。' });
  };
  router.use(errors); return router;
}
