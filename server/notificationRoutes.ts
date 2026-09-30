import { Router, type Request, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { markNotificationRead, markNotificationsRead, notificationFeed } from './notificationRepository';
import { markNotificationsReadInput } from '../shared/notifications';

export function notificationRoutes(resolveUserId: (req: Request) => Promise<string | null>) {
  const router = Router();
  router.use(async(req,res,next) => {
    res.setHeader('Cache-Control','private, no-store');
    const actor = await resolveUserId(req);
    if (!actor) return void res.status(401).json({error:'請先登入。'});
    if (!['GET','HEAD'].includes(req.method)) {
      let invalid = req.get('sec-fetch-site') === 'cross-site';
      if (req.get('origin')) { try { invalid ||= new URL(req.get('origin')!).host !== req.get('host'); } catch { invalid = true; } }
      if (invalid) return void res.status(403).json({error:'不接受跨網站寫入。'});
    }
    res.locals.actor = actor; next();
  });
  router.get('/',async(req,res) => {
    const cursor = z.string().max(100).optional().parse(req.query.cursor);
    let parsed: {at:string;id:string} | undefined;
    if (cursor) {
      const [at,id] = cursor.split('_');
      parsed = z.object({at:z.string().datetime({offset:true}),id:z.string().uuid()}).parse({at,id});
    }
    res.json(await notificationFeed(res.locals.actor,parsed));
  });
  router.post('/read-all',async(req,res) => {
    const {before} = markNotificationsReadInput.parse(req.body);
    await markNotificationsRead(res.locals.actor,before); res.json({ok:true});
  });
  router.post('/:id/read',async(req,res) => {
    const found = await markNotificationRead(res.locals.actor,z.string().uuid().parse(req.params.id));
    res.status(found ? 200 : 404).json(found ? {ok:true} : {error:'這則通知已失效或不屬於你。'});
  });
  const errors: ErrorRequestHandler = (e,_req,res,_next) => {
    if (e instanceof z.ZodError) return void res.status(400).json({error:'通知格式不正確，請重新載入。'});
    console.error('[notifications]',e?.code || e?.name);
    res.status(503).json({error:'通知暫時無法載入，請重試。'});
  };
  router.use(errors); return router;
}
