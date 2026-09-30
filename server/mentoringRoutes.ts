import { Router, type Request, type ErrorRequestHandler } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from './db';
import { GroupError } from './lifeGroupRepository';
import { mentoringInvite,mentoringAction,mentoringFeedback,mayActOnMentoring,type MentoringStatus } from '../shared/mentoring';
import { mentoringGroupEligibleSql as groupEligible } from './mentoringAccess';

const uuid=z.string().uuid();
const missing=()=>new GroupError(404,'找不到陪伴關係，或你已沒有存取權限。');
const conflict=()=>new GroupError(409,'資料已更新，請重新載入；尚未送出的輸入仍保留。');
const projection=`c.id,c.journey_id AS "journeyId",c.learner_id AS "learnerId",c.mentor_id AS "mentorId",
  c.course_name AS "courseName",c.cadence_days AS "cadenceDays",c.agreement,c.status,c.version,
  c.accepted_at AS "acceptedAt",c.ended_at AS "endedAt",c.created_at AS "createdAt",c.learner_id=$1 AS "isLearner",
  COALESCE(l.display_name,'學員') AS "learnerName",COALESCE(m.display_name,'陪伴者') AS "mentorName"`;
async function transaction<T>(work:(c:PoolClient)=>Promise<T>){
  const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function access(db:PoolClient,id:string,actor:string,ending=false){
  const c=(await db.query('SELECT * FROM mentoring_contracts WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!c)throw missing();
  if(c.learner_id===actor)return c;
  if(c.mentor_id!==actor||!['pending','active'].includes(c.status))throw missing();
  if(!ending&&!(await db.query(`SELECT c.id FROM mentoring_contracts c WHERE c.id=$1 AND ${groupEligible}`,[id])).rowCount)throw missing();
  return c;
}
export function mentoringRoutes(resolveUserId:(req:Request)=>Promise<string|null>){
  const router=Router();
  router.use(async(req,res,next)=>{
    res.setHeader('Cache-Control','private, no-store');
    const actor=await resolveUserId(req);if(!actor)return void res.status(401).json({error:'請先登入。'});
    if(!['GET','HEAD'].includes(req.method)){
      let invalid=req.get('sec-fetch-site')==='cross-site';const origin=req.get('origin');
      if(origin){try{invalid ||= new URL(origin).host!==req.get('host');}catch{invalid=true;}}
      if(invalid)return void res.status(403).json({error:'不接受跨網站寫入。'});
    }
    res.locals.actor=actor;next();
  });
  router.get('/targets',async(_req,res)=>{
    res.json((await pool.query(`SELECT g.id AS "groupId",g.name AS "groupName",u.id AS "mentorId",COALESCE(u.display_name,'陪伴者') AS "mentorName"
      FROM small_groups g JOIN users u ON u.id=g.leader_user_id OR u.id=g.pastor_user_id
      WHERE g.is_active AND u.id<>$1 AND (g.leader_user_id=$1 OR g.pastor_user_id=$1 OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=$1 AND m.is_active))
      ORDER BY g.name,u.id`,[res.locals.actor])).rows);
  });
  router.get('/contracts',async(req,res)=>{
    const mode=z.enum(['learner','mentor']).default('learner').parse(req.query.mode);
    const journeyId=uuid.optional().parse(req.query.journeyId);
    const offset=z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
    const rows=(await pool.query(`SELECT ${projection} FROM mentoring_contracts c JOIN users l ON l.id=c.learner_id JOIN users m ON m.id=c.mentor_id
      WHERE ${mode==='learner'?'c.learner_id=$1':`c.mentor_id=$1 AND c.status IN ('pending','active') AND ${groupEligible}`}
      AND ($2::uuid IS NULL OR c.journey_id=$2) ORDER BY c.created_at DESC,c.id LIMIT 31 OFFSET $3`,[res.locals.actor,journeyId||null,offset])).rows;
    res.json({contracts:rows.slice(0,30),hasMore:rows.length>30});
  });
  router.get('/closures',async(_req,res)=>{
    // Former mentors can leave without regaining learner information.
    res.json((await pool.query(`SELECT c.id,c.status,c.version FROM mentoring_contracts c
      WHERE c.mentor_id=$1 AND c.status IN ('pending','active') AND NOT ${groupEligible}
      ORDER BY c.created_at,c.id LIMIT 100`,[res.locals.actor])).rows);
  });
  router.put('/contracts/:id',async(req,res)=>{
    const id=uuid.parse(req.params.id),input=mentoringInvite.parse(req.body),actor=res.locals.actor;
    res.json(await transaction(async db=>{
      await db.query("SELECT pg_advisory_xact_lock(hashtext('mentoring-invite:' || $1))",[id]);
      const existing=(await db.query('SELECT * FROM mentoring_contracts WHERE id=$1',[id])).rows[0];
      if(existing){
        if(existing.learner_id!==actor)throw missing();
        if(existing.journey_id!==input.journeyId||existing.mentor_id!==input.mentorId||existing.group_id!==input.groupId||existing.agreement!==input.agreement||existing.cadence_days!==input.cadenceDays)throw conflict();
        return {id};
      }
      const journey=(await db.query(`SELECT j.id,t.name FROM person_journeys j JOIN journey_templates t ON t.id=j.template_id
        WHERE j.id=$1 AND j.owner_user_id=$2 AND j.status IN ('active','paused') FOR UPDATE OF j`,[input.journeyId,actor])).rows[0];
      if(!journey||actor===input.mentorId)throw missing();
      const group=(await db.query(`SELECT id FROM small_groups g WHERE g.id=$1 AND g.is_active AND (g.leader_user_id=$2 OR g.pastor_user_id=$2)
        AND (g.leader_user_id=$3 OR g.pastor_user_id=$3 OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=$3 AND m.is_active)) FOR SHARE`,[input.groupId,input.mentorId,actor])).rows[0];
      if(!group)throw missing();
      if((await db.query("SELECT id FROM mentoring_contracts WHERE journey_id=$1 AND status IN ('pending','active')",[journey.id])).rowCount)throw new GroupError(409,'請先結束目前的邀請或陪伴關係，再邀請另一位。');
      await db.query('INSERT INTO mentoring_contracts(id,journey_id,learner_id,mentor_id,group_id,course_name,cadence_days,agreement) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,journey.id,actor,input.mentorId,input.groupId,journey.name,input.cadenceDays,input.agreement]);
      await db.query("INSERT INTO mentoring_events(contract_id,actor_id,action) VALUES($1,$2,'invited')",[id,actor]);return {id};
    }));
  });
  router.get('/contracts/:id',async(req,res)=>{
    const id=uuid.parse(req.params.id),actor=res.locals.actor;
    res.json(await transaction(async db=>{
      const row=await access(db,id,actor);
      const contract=(await db.query(`SELECT ${projection} FROM mentoring_contracts c JOIN users l ON l.id=c.learner_id JOIN users m ON m.id=c.mentor_id WHERE c.id=$2`,[actor,id])).rows[0];
      const progress=row.status==='active'?(await db.query(`SELECT jp.id,jp.day_number AS "dayNumber",COALESCE(jp.content_snapshot->>'title',jd.title) AS title,jp.status,
        CASE WHEN jp.visibility='mentor' AND jp.mentor_contract_id=$2 THEN jp.response_text ELSE NULL END AS "responseText"
        FROM journey_progress jp JOIN journey_days jd ON jd.id=jp.journey_day_id WHERE jp.person_journey_id=$1 ORDER BY jp.day_number LIMIT 400`,[row.journey_id,id])).rows:[];
      const feedback=(await db.query(`SELECT f.id,f.kind,f.body,f.created_at AS "createdAt",COALESCE(u.display_name,'同行者') AS "authorName"
        FROM mentoring_feedback f JOIN users u ON u.id=f.author_id WHERE f.contract_id=$1 ORDER BY f.created_at DESC,f.id DESC LIMIT 201`,[id])).rows;
      return {contract,progress,feedback:feedback.slice(0,200).reverse(),hasOlderFeedback:feedback.length>200};
    }));
  });
  router.patch('/contracts/:id',async(req,res)=>{
    const id=uuid.parse(req.params.id),input=mentoringAction.parse(req.body),actor=res.locals.actor;
    res.json(await transaction(async db=>{
      const row=await access(db,id,actor,input.action!=='accept');if(row.version!==input.version)throw conflict();
      if(!mayActOnMentoring(row.status as MentoringStatus,input.action,row.learner_id===actor))throw new GroupError(409,'目前不能進行這項變更。');
      const status={accept:'active',decline:'declined',end:'ended'}[input.action];
      await db.query(`UPDATE mentoring_contracts SET status=$2,version=version+1,accepted_at=CASE WHEN $2='active' THEN now() ELSE accepted_at END,
        ended_at=CASE WHEN $2 IN ('ended','declined') THEN now() ELSE ended_at END,updated_at=now() WHERE id=$1`,[id,status]);
      if(status!=='active')await db.query("UPDATE journey_progress SET visibility='private',mentor_contract_id=NULL,version=version+1,updated_at=now() WHERE mentor_contract_id=$1",[id]);
      await db.query('INSERT INTO mentoring_events(contract_id,actor_id,action) VALUES($1,$2,$3)',[id,actor,input.action]);return {ok:true};
    }));
  });
  router.put('/contracts/:id/feedback/:entryId',async(req,res)=>{
    const id=uuid.parse(req.params.id),entryId=uuid.parse(req.params.entryId),input=mentoringFeedback.parse(req.body),actor=res.locals.actor;
    res.json(await transaction(async db=>{
      const row=await access(db,id,actor);if(row.status!=='active')throw new GroupError(409,'陪伴關係尚未開始或已結束。');
      const existing=(await db.query('SELECT * FROM mentoring_feedback WHERE id=$1',[entryId])).rows[0];
      if(existing){if(existing.contract_id!==id||existing.author_id!==actor||existing.body!==input.body||existing.kind!==input.kind)throw conflict();return {ok:true};}
      if(row.version!==input.version)throw conflict();
      if((row.learner_id===actor)===(input.kind==='feedback'))throw new GroupError(400,'請使用自己的回應類型。');
      await db.query('INSERT INTO mentoring_feedback(id,contract_id,author_id,kind,body) VALUES($1,$2,$3,$4,$5)',[entryId,id,actor,input.kind,input.body]);
      await db.query('UPDATE mentoring_contracts SET version=version+1,updated_at=now() WHERE id=$1',[id]);return {ok:true};
    }));
  });
  const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
    if(error instanceof z.ZodError)return void res.status(400).json({error:'請確認欄位與同意內容。'});
    if(error instanceof GroupError)return void res.status(error.status).json({error:error.message});
    if(error?.code==='23505')return void res.status(409).json({error:'已有進行中的邀請，請重新載入。'});
    console.error('[mentoring]',error?.code||error?.name);res.status(503).json({error:'暫時無法完成，請保留輸入後重試。'});
  };
  router.use(errors);return router;
}
