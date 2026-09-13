import { Router, type Request, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { pool } from './db';
import { GroupError } from './lifeGroupRepository';
import { devotionDayWindow, devotionWallShareInput } from '../shared/devotionWall';

async function windowNow() {
  return devotionDayWindow((await pool.query('SELECT clock_timestamp() AS now')).rows[0].now);
}
export function devotionWallRoutes(resolveUserId:(req:Request)=>Promise<string|null>) {
  const router = Router();
  router.use(async(req,res,next)=>{
    res.setHeader('Cache-Control','private, no-store');
    const actor=await resolveUserId(req);if(!actor)return void res.status(401).json({error:'請先登入。'});
    if(!['GET','HEAD'].includes(req.method)){
      let invalid=req.get('sec-fetch-site')==='cross-site'; const origin=req.get('origin');
      if(origin){try{invalid ||= new URL(origin).host!==req.get('host');}catch{invalid=true;}}
      if(invalid)return void res.status(403).json({error:'不接受跨網站寫入。'});
    }
    res.locals.actor=actor;next();
  });
  router.get('/window',async(_req,res)=>{res.json(await windowNow());});
  router.get(['/', '/mine'],async(req,res)=>{
    const window=await windowNow();
    const posts=(await pool.query(`SELECT p.id,p.title,p.body,p.reference,p.is_anonymous AS anonymous,p.user_id=$1 AS "isOwner",
      CASE WHEN p.is_anonymous THEN '匿名' ELSE COALESCE(NULLIF(u.display_name,''),'教會成員') END AS "authorName",
      p.created_at AS "createdAt",p.expires_at AS "expiresAt" FROM devotion_wall_posts p JOIN users u ON u.id=p.user_id
      WHERE p.published_day=$2::date AND p.expires_at>clock_timestamp() AND p.withdrawn_at IS NULL
      AND (NOT $3::boolean OR p.user_id=$1) ORDER BY p.created_at DESC,p.id`,[res.locals.actor,window.day,req.path === '/mine'])).rows;
    res.json({...window,posts});
  });
  router.post('/',async(req,res)=>{
    const input=devotionWallShareInput.parse(req.body); const actor=res.locals.actor;
    const c=await pool.connect();
    try{
      await c.query('BEGIN');
      if(!(await c.query('SELECT id FROM devotional_notes WHERE id=$1 AND user_id=$2 AND hidden=false FOR UPDATE',[input.sourceId,actor])).rowCount)throw new GroupError(404,'找不到本人已儲存的筆記，尚未分享。');
      const window=devotionDayWindow((await c.query('SELECT clock_timestamp() AS now')).rows[0].now);
      if(input.day!==window.day)throw new GroupError(409,'已經換日，請重新確認今天的分享日期。');
      const existing=(await c.query('SELECT id,title,body,reference,is_anonymous FROM devotion_wall_posts WHERE source_note_id=$1 AND published_day=$2 AND withdrawn_at IS NULL',[input.sourceId,window.day])).rows[0];
      if(existing){
        if(existing.title!==input.title || existing.body!==input.body || existing.reference!==input.reference || existing.is_anonymous!==input.anonymous)throw new GroupError(409,'這篇筆記今天已分享；請先在靈修牆撤回，再分享修改後的內容。');
        await c.query('COMMIT');return void res.json({id:existing.id,created:false,...window});
      }
      const post=(await c.query(`INSERT INTO devotion_wall_posts(source_note_id,user_id,published_day,title,body,reference,is_anonymous,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[input.sourceId,actor,window.day,input.title,input.body,input.reference,input.anonymous,window.expiresAt])).rows[0];
      await c.query('COMMIT');res.status(201).json({id:post.id,created:true,...window});
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  });
  router.delete('/:id',async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id);
    const result=await pool.query('UPDATE devotion_wall_posts SET withdrawn_at=COALESCE(withdrawn_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',[id,res.locals.actor]);
    if(!result.rowCount)throw new GroupError(404,'找不到本人的分享。');
    res.json({ok:true});
  });
  const errors:ErrorRequestHandler=(e,_req,res,_next)=>{
    if(e instanceof z.ZodError)return void res.status(400).json({error:'請確認分享內容並勾選公開同意。'});
    if(e instanceof GroupError)return void res.status(e.status).json({error:e.message});
    console.error('[devotion-wall]',e?.code || e?.name);res.status(503).json({error:'分享尚未完成，請保留內容後重試。'});
  };
  router.use(errors);return router;
}
