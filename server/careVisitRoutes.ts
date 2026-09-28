import { Router, type Request, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { normalizeChurch, getChurchAliases } from './churches';
import { visitCreate, visitUpdate, visitStatusLabels } from '../shared/care';
import { GroupError } from './lifeGroupRepository';

const roles = ['admin', 'senior_pastor', 'pastor', 'minister'];
const uuid = z.string().uuid();
const missing = () => new GroupError(404, '找不到探訪申請，或你沒有存取權限。');
async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
}
async function actorInfo(actor: string) {
  const row = (await pool.query(`SELECT church,EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role::text=ANY($2)) AS staff FROM users WHERE id=$1`, [actor, roles])).rows[0];
  return { church: normalizeChurch(row?.church), staff: !!row?.staff };
}
const projection = `r.id,r.sender_id AS "senderId",coalesce(u.display_name,'使用者') AS "senderName",r.name,r.reason,
  r.contact_method AS "contactMethod",r.urgency,r.status,r.assignee_id AS "assigneeId",a.display_name AS "assigneeName",
  r.due_date::text AS "dueDate",r.next_action AS "nextAction",r.version,r.created_at AS "createdAt"`;

export function careVisitRoutes(resolveUserId: (req: Request) => Promise<string | null>) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const actor = await resolveUserId(req);
    if (!actor) return void res.status(401).json({ error: '請先登入。' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      let invalid = req.get('sec-fetch-site') === 'cross-site';
      if (req.get('origin')) { try { invalid ||= new URL(req.get('origin')!).host !== req.get('host'); } catch { invalid = true; } }
      if (invalid) return void res.status(403).json({ error: '不接受跨網站寫入。' });
    }
    res.locals.actor = actor;
    res.locals.info = await actorInfo(actor);
    next();
  });
  router.get('/summary', async (_req, res) => {
    const { church, staff } = res.locals.info;
    const counts = staff && church ? (await pool.query(`SELECT count(*)::int AS pending,count(*) FILTER(WHERE urgency='urgent')::int AS urgent
      FROM care_visit_requests WHERE church=$1 AND status='open'`, [church])).rows[0] : { pending: 0, urgent: 0 };
    const available = church ? (await pool.query(`SELECT count(*)::int AS n FROM users u WHERE u.church=ANY($1)
      AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role::text=ANY($2))`, [getChurchAliases(church), roles])).rows[0].n > 0 : false;
    res.json({ canManage: staff && !!church, available, ...counts });
  });
  router.get('/staff', async (_req, res) => {
    const { church, staff } = res.locals.info;
    if (!staff || !church) throw new GroupError(403, '需要同教會牧者權限。');
    res.json((await pool.query(`SELECT id,coalesce(display_name,'牧者') AS name FROM users u WHERE church=ANY($1)
      AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role::text=ANY($2)) ORDER BY display_name,id`, [getChurchAliases(church), roles])).rows);
  });
  router.get('/', async (req, res) => {
    const mode = z.enum(['mine', 'inbox']).default('mine').parse(req.query.mode);
    const filter = z.enum(['active', 'closed']).default('active').parse(req.query.filter);
    const offset = z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
    const { church, staff } = res.locals.info;
    if (mode === 'inbox' && (!staff || !church)) throw new GroupError(403, '需要同教會牧者權限。');
    const rows = (await pool.query(`SELECT ${projection} FROM care_visit_requests r JOIN users u ON u.id=r.sender_id LEFT JOIN users a ON a.id=r.assignee_id
      WHERE ${mode === 'mine' ? 'r.sender_id=$1' : 'r.church=$1'} AND r.status=ANY($2)
      ORDER BY CASE WHEN r.urgency='urgent' THEN 0 ELSE 1 END,r.created_at,r.id LIMIT 31 OFFSET $3`,
    [mode === 'mine' ? res.locals.actor : church, filter === 'active' ? ['open', 'assigned'] : ['completed', 'cancelled'], offset])).rows;
    res.json({ requests: rows.slice(0, 30), hasMore: rows.length > 30 });
  });
  router.put('/:id', async (req, res) => {
    const id = uuid.parse(req.params.id), input = visitCreate.parse(req.body), actor = res.locals.actor;
    const { church } = res.locals.info;
    if (!church) throw new GroupError(400, '請先在個人資料設定所屬教會。');
    res.json(await transaction(async c => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext('care-visit:' || $1))", [id]);
      const old = (await c.query('SELECT * FROM care_visit_requests WHERE id=$1', [id])).rows[0];
      if (old) {
        if (old.sender_id !== actor) throw missing();
        if (old.name !== input.name || old.reason !== input.reason || old.contact_method !== input.contactMethod || old.urgency !== input.urgency || old.contact_id !== input.contactId) throw new GroupError(409, '申請已送出，請重新載入。');
        return { id, created: false };
      }
      if (input.contactId && !(await c.query('SELECT id FROM care_contacts WHERE id=$1 AND user_id=$2 AND NOT is_archived FOR SHARE', [input.contactId, actor])).rowCount) throw missing();
      if (!(await c.query(`SELECT id FROM users u WHERE church=ANY($1) AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role::text=ANY($2)) LIMIT 1`, [getChurchAliases(church), roles])).rowCount) throw new GroupError(409, '目前沒有可承接的牧者，請直接聯絡教會。');
      await c.query(`INSERT INTO care_visit_requests(id,sender_id,contact_id,church,name,reason,contact_method,urgency) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, actor, input.contactId, church, input.name, input.reason, input.contactMethod, input.urgency]);
      await c.query('INSERT INTO care_visit_events(request_id,actor_id,body) VALUES($1,$2,$3)', [id, actor, '已送至牧者探訪收件匣']);
      return { id, created: true };
    }));
  });
  async function access(c: PoolClient, id: string, actor: string, info: { church: string | null; staff: boolean }) {
    const r = (await c.query('SELECT *,due_date::text AS due_date FROM care_visit_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!r || (r.sender_id !== actor && !(info.staff && info.church === r.church))) throw missing();
    return r;
  }
  router.get('/:id/events', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const offset = z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
    res.json(await transaction(async c => {
      await access(c, id, res.locals.actor, res.locals.info);
      const rows = (await c.query(`SELECT e.id,e.body,e.created_at AS "createdAt",coalesce(u.display_name,'同工') AS "authorName"
        FROM care_visit_events e JOIN users u ON u.id=e.actor_id WHERE request_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 31 OFFSET $2`, [id, offset])).rows;
      return { events: rows.slice(0, 30), hasMore: rows.length > 30 };
    }));
  });
  router.get('/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    res.json(await transaction(async c => {
      await access(c, id, res.locals.actor, res.locals.info);
      return (await c.query(`SELECT ${projection} FROM care_visit_requests r JOIN users u ON u.id=r.sender_id LEFT JOIN users a ON a.id=r.assignee_id WHERE r.id=$1`, [id])).rows[0];
    }));
  });
  router.patch('/:id', async (req, res) => {
    const id = uuid.parse(req.params.id), input = visitUpdate.parse(req.body), actor = res.locals.actor;
    res.json(await transaction(async c => {
      const old = await access(c, id, actor, res.locals.info);
      const manager = res.locals.info.staff && res.locals.info.church === old.church;
      if (old.version !== input.version) throw new GroupError(409, '其他同工已更新安排。請載入最新狀態，輸入會保留。');
      if (['cancelled', 'completed'].includes(old.status)) throw new GroupError(409, '這筆申請已結束。');
      if (!manager && (input.status !== 'cancelled' || input.assigneeId !== old.assignee_id || input.dueDate !== (old.due_date ? String(old.due_date).slice(0, 10) : null))) throw new GroupError(403, '只有牧者能安排探訪。');
      if (input.assigneeId && !(await c.query(`SELECT id FROM users u WHERE id=$1 AND church=ANY($2)
        AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role::text=ANY($3)) FOR SHARE`, [input.assigneeId, getChurchAliases(old.church), roles])).rowCount) throw new GroupError(400, '請選擇同教會的牧者或傳道人。');
      if (input.status === 'completed' && !input.assigneeId) throw new GroupError(400, '請記下負責探訪的同工。');
      await c.query(`UPDATE care_visit_requests SET status=$2,assignee_id=$3,due_date=$4,next_action=$5,version=version+1,updated_at=now() WHERE id=$1`, [id, input.status, input.assigneeId, input.dueDate, input.note]);
      const name = input.assigneeId ? (await c.query('SELECT display_name FROM users WHERE id=$1', [input.assigneeId])).rows[0]?.display_name || '同工' : '尚未指派';
      await c.query('INSERT INTO care_visit_events(request_id,actor_id,body) VALUES($1,$2,$3)', [id, actor, `${visitStatusLabels[input.status]} · ${name}${input.dueDate ? ` · ${input.dueDate}` : ''}\n${input.note}`]);
      return { ok: true };
    }));
  });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError) return void res.status(400).json({ error: '請檢查必填欄位與日期。' });
    if (error instanceof GroupError) return void res.status(error.status).json({ error: error.message });
    console.error('[care-visits] Request failed');
    res.status(500).json({ error: '暫時無法處理探訪申請，請重試。' });
  };
  router.use(errors);
  return router;
}
