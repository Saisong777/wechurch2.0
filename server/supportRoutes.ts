import { Router, type Request, type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { getChurchAliases, normalizeChurch } from './churches';
import { groupAccess, GroupError } from './lifeGroupRepository';
import { supportCreate, supportTarget, supportUpdate, supportReply, mayTransitionSupport, supportStatusLabels, type SupportStatus } from '../shared/support';

const uuid = z.string().uuid();
const missing = () => new GroupError(404, '找不到事項，或你沒有存取權限。');
const conflict = () => new GroupError(409, '事項已更新，請重新載入；你的輸入仍保留。');
async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
}
const receiverActiveSql = `(EXISTS(SELECT 1 FROM small_groups g WHERE g.id=r.group_id AND g.is_active AND (g.leader_user_id=r.receiver_id OR g.pastor_user_id=r.receiver_id))
  OR EXISTS(SELECT 1 FROM support_destinations d WHERE d.id=r.destination_id AND d.is_active AND d.owner_id=r.receiver_id))`;
const projection = `r.id,r.sender_id AS "senderId",r.receiver_id AS "receiverId",r.title,r.body,r.status,r.next_action AS "nextAction",
  r.due_date::text AS "dueDate",r.version,r.updated_at AS "updatedAt",r.sender_id=$1 AS "isSender",
  COALESCE(s.display_name,'使用者') AS "senderName",COALESCE(u.display_name,'關懷同工') AS "receiverName"`;

async function validTarget(c: PoolClient, actor: string, target: z.infer<typeof supportTarget>) {
  if (target.receiverId === actor) throw new GroupError(400, '請選擇另一位陪伴者。');
  if (target.kind === 'group') {
    await groupAccess(c, target.id, actor);
    if (!(await c.query('SELECT id FROM small_groups WHERE id=$1 AND is_active AND (leader_user_id=$2 OR pastor_user_id=$2) FOR SHARE', [target.id, target.receiverId])).rowCount) throw missing();
  } else if (!(await c.query('SELECT id FROM support_destinations WHERE id=$1 AND owner_id=$2 AND is_active FOR SHARE', [target.id, target.receiverId])).rowCount) throw missing();
}
async function requestAccess(c: PoolClient, id: string, actor: string) {
  const r = (await c.query('SELECT * FROM support_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!r) throw missing();
  if (r.sender_id === actor) return r;
  if (r.receiver_id !== actor || r.status === 'cancelled') throw missing();
  if (r.group_id) {
    const g = await groupAccess(c, r.group_id, actor, true);
    if (!g.manager) throw missing();
  } else if (!(await c.query('SELECT id FROM support_destinations WHERE id=$1 AND owner_id=$2 AND is_active FOR SHARE', [r.destination_id, actor])).rowCount) throw missing();
  return r;
}
async function director(c: PoolClient, actor: string) {
  const user = (await c.query(`SELECT u.id,u.church,EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role='admin') AS admin,
    EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role IN ('admin','senior_pastor')) AS allowed FROM users u WHERE u.id=$1`, [actor])).rows[0];
  if (!user?.allowed) throw new GroupError(403, '需要教會管理權限。');
  return user;
}

export function supportRoutes(resolveUserId: (req: Request) => Promise<string | null>) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const actor = await resolveUserId(req); if (!actor) return void res.status(401).json({ error: '請先登入。' });
    if (!['GET','HEAD'].includes(req.method)) {
      let invalid = req.get('sec-fetch-site') === 'cross-site'; const origin = req.get('origin');
      if (origin) { try { invalid ||= new URL(origin).host !== req.get('host'); } catch { invalid = true; } }
      if (invalid) return void res.status(403).json({ error: '不接受跨網站寫入。' });
    }
    res.locals.actor = actor; next();
  });
  router.get('/targets', async (_req, res) => {
    const actor = res.locals.actor;
    const groups = (await pool.query(`SELECT 'group' AS kind,g.id,g.name,u.id AS "receiverId",COALESCE(u.display_name,'小組同工') AS "receiverName"
      FROM small_groups g JOIN users u ON u.id=g.leader_user_id OR u.id=g.pastor_user_id
      WHERE g.is_active AND u.id<>$1 AND (g.leader_user_id=$1 OR g.pastor_user_id=$1 OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=$1 AND m.is_active)) ORDER BY g.name,u.id`, [actor])).rows;
    const destinations = (await pool.query(`SELECT 'destination' AS kind,d.id,d.name,d.owner_id AS "receiverId",COALESCE(u.display_name,'關懷同工') AS "receiverName"
      FROM support_destinations d JOIN users u ON u.id=d.owner_id WHERE d.is_active AND u.id<>$1 ORDER BY d.church,d.name`, [actor])).rows;
    res.json([...groups, ...destinations]);
  });
  router.get('/access', async (_req, res) => {
    const actor = res.locals.actor;
    const row = (await pool.query(`SELECT
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN ('admin','senior_pastor')) AS "canConfigure",
      (EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN ('admin','senior_pastor','pastor','minister','group_leader','leader','future_leader'))
      OR EXISTS(SELECT 1 FROM small_groups WHERE is_active AND (leader_user_id=$1 OR pastor_user_id=$1))
      OR EXISTS(SELECT 1 FROM support_destinations WHERE is_active AND owner_id=$1)) AS "canWork"`, [actor])).rows[0];
    res.json(row);
  });
  router.get('/config', async (_req, res) => res.json(await transaction(async c => {
    const user = await director(c, res.locals.actor);
    const scope = user.admin ? null : getChurchAliases(normalizeChurch(user.church) || '__unassigned');
    const destinations = (await c.query('SELECT id,name,church,owner_id AS "ownerId",is_active AS "isActive" FROM support_destinations WHERE ($1::text[] IS NULL OR church=ANY($1)) ORDER BY name', [scope])).rows;
    const receivers = (await c.query(`SELECT u.id,COALESCE(u.display_name,'同工') AS name,u.church FROM users u WHERE ($1::text[] IS NULL OR u.church=ANY($1))
      AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role IN ('pastor','minister','senior_pastor','group_leader','leader')) ORDER BY name`, [scope])).rows;
    return { destinations, receivers };
  })));
  router.post('/config', async (req, res) => {
    const input = z.object({ name: z.string().trim().min(1).max(120), ownerId: uuid }).strict().parse(req.body);
    res.status(201).json(await transaction(async c => {
      const user = await director(c, res.locals.actor);
      const receiver = (await c.query(`SELECT u.church FROM users u WHERE u.id=$1 AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=u.id AND role IN ('pastor','minister','senior_pastor','group_leader','leader')) FOR SHARE`, [input.ownerId])).rows[0];
      if (!receiver?.church || (!user.admin && normalizeChurch(receiver.church) !== normalizeChurch(user.church))) throw missing();
      const destination = (await c.query('INSERT INTO support_destinations(name,church,owner_id,created_by) VALUES($1,$2,$3,$4) RETURNING id', [input.name, receiver.church, input.ownerId, res.locals.actor])).rows[0];
      await c.query("INSERT INTO support_destination_audit(destination_id,actor_id,action) VALUES($1,$2,'created')", [destination.id,res.locals.actor]);
      return destination;
    }));
  });
  router.patch('/config/:id', async (req, res) => {
    const id = uuid.parse(req.params.id), input = z.object({ isActive: z.boolean() }).strict().parse(req.body);
    res.json(await transaction(async c => {
      const user = await director(c, res.locals.actor), destination = (await c.query('SELECT * FROM support_destinations WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!destination || (!user.admin && normalizeChurch(destination.church) !== normalizeChurch(user.church))) throw missing();
      await c.query('UPDATE support_destinations SET is_active=$2 WHERE id=$1', [id, input.isActive]);
      await c.query('INSERT INTO support_destination_audit(destination_id,actor_id,action) VALUES($1,$2,$3)', [id,res.locals.actor,input.isActive?'enabled':'disabled']);
      return { ok: true };
    }));
  });
  router.get('/requests', async (req, res) => {
    const mode = z.enum(['personal','work']).default('personal').parse(req.query.mode);
    const offset = z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
    const filter = z.enum(['all','open','active','waiting','closed']).default('all').parse(req.query.filter);
    const statuses = { all: null, open: ['open'], active: ['open','accepted','waiting_requester','waiting_support'], waiting: ['waiting_requester','waiting_support'], closed: ['completed','declined','cancelled'] }[filter];
    const rows = (await pool.query(`SELECT ${projection} FROM support_requests r JOIN users s ON s.id=r.sender_id JOIN users u ON u.id=r.receiver_id
      WHERE ${mode === 'personal' ? 'r.sender_id=$1' : `r.receiver_id=$1 AND r.status<>'cancelled' AND ${receiverActiveSql}`}
      AND ($3::text[] IS NULL OR r.status=ANY($3))
      ORDER BY CASE WHEN r.status IN ('open','accepted','waiting_requester','waiting_support') THEN 0 ELSE 1 END,
        r.due_date ASC NULLS LAST,r.updated_at DESC,r.id LIMIT 31 OFFSET $2`, [res.locals.actor,offset,statuses])).rows;
    res.json({ requests: rows.slice(0,30), hasMore: rows.length>30 });
  });
  router.put('/requests/:id', async (req, res) => {
    const id = uuid.parse(req.params.id), input = supportCreate.parse(req.body), actor = res.locals.actor;
    res.json(await transaction(async c => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext('support-create:' || $1))", [id]);
      const old = (await c.query('SELECT * FROM support_requests WHERE id=$1', [id])).rows[0];
      if (old) {
        if (old.sender_id!==actor) throw missing();
        if (old.title!==input.title || old.body!==input.body || old.receiver_id!==input.target.receiverId || (old.group_id || old.destination_id)!==input.target.id) throw conflict();
        return { id, created: false };
      }
      await validTarget(c, actor, input.target);
      await c.query('INSERT INTO support_requests(id,sender_id,receiver_id,group_id,destination_id,title,body) VALUES($1,$2,$3,$4,$5,$6,$7)', [id,actor,input.target.receiverId,input.target.kind==='group'?input.target.id:null,input.target.kind==='destination'?input.target.id:null,input.title,input.body]);
      return { id, created: true };
    }));
  });
  router.get('/requests/:id', async (req, res) => res.json(await transaction(async c => {
    const id=uuid.parse(req.params.id), actor=res.locals.actor; await requestAccess(c,id,actor);
    const request=(await c.query(`SELECT ${projection} FROM support_requests r JOIN users s ON s.id=r.sender_id JOIN users u ON u.id=r.receiver_id WHERE r.id=$2`,[actor,id])).rows[0];
    const events=(await c.query(`SELECT e.id,e.body,e.is_private AS private,COALESCE(u.display_name,'使用者') AS "authorName",e.created_at AS "createdAt"
      FROM support_events e JOIN users u ON u.id=e.author_id WHERE e.request_id=$1 AND (NOT e.is_private OR e.author_id=$2) ORDER BY e.created_at DESC,e.id DESC LIMIT 501`,[id,actor])).rows;
    return { request, events: events.slice(0,500).reverse(), hasOlderEvents: events.length > 500 };
  })));
  router.patch('/requests/:id', async(req,res)=>{
    const id=uuid.parse(req.params.id),input=supportUpdate.parse(req.body),actor=res.locals.actor;
    res.json(await transaction(async c=>{
      const old=await requestAccess(c,id,actor); if(old.version!==input.version)throw conflict();
      if(!mayTransitionSupport(old.status as SupportStatus,input.status,old.sender_id===actor))throw new GroupError(409,'目前不能進行這項狀態變更。');
      if(input.status==='open') await validTarget(c,actor,{kind:old.group_id?'group':'destination',id:old.group_id||old.destination_id,receiverId:old.receiver_id});
      if(['waiting_requester','waiting_support','declined'].includes(input.status)&&!input.nextAction)throw new GroupError(400,'請填寫下一步或退回原因。');
      await c.query('UPDATE support_requests SET status=$2,next_action=$3,due_date=$4,version=version+1,updated_at=now() WHERE id=$1',[id,input.status,old.sender_id===actor?old.next_action:input.nextAction,old.sender_id===actor?old.due_date:input.dueDate]);
      await c.query('INSERT INTO support_events(id,request_id,author_id,body) VALUES($1,$2,$3,$4)',[randomUUID(),id,actor,`狀態：${supportStatusLabels[input.status]}${input.nextAction ? `；下一步：${input.nextAction}` : ''}`]);
      return {ok:true};
    }));
  });
  router.put('/requests/:id/replies/:replyId',async(req,res)=>{
    const id=uuid.parse(req.params.id),replyId=uuid.parse(req.params.replyId),input=supportReply.parse(req.body),actor=res.locals.actor;
    res.json(await transaction(async c=>{
      const old=await requestAccess(c,id,actor);
      const existing=(await c.query('SELECT * FROM support_events WHERE id=$1',[replyId])).rows[0];
      if(existing){if(existing.request_id!==id||existing.author_id!==actor||existing.body!==input.body||existing.is_private!==input.private)throw conflict();return {ok:true};}
      if(old.version!==input.version)throw conflict();
      if(old.status==='cancelled')throw new GroupError(409,'事項已取消。');
      await c.query('INSERT INTO support_events(id,request_id,author_id,body,is_private) VALUES($1,$2,$3,$4,$5)',[replyId,id,actor,input.body,input.private]);
      await c.query('UPDATE support_requests SET version=version+1,updated_at=now() WHERE id=$1',[id]);return {ok:true};
    }));
  });
  router.post('/requests/:id/transfer',async(req,res)=>{
    const id=uuid.parse(req.params.id),input=z.object({version:z.number().int().positive(),target:supportTarget,consent:z.literal(true)}).strict().parse(req.body),actor=res.locals.actor;
    res.json(await transaction(async c=>{
      const old=await requestAccess(c,id,actor);if(old.sender_id!==actor)throw new GroupError(403,'轉交需由本人確認分享對象。');if(old.version!==input.version)throw conflict();
      await validTarget(c,actor,input.target);
      await c.query("UPDATE support_requests SET receiver_id=$2,group_id=$3,destination_id=$4,status='open',next_action='',due_date=NULL,consent_at=now(),version=version+1,updated_at=now() WHERE id=$1",[id,input.target.receiverId,input.target.kind==='group'?input.target.id:null,input.target.kind==='destination'?input.target.id:null]);
      await c.query('INSERT INTO support_events(id,request_id,author_id,body) VALUES($1,$2,$3,$4)',[randomUUID(),id,actor,'本人已確認轉交，等待新的陪伴者承接。']);return {ok:true};
    }));
  });
  const errors: ErrorRequestHandler=(error,_req,res,_next)=>{
    if(error instanceof z.ZodError)return void res.status(400).json({error:'請確認欄位、日期與分享同意。'});
    if(error instanceof GroupError)return void res.status(error.status).json({error:error.message});
    console.error('[support]',error?.code||error?.name);res.status(503).json({error:'服務暫時無法使用，請保留內容並稍後重試。'});
  };
  router.use(errors);return router;
}
