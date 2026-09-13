import { Router, type Request, type ErrorRequestHandler } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from './db';
import { GroupError } from './lifeGroupRepository';
import { prayerInteractionInput, prayerReactionInput, prayerReactionKind } from '../shared/prayerInteraction';

async function withPrayer<T>(id: string, work: (c: PoolClient) => Promise<T>, allowClosed = false) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const prayer=(await c.query('SELECT id,closed_at,is_answered FROM prayers WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!prayer) throw new GroupError(404, '這則禱告已撤回或不存在。');
    if (!allowClosed && (prayer.closed_at || prayer.is_answered)) throw new GroupError(409,'這則代禱已結束。');
    const result = await work(c); await c.query('COMMIT'); return result;
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}

const commentProjection = `SELECT c.id,c.prayer_id AS "prayerId",c.content,c.kind,c.sticker,c.created_at AT TIME ZONE 'UTC' AS "createdAt",
  c.user_id=$2 AS "isOwner",(p.is_anonymous AND p.user_id=c.user_id) AS "isAnonymous",
  CASE WHEN p.is_anonymous AND p.user_id=c.user_id THEN NULL ELSE c.user_id END AS "userId",
  CASE WHEN p.is_anonymous AND p.user_id=c.user_id THEN '匿名發文者' ELSE COALESCE(NULLIF(u.display_name,''),'教會成員') END AS "authorName",
  CASE WHEN p.is_anonymous AND p.user_id=c.user_id THEN NULL ELSE u.avatar_url END AS "authorAvatar"
  FROM prayer_comments c JOIN prayers p ON p.id=c.prayer_id JOIN users u ON u.id=c.user_id WHERE c.prayer_id=$1`;

export function prayerInteractionRoutes(resolveUserId: (req: Request) => Promise<string | null>, getRole: (id: string) => Promise<string | null | undefined>) {
  const router = Router();
  router.use(async (req,res,next) => {
    res.setHeader('Cache-Control','private, no-store');
    const actor = await resolveUserId(req);
    if (!actor) return void res.status(401).json({ error: '請先登入。' });
    if (!['GET','HEAD'].includes(req.method)) {
      const origin = req.get('origin'); let invalid = req.get('sec-fetch-site') === 'cross-site';
      if (origin) { try { invalid ||= new URL(origin).host !== req.get('host'); } catch { invalid = true; } }
      if (invalid) return void res.status(403).json({ error: '不接受跨網站寫入。' });
    }
    res.locals.actor = actor; next();
  });
  router.put('/:id/reactions/:kind', async (req,res) => {
    const id = z.string().uuid().parse(req.params.id);
    const kind = prayerReactionKind.parse(req.params.kind);
    const {selected} = prayerReactionInput.parse(req.body);
    await withPrayer(id, async c => {
      if (selected) await c.query('INSERT INTO prayer_reactions(prayer_id,user_id,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,res.locals.actor,kind]);
      else await c.query('DELETE FROM prayer_reactions WHERE prayer_id=$1 AND user_id=$2 AND kind=$3',[id,res.locals.actor,kind]);
    }, !selected);
    res.json({ ok: true });
  });
  router.post('/:id/amen', async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id);
    await withPrayer(id,async c=>{
      await c.query('INSERT INTO prayer_amens(prayer_id,user_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM prayer_amens WHERE prayer_id=$1 AND user_id=$2)',[id,res.locals.actor]);
    });
    res.status(201).json({ok:true});
  });
  router.get('/:id/comments', async (req,res) => {
    const id = z.string().uuid().parse(req.params.id);
    if (!(await pool.query('SELECT id FROM prayers WHERE id=$1 AND ((closed_at IS NULL AND NOT is_answered) OR user_id=$2)',[id,res.locals.actor])).rowCount) throw new GroupError(404,'這則禱告已結束、撤回或不存在。');
    res.json((await pool.query(`${commentProjection} AND ((p.closed_at IS NULL AND NOT p.is_answered) OR p.user_id=$2) ORDER BY c.created_at,c.id`,[id,res.locals.actor])).rows);
  });
  router.post('/:id/comments', async (req,res) => {
    const id = z.string().uuid().parse(req.params.id); const actor = res.locals.actor;
    const input = prayerInteractionInput.parse(req.body);
    const comment = await withPrayer(id, async c => {
      const inserted = await c.query(`INSERT INTO prayer_comments(prayer_id,user_id,content,kind,sticker,request_id) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(user_id,request_id) WHERE request_id IS NOT NULL DO NOTHING RETURNING id`,[id,actor,input.content,input.kind,input.sticker || null,input.requestId || null]);
      let commentId = inserted.rows[0]?.id;
      if (!commentId) {
        const previous = (await c.query('SELECT * FROM prayer_comments WHERE user_id=$1 AND request_id=$2',[actor,input.requestId])).rows[0];
        if (!previous || previous.prayer_id !== id || previous.content !== input.content || previous.kind !== input.kind || previous.sticker !== (input.sticker || null)) throw new GroupError(409,'此回應已送出，請重新整理後再試。');
        commentId = previous.id;
      }
      return (await c.query(`${commentProjection} AND c.id=$3`,[id,actor,commentId])).rows[0];
    });
    res.status(201).json(comment);
  });
  router.delete('/:id/comments/:commentId', async (req,res) => {
    const id = z.string().uuid().parse(req.params.id); const commentId = z.string().uuid().parse(req.params.commentId);
    const actor = res.locals.actor; const admin = await getRole(actor) === 'admin';
    await withPrayer(id, async c => {
      const comment = (await c.query('SELECT user_id FROM prayer_comments WHERE id=$1 AND prayer_id=$2',[commentId,id])).rows[0];
      if (!comment) throw new GroupError(404,'找不到這則回應。');
      if (comment.user_id !== actor && !admin) throw new GroupError(403,'只能撤回自己的回應。');
      await c.query('DELETE FROM prayer_comments WHERE id=$1 AND prayer_id=$2',[commentId,id]);
    }, true);
    res.json({ok:true});
  });
  const errors: ErrorRequestHandler = (e,_req,res,_next) => {
    if (e instanceof z.ZodError) return void res.status(400).json({error:'請確認回應內容與格式。'});
    if (e instanceof GroupError) return void res.status(e.status).json({error:e.message});
    console.error('[prayer-interaction]',e?.code || e?.name);
    res.status(503).json({error:'回應尚未完成，請保留文字後重試。'});
  };
  router.use(errors); return router;
}
