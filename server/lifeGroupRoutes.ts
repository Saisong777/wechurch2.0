import { Router, type Request, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { devotionDate } from '../shared/churchDevotion';
import { careInput, careUpdateInput, commentInput, groupCreateInput, shareEditInput, shareInput } from '../shared/lifeGroup';
import * as groups from './lifeGroupRepository';

export function lifeGroupRoutes(resolveUserId: (req: Request) => Promise<string | null>) {
  const router = Router();
  const uuid = z.string().uuid();
  const offset = (req: Request) => z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const actor = await resolveUserId(req);
    if (!actor) return void res.status(401).json({ error: '請先登入。' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      let invalid = req.get('sec-fetch-site') === 'cross-site';
      if (origin) { try { invalid ||= new URL(origin).host !== req.get('host'); } catch { invalid = true; } }
      if (invalid) return void res.status(403).json({ error: '不接受跨網站寫入。' });
    }
    res.locals.actor = actor;
    next();
  });
  router.get('/', async (_req, res) => { res.json(await groups.myGroups(res.locals.actor)); });
  router.post('/', async (req, res) => { res.status(201).json(await groups.createGroup(res.locals.actor, groupCreateInput.parse(req.body).name)); });
  router.post('/join', async (req, res) => { res.json(await groups.requestJoin(res.locals.actor, z.object({ token: z.string().trim().regex(/^[a-f0-9]{48}$/) }).parse(req.body).token)); });
  router.get('/sources', async (req, res) => { res.json(await groups.shareSources(res.locals.actor, z.enum(['note', 'prayer']).parse(req.query.kind))); });
  router.param('groupId', (req, res, next, value) => { const parsed = uuid.safeParse(value); if (!parsed.success) return void res.status(400).json({ error: '小組編號無效。' }); res.locals.groupId = parsed.data; next(); });
  const args = (res: { locals: Record<string, any> }): [string, string] => [res.locals.groupId, res.locals.actor];
  router.get('/:groupId', async (_req, res) => { res.json(await groups.groupInfo(...args(res))); });
  router.post('/:groupId/invite', async (_req, res) => { res.json(await groups.rotateInvite(...args(res))); });
  router.post('/:groupId/requests/:userId', async (req, res) => { res.json(await groups.decideJoin(...args(res), uuid.parse(req.params.userId), z.object({ approve: z.boolean() }).parse(req.body).approve)); });
  router.delete('/:groupId/members/:userId', async (req, res) => { res.json(await groups.removeMember(...args(res), uuid.parse(req.params.userId))); });
  router.get('/:groupId/reading', async (req, res) => { res.json(await groups.groupReading(...args(res), devotionDate.parse(req.query.date))); });
  router.put('/:groupId/reading/:devotionId', async (req, res) => { const input = z.object({ version: z.number().int().positive(), done: z.boolean() }).parse(req.body); res.json(await groups.markReading(...args(res), uuid.parse(req.params.devotionId), input.version, input.done)); });
  router.get('/:groupId/shares', async (req, res) => { res.json(await groups.listShares(...args(res), z.enum(['note','prayer']).parse(req.query.kind), offset(req))); });
  router.put('/:groupId/shares/:shareId', async (req, res) => { res.json(await groups.createShare(...args(res), uuid.parse(req.params.shareId), shareInput.parse(req.body))); });
  router.patch('/:groupId/shares/:shareId', async (req, res) => { res.json(await groups.editShare(...args(res), uuid.parse(req.params.shareId), shareEditInput.parse(req.body))); });
  router.delete('/:groupId/shares/:shareId', async (req, res) => { res.json(await groups.withdrawShare(...args(res), uuid.parse(req.params.shareId))); });
  router.get('/:groupId/shares/:shareId/comments', async (req, res) => { res.json(await groups.shareComments(...args(res), uuid.parse(req.params.shareId), offset(req))); });
  router.put('/:groupId/shares/:shareId/comments/:commentId', async (req, res) => { res.json(await groups.addComment(...args(res), uuid.parse(req.params.shareId), uuid.parse(req.params.commentId), commentInput.parse(req.body).body)); });
  router.delete('/:groupId/shares/:shareId/comments/:commentId', async (req, res) => { res.json(await groups.withdrawComment(...args(res), uuid.parse(req.params.shareId), uuid.parse(req.params.commentId))); });
  router.put('/:groupId/shares/:shareId/prayed', async (req, res) => { res.json(await groups.prayForShare(...args(res), uuid.parse(req.params.shareId))); });
  router.get('/:groupId/care', async (req, res) => { res.json(await groups.listCare(...args(res), offset(req), req.query.watching === 'true')); });
  router.put('/:groupId/care/:careId', async (req, res) => { res.json(await groups.createCare(...args(res), uuid.parse(req.params.careId), careInput.parse(req.body))); });
  router.patch('/:groupId/care/:careId', async (req, res) => { res.json(await groups.editCare(...args(res), uuid.parse(req.params.careId), z.object({ version: z.number().int().positive() }).parse(req.body).version, careInput.parse(req.body))); });
  router.delete('/:groupId/care/:careId', async (req, res) => { res.json(await groups.withdrawCare(...args(res), uuid.parse(req.params.careId))); });
  router.get('/:groupId/care/:careId/updates', async (req, res) => { res.json(await groups.careHistory(...args(res), uuid.parse(req.params.careId), offset(req))); });
  router.put('/:groupId/care/:careId/updates/:updateId', async (req, res) => { res.json(await groups.updateCare(...args(res), uuid.parse(req.params.careId), uuid.parse(req.params.updateId), careUpdateInput.parse(req.body))); });
  router.put('/:groupId/care/:careId/watch', async (req, res) => { res.json(await groups.watchCare(...args(res), uuid.parse(req.params.careId), z.object({ watch: z.boolean() }).parse(req.body).watch)); });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError) return void res.status(400).json({ error: error.issues.map(i => i.message).join('；') });
    if (error instanceof groups.GroupError) return void res.status(error.status).json({ error: error.message });
    if (error?.code === '23505') return void res.status(409).json({ error: '操作正在處理或內容已存在，請重新載入。' });
    console.error('[life-groups]', error?.code || error?.name);
    res.status(503).json({ error: '小組服務暫時無法使用，請稍後重試。' });
  };
  router.use(errors);
  return router;
}
