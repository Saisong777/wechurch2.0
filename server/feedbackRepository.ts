import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { feedbackCreateInput, feedbackUpdateInput, validateFeedbackAnalysis, type FeedbackClaim, type FeedbackCreate, type FeedbackRecord } from '../shared/feedback';

export class FeedbackError extends Error { constructor(public status:number,message:string) { super(message); } }
const memberColumns=`id,category,title,body,location,urgency,status,priority,public_reply AS "publicReply",version,created_at AS "createdAt",updated_at AS "updatedAt"`;
const adminColumns=`${memberColumns},analysis_status AS "analysisStatus",analysis,analysis_error AS "analysisError",analysis_model AS "analysisModel",analyzed_at AS "analyzedAt"`;
async function transaction<T>(work:(c:PoolClient)=>Promise<T>) {
  const c=await pool.connect();
  try { await c.query('BEGIN'); const result=await work(c); await c.query('COMMIT'); return result; }
  catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
export function feedbackContentHash(input:Pick<FeedbackCreate,'category'|'title'|'body'|'location'|'urgency'>) {
  return createHash('sha256').update(JSON.stringify([input.category,input.title,input.body,input.location,input.urgency])).digest('hex');
}
async function audit(c:PoolClient,id:string,actor:string|null,action:string,before:unknown,after:unknown) {
  await c.query('INSERT INTO member_feedback_events(feedback_id,actor_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5)',[id,actor,action,before?JSON.stringify(before):null,JSON.stringify(after)]);
}
export async function createFeedback(actor:string,raw:unknown) {
  const input=feedbackCreateInput.parse(raw), hash=feedbackContentHash(input);
  return transaction(async c => {
    // Per-account database lock also bounds submissions across app replicas.
    await c.query('SELECT pg_advisory_xact_lock(73624811,hashtext($1))',[actor]);
    const existing=(await c.query(`SELECT ${memberColumns},content_hash AS "contentHash" FROM member_feedback WHERE user_id=$1 AND request_id=$2`,[actor,input.requestId])).rows[0];
    if (existing) {
      if (existing.contentHash!==hash) throw new FeedbackError(409,'這次送出編號已有不同內容，請重新送出。');
      const {contentHash:_hash,...feedback}=existing; return {feedback:feedback as FeedbackRecord,created:false};
    }
    const recent=(await c.query(`SELECT count(*)::int AS count FROM member_feedback WHERE user_id=$1 AND created_at>now()-interval '1 hour'`,[actor])).rows[0].count;
    if (recent>=10) throw new FeedbackError(429,'每小時最多送出 10 則意見，請稍後再試。');
    const feedback=(await c.query<FeedbackRecord>(`INSERT INTO member_feedback(user_id,request_id,category,title,body,location,urgency,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${memberColumns}`,[actor,input.requestId,input.category,input.title,input.body,input.location,input.urgency,hash])).rows[0];
    await audit(c,feedback.id,actor,'created',null,{status:feedback.status,priority:feedback.priority,version:feedback.version});
    return {feedback,created:true};
  });
}
export async function myFeedback(actor:string,limit=50,offset=0) {
  const rows=(await pool.query<FeedbackRecord>(`SELECT ${memberColumns} FROM member_feedback WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,[actor,limit+1,offset])).rows;
  return {items:rows.slice(0,limit),hasMore:rows.length>limit};
}
export async function adminFeedback(filters:{status?:string;category?:string;priority?:string;limit:number;offset:number;sort?:'ai'|'manual'}) {
  const rows=(await pool.query<FeedbackRecord>(`SELECT ${adminColumns} FROM member_feedback WHERE ($1::text IS NULL OR status=$1) AND ($2::text IS NULL OR category=$2) AND ($3::text IS NULL OR priority=$3) ORDER BY CASE WHEN status='done' THEN 1 ELSE 0 END,CASE WHEN $6='ai' THEN CASE WHEN analysis_status='ready' THEN analysis->>'suggestedPriority' ELSE 'ZZ' END ELSE priority END,created_at,id LIMIT $4 OFFSET $5`,[filters.status??null,filters.category??null,filters.priority??null,filters.limit+1,filters.offset,filters.sort??'manual'])).rows;
  return {items:rows.slice(0,filters.limit),hasMore:rows.length>filters.limit};
}
export async function updateFeedback(actor:string,id:string,raw:unknown) {
  const input=feedbackUpdateInput.parse(raw);
  return transaction(async c => {
    const before=(await c.query<FeedbackRecord>(`SELECT ${adminColumns} FROM member_feedback WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if (!before) throw new FeedbackError(404,'找不到這則意見。');
    if (before.version!==input.version) throw new FeedbackError(409,'這則意見已更新，請重新載入。');
    const after=(await c.query<FeedbackRecord>(`UPDATE member_feedback SET status=$2,priority=$3,public_reply=$4,version=version+1,updated_at=now() WHERE id=$1 RETURNING ${adminColumns}`,[id,input.status??before.status,input.priority??before.priority,input.publicReply??before.publicReply])).rows[0];
    await audit(c,id,actor,'updated',before,after); return after;
  });
}
export async function feedbackHistory(id:string) {
  return {items:(await pool.query(`SELECT id,action,before_data AS before,after_data AS after,created_at AS "createdAt" FROM member_feedback_events WHERE feedback_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[id])).rows};
}
export async function exportFeedback(limit=100,offset=0) {
  const rows=(await pool.query(`SELECT ${adminColumns},source_version AS "sourceVersion",content_hash AS "contentHash" FROM member_feedback ORDER BY created_at,id LIMIT $1 OFFSET $2`,[limit+1,offset])).rows;
  return {schemaVersion:1,items:rows.slice(0,limit),hasMore:rows.length>limit};
}
export async function reanalyzeFeedback(actor:string,id:string,version:number) {
  return transaction(async c => {
    const before=(await c.query<FeedbackRecord>(`SELECT ${adminColumns} FROM member_feedback WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if (!before) throw new FeedbackError(404,'找不到這則意見。');
    if (before.version!==version) throw new FeedbackError(409,'這則意見已更新，請重新載入。');
    const after=(await c.query<FeedbackRecord>(`UPDATE member_feedback SET analysis_status='pending',analysis=NULL,analysis_error=NULL,analysis_model=NULL,analyzed_at=NULL,lease_token=NULL,lease_until=NULL,analysis_attempts=0,version=version+1,updated_at=now() WHERE id=$1 RETURNING ${adminColumns}`,[id])).rows[0];
    await audit(c,id,actor,'reanalyze',before,after); return after;
  });
}
export async function claimFeedbackAnalysis(limit=5,leaseSeconds=900):Promise<FeedbackClaim[]> {
  if (!Number.isInteger(limit)||limit<1||limit>5||!Number.isInteger(leaseSeconds)||leaseSeconds<60||leaseSeconds>900) throw new FeedbackError(400,'分析租約參數不正確。');
  return transaction(async c => {
    const rows=(await c.query(`SELECT id,category,title,body,location,urgency,content_hash AS "contentHash",source_version AS "sourceVersion" FROM member_feedback WHERE analysis_attempts<3 AND (analysis_status='pending' OR (analysis_status='running' AND lease_until<now()) OR (analysis_status='failed' AND updated_at<now()-interval '15 minutes')) ORDER BY created_at,id LIMIT $1 FOR UPDATE SKIP LOCKED`,[limit])).rows;
    const claims:FeedbackClaim[]=[];
    for (const row of rows) {
      const token=randomUUID();
      await c.query(`UPDATE member_feedback SET analysis_status='running',lease_token=$2,lease_until=now()+make_interval(secs=>$3),analysis_attempts=analysis_attempts+1,analysis_error=NULL WHERE id=$1`,[row.id,token,leaseSeconds]);
      claims.push({...row,token});
    }
    // Exhausted crashed leases must show a terminal error, not permanent "running".
    await c.query(`UPDATE member_feedback SET analysis_status='failed',analysis_error='分析未能完成，管理員可重新排隊。',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE analysis_status='running' AND lease_until<now() AND analysis_attempts>=3`);
    return claims;
  });
}
async function activeClaim(c:PoolClient,claim:FeedbackClaim) {
  const row=(await c.query(`SELECT category,title,body,location,urgency FROM member_feedback WHERE id=$1 AND analysis_status='running' AND lease_token=$2 AND lease_until>now() AND content_hash=$3 AND source_version=$4 FOR UPDATE`,[claim.id,claim.token,claim.contentHash,claim.sourceVersion])).rows[0];
  if (!row || feedbackContentHash(row)!==claim.contentHash) throw new FeedbackError(409,'分析租約已失效，沒有寫入結果。');
  return row;
}
export async function completeFeedbackAnalysis(claim:FeedbackClaim,result:{analysis:unknown;model:string}) {
  if (!result.model || result.model.length>120 || !/^[A-Za-z0-9_.:/ -]+$/.test(result.model)) throw new FeedbackError(400,'分析模型資訊不正確。');
  return transaction(async c => {
    const source=await activeClaim(c,claim), analysis=validateFeedbackAnalysis(result.analysis,source);
    await c.query(`UPDATE member_feedback SET analysis_status='ready',analysis=$2,analysis_model=$3,analyzed_at=now(),analysis_error=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1`,[claim.id,JSON.stringify(analysis),result.model]);
    // AI never changes status, priority, public reply or the member's words.
    await audit(c,claim.id,null,'analysis_ready',null,{model:result.model,sourceVersion:claim.sourceVersion,contentHash:claim.contentHash});
    return {ok:true};
  });
}
export async function failFeedbackAnalysis(claim:FeedbackClaim) {
  return transaction(async c => {
    await activeClaim(c,claim);
    await c.query(`UPDATE member_feedback SET analysis_status='failed',analysis_error='AI 整理暫時未能完成，可稍後重試。',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1`,[claim.id]);
    await audit(c,claim.id,null,'analysis_failed',null,{sourceVersion:claim.sourceVersion}); return {ok:true};
  });
}
