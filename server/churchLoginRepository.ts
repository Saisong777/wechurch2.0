import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Request } from 'express';
import { pool } from './db';
import { churchContext, ChurchScopeError } from './churchContext';
import { getKnownChurchOptions, getChurchAliases, normalizeChurch } from './churches';
import { GroupError } from './groupError';
import { taipeiToday } from '../shared/churchDevotion';
import type { SessionIdentity } from './authSessionVersion';
import type { ChurchOnboardingStatus, ChurchChoiceResult, ChurchLoginSummary, ChurchLoginInbox, ChurchLoginDayDetail } from '../shared/churchOnboarding';

const UNASSIGNED='__unassigned';
const knownChurch = (value: string | null) => getKnownChurchOptions().some(c => c.id === value) ? value : null;
const compactChurch=(value:string)=>value.trim().toLowerCase().replace(/[\s'’]/g,'');
const quoteSql=(value:string)=>`'${value.replaceAll("'","''")}'`;
// Restrict arrival identity fields to the member's current verified scope too.
const currentScopeSql=`CASE regexp_replace(lower(trim(u.church)), '[[:space:]''’]', '', 'g') ${getKnownChurchOptions().flatMap(c=>getChurchAliases(c.id).map(alias=>`WHEN ${quoteSql(compactChurch(alias))} THEN ${quoteSql(c.id)}`)).join(' ')} ELSE NULL END`;
const conflict = () => new GroupError(409,'資料已更新，請重新載入後再確認。');
async function transaction<T>(work: (c: PoolClient) => Promise<T>, readonly = false) {
  const c=await pool.connect();
  try { await c.query(readonly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN'); const result=await work(c); await c.query('COMMIT'); return result; }
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function lockMember(c: PoolClient, id: string) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext('church-affiliation:' || $1))",[id]);
  const row=(await c.query('SELECT id,church,church_choice_locked,church_login_seen FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!row)throw new GroupError(401,'請重新登入。');return row;
}
export async function enqueueArrival(c: PoolClient, userId: string, church: string | null, reason: string, reopen=false) {
  await c.query(`INSERT INTO church_member_arrivals(user_id,church,reason) VALUES($1,$2,$3)
    ON CONFLICT(user_id,(coalesce(church,''))) ${reopen?"DO UPDATE SET reason=EXCLUDED.reason,status='pending',handled_by=NULL,handled_at=NULL,version=church_member_arrivals.version+1,updated_at=now()":"DO NOTHING"}`,[userId,church,reason]);
}
export async function arrivalChurchChanged(c: PoolClient, actor: string, userId: string, church: string | null, reason='church_changed') {
  await c.query(`UPDATE church_member_arrivals SET status='handled',handled_by=$2,handled_at=now(),version=version+1,updated_at=now()
    WHERE user_id=$1 AND status='pending' AND church IS DISTINCT FROM $3`,[userId,actor,church]);
  await enqueueArrival(c,userId,church,church?'initial_choice'===reason?'initial_choice':'church_changed':'needs_affiliation',true);
}
async function addDaily(c: PoolClient, userId: string, church: string, at: string|Date) {
  await c.query(`INSERT INTO church_login_daily(church,user_id,day,first_login_at,last_login_at)
    VALUES($1,$2,($3::timestamptz AT TIME ZONE 'Asia/Taipei')::date,$3,$3)
    ON CONFLICT(church,user_id,day) DO UPDATE SET first_login_at=LEAST(church_login_daily.first_login_at,EXCLUDED.first_login_at),
      last_login_at=GREATEST(church_login_daily.last_login_at,EXCLUDED.last_login_at),login_count=church_login_daily.login_count+1`,[church,userId,at]);
}
export function prepareLoginReceipt<T extends SessionIdentity>(identity: T): T & {loginReceiptId:string} {
  return {...identity,loginReceiptId:randomUUID(),loginReceiptAt:new Date().toISOString()};
}
// Called only after session.save has succeeded. The same durable session receipt
// is replayed by authenticated requests if the callback's DB write was interrupted.
export async function recordPersistedLogin(req: Request) {
  const saved=(req.session as typeof req.session & {passport?:{user?:SessionIdentity}})?.passport?.user;
  if ((req.user as SessionIdentity | undefined)?.loginReceiptId && !saved?.loginReceiptId) throw new GroupError(503,'登入狀態尚未完整保存。');
  await recordSuccessfulLogin(saved);
}
export async function recordSuccessfulLogin(identity: SessionIdentity | undefined) {
  if(!identity?.loginReceiptId)return; // Existing pre-migration sessions are not new logins.
  if(typeof identity.loginReceiptId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identity.loginReceiptId)||!identity.sessionUserId)throw new GroupError(503,'無法完整記錄登入，請重試。');
  const at=new Date(String(identity.loginReceiptAt));
  if(!Number.isFinite(at.getTime())||at.getTime()<Date.UTC(2000,0,1)||at.getTime()>Date.now()+60_000)throw new GroupError(503,'登入時間不完整，請重新登入。');
  await transaction(async c=>{
    const previous=(await c.query('SELECT user_id FROM church_login_receipts WHERE receipt_id=$1',[identity.loginReceiptId])).rows[0];
    if(previous){if(previous.user_id!==identity.sessionUserId)throw new GroupError(503,'登入記錄不一致。');return;}
    const user=await lockMember(c,identity.sessionUserId!);
    const church=knownChurch(normalizeChurch(user.church));
    const receipt=(await c.query('INSERT INTO church_login_receipts(receipt_id,user_id,church,created_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING created_at',[identity.loginReceiptId,identity.sessionUserId,church,at])).rows[0];
    if(!receipt)return;
    await addDaily(c,user.id,church||UNASSIGNED,receipt.created_at);
    if(!user.church_login_seen||!church)await enqueueArrival(c,user.id,church,church?'first_login':'needs_affiliation');
    await c.query('UPDATE users SET church_login_seen=true WHERE id=$1',[user.id]);
  });
}
export async function onboardingStatus(id: string): Promise<ChurchOnboardingStatus> {
  const user=(await pool.query(`SELECT church,church_choice_locked,EXISTS(SELECT 1 FROM church_affiliation_events e WHERE e.user_id=users.id
    AND (e.previous_church IS NOT NULL OR e.next_church IS NOT NULL)) AS history FROM users WHERE id=$1`,[id])).rows[0];
  if(!user)throw new GroupError(401,'請重新登入。');
  const currentChurch=normalizeChurch(user.church), valid=knownChurch(currentChurch);
  const choiceLocked=!!user.church_choice_locked||user.church!==null||!!user.history;
  return {currentChurch,canChoose:!choiceLocked,choiceLocked,choices:getKnownChurchOptions(),reason:valid?'assigned':choiceLocked?'manager_required':'choose'};
}
export async function chooseInitialChurch(id: string, churchId: string, requestId: string, _receiptId?: string): Promise<ChurchChoiceResult> {
  const church=knownChurch(normalizeChurch(churchId));if(!church)throw new GroupError(400,'請選擇有效教會。');
  return transaction(async c=>{
    const user=await lockMember(c,id);
    const previous=(await c.query("SELECT next_church FROM church_affiliation_events WHERE user_id=$1 AND request_id=$2 AND source='initial_choice'",[id,requestId])).rows[0];
    if(previous){if(previous.next_church!==church)throw conflict();return {ok:true,currentChurch:normalizeChurch(user.church),initialChoiceChurch:church,replayed:true,choiceLocked:true};}
    if(user.church_choice_locked||user.church!==null||(await c.query('SELECT 1 FROM church_affiliation_events WHERE user_id=$1 AND (previous_church IS NOT NULL OR next_church IS NOT NULL) LIMIT 1',[id])).rowCount)throw new GroupError(403,'教會已選定，後續請由管理者調整。');
    await c.query('UPDATE users SET church=$2,church_choice_locked=true,updated_at=now() WHERE id=$1',[id,church]);
    await c.query("INSERT INTO church_affiliation_events(actor_id,user_id,previous_church,next_church,source,request_id) VALUES($1,$1,NULL,$2,'initial_choice',$3)",[id,church,requestId]);
    await arrivalChurchChanged(c,id,id,church,'initial_choice');
    return {ok:true,currentChurch:church,initialChoiceChurch:church,replayed:false,choiceLocked:true};
  });
}
type Staff={id:string;admin:boolean;canManage:boolean;church:string|null};
async function staff(c: PoolClient,id:string,lock=false):Promise<Staff> {
  const context=churchContext();if(!context||context.actorId!==id)throw new ChurchScopeError(403,'CHURCH_SCOPE_FORBIDDEN','無法確認教會範圍。');
  if(lock){
    await c.query('SELECT id FROM users WHERE id=$1 FOR SHARE',[id]);
    await c.query('SELECT id FROM user_roles WHERE user_id=$1 FOR SHARE',[id]);
  }
  const row=(await c.query(`SELECT u.church,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND role='admin') AS admin,
    EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND role IN ('senior_pastor','pastor','minister')) AS pastoral
    FROM users u WHERE u.id=$1 ${lock?'FOR SHARE OF u':''}`,[id])).rows[0];
  if(!row)throw new GroupError(401,'請重新登入。');
  const own=knownChurch(normalizeChurch(row.church));
  if(own!==context.actorChurch||row.admin!==context.isSystemAdmin)throw new ChurchScopeError(409,'CHURCH_CONTEXT_CHANGED','教會或權限已更新，請重新載入。');
  if(!row.admin&&context.selectedChurch!==own)throw new GroupError(403,'只能查看所屬教會。');
  return {id,admin:!!row.admin,canManage:!!row.admin||!!row.pastoral&&!!own,church:row.admin?context.selectedChurch:own};
}
const arrivalScope = (a:Staff,scope:'church'|'unassigned')=>{
  if(!a.canManage||scope==='unassigned'&&!a.admin||scope==='church'&&!a.church)throw new GroupError(403,'沒有此教會管理權限。');
  return scope==='unassigned'?null:a.church;
};
async function summary(c:PoolClient,a:Staff):Promise<ChurchLoginSummary>{
  const empty={canManage:a.canManage,scopeChurch:a.church,unhandledArrivals:0,unassignedArrivals:0,unassignedUnreadDigestDays:0,unreadDigestDays:0,total:0};if(!a.canManage)return empty;
  const rows=(await c.query(`SELECT count(*) FILTER(WHERE r.church=$1)::int AS own,count(*) FILTER(WHERE r.church IS NULL)::int AS unassigned FROM church_member_arrivals r JOIN users u ON u.id=r.user_id WHERE r.status='pending' AND r.church IS NOT DISTINCT FROM (${currentScopeSql})`,[a.church])).rows[0];
  const unread=a.church?Number((await c.query(`SELECT count(DISTINCT d.day)::int AS count FROM church_login_daily d WHERE d.church=$1 AND d.day<$3::date
    AND NOT EXISTS(SELECT 1 FROM church_login_digest_reads r WHERE r.user_id=$2 AND r.church=d.church AND r.day=d.day)`,[a.church,a.id,taipeiToday()])).rows[0].count):0;
  const unassignedUnread=a.admin?Number((await c.query(`SELECT count(DISTINCT d.day)::int AS count FROM church_login_daily d WHERE d.church=$1 AND d.day<$3::date AND NOT EXISTS(SELECT 1 FROM church_login_digest_reads r WHERE r.user_id=$2 AND r.church=d.church AND r.day=d.day)`,[UNASSIGNED,a.id,taipeiToday()])).rows[0].count):0;
  const result={...empty,unassignedUnreadDigestDays:unassignedUnread,unhandledArrivals:rows.own,unassignedArrivals:a.admin?rows.unassigned:0,unreadDigestDays:unread};return {...result,total:result.unhandledArrivals+result.unassignedArrivals+unread+unassignedUnread};
}
export async function loginSummary(id:string){return transaction(async c=>summary(c,await staff(c,id)),true);}
export async function loginInbox(id:string,scope:'church'|'unassigned'|undefined,cursor:{at:string;id:string}|undefined,limit:number):Promise<ChurchLoginInbox>{
  return transaction(async c=>{
    const a=await staff(c,id),mode=scope||(!a.church&&a.admin?'unassigned':'church'),church=arrivalScope(a,mode),today=taipeiToday();
    const rows=(await c.query(`SELECT r.id,r.user_id AS "userId",coalesce(NULLIF(u.display_name,''),'會員') AS name,NULLIF(u.email,'') AS email,u.church AS "currentChurch",r.church,r.reason,r.status,r.version,
      r.created_at AS "createdAt",r.updated_at AS "updatedAt",to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorAt"
      FROM church_member_arrivals r JOIN users u ON u.id=r.user_id WHERE r.status='pending' AND r.church IS NOT DISTINCT FROM $1 AND r.church IS NOT DISTINCT FROM (${currentScopeSql})
      AND ($2::timestamptz IS NULL OR (r.created_at,r.id)<($2::timestamptz,$3::uuid)) ORDER BY r.created_at DESC,r.id DESC LIMIT $4`,[church,cursor?.at?cursor.at.replace(/Z$/,'+00:00'):null,cursor?.id||null,limit+1])).rows;
    const days=(await c.query(`SELECT d.day::text,count(*)::int AS "uniqueMembers",sum(d.login_count)::int AS "loginCount",min(d.first_login_at) AS "firstLoginAt",max(d.last_login_at) AS "lastLoginAt",
      EXISTS(SELECT 1 FROM church_login_digest_reads r WHERE r.user_id=$2 AND r.church=d.church AND r.day=d.day) AS read,d.day=$3::date AS "inProgress"
      FROM church_login_daily d WHERE d.church=$1 AND (d.day>=$3::date-60 OR NOT EXISTS(SELECT 1 FROM church_login_digest_reads r WHERE r.user_id=$2 AND r.church=d.church AND r.day=d.day))
      GROUP BY d.church,d.day ORDER BY d.day DESC`,[church||UNASSIGNED,id,today])).rows;
    const last=rows[limit-1];return {canManage:true,scopeChurch:church,scope:mode,arrivals:rows.slice(0,limit).map(({cursorAt:_cursor,...r})=>({...r,currentChurch:normalizeChurch(r.currentChurch)})),nextCursor:rows.length>limit?`${last.cursorAt}_${last.id}`:null,days,today,counts:await summary(c,a)};
  },true);
}
export async function handleArrival(id:string,arrivalId:string,version:number){
  return transaction(async c=>{
    const a=await staff(c,id,true),reference=(await c.query('SELECT user_id FROM church_member_arrivals WHERE id=$1',[arrivalId])).rows[0];
    if(!reference)throw new GroupError(403,'沒有此項目的管理權限。');
    const current=(await c.query('SELECT church FROM users WHERE id=$1 FOR SHARE',[reference.user_id])).rows[0];
    const r=(await c.query('SELECT * FROM church_member_arrivals WHERE id=$1 FOR UPDATE',[arrivalId])).rows[0];
    if(!r||!a.canManage||r.church===null&&!a.admin||r.church!==null&&r.church!==a.church)throw new GroupError(403,'沒有此項目的管理權限。');
    if(!current||knownChurch(normalizeChurch(current.church))!==r.church)throw conflict();
    if(r.version!==version||r.status!=='pending')throw conflict();
    await c.query("UPDATE church_member_arrivals SET status='handled',handled_by=$2,handled_at=now(),version=version+1,updated_at=now() WHERE id=$1",[arrivalId,id]);return {ok:true};
  });
}
export async function readLoginDay(id:string,day:string,scope:'church'|'unassigned'='church'){return transaction(async c=>{
  const a=await staff(c,id,true),church=arrivalScope(a,scope)||UNASSIGNED;if(day>=taipeiToday()||!(await c.query('SELECT 1 FROM church_login_daily WHERE church=$1 AND day=$2::date LIMIT 1',[church,day])).rowCount)throw new GroupError(400,'只能標示已結束且有登入紀錄的日期。');
  await c.query('INSERT INTO church_login_digest_reads(user_id,church,day) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,church,day]);return {ok:true};
});}
export async function loginDayMembers(id:string,day:string,cursor:string|undefined,limit:number,scope:'church'|'unassigned'='church'):Promise<ChurchLoginDayDetail>{return transaction(async c=>{
  const a=await staff(c,id),church=arrivalScope(a,scope)||UNASSIGNED;if(day>taipeiToday())throw new GroupError(400,'日期尚未發生。');
  const rows=(await c.query(`SELECT d.user_id AS cursor,u.church AS "currentChurch",u.id AS "userId",coalesce(NULLIF(u.display_name,''),'會員') AS name,d.login_count AS "loginCount",d.first_login_at AS "firstLoginAt",d.last_login_at AS "lastLoginAt"
    FROM church_login_daily d JOIN users u ON u.id=d.user_id WHERE d.church=$1 AND d.day=$2::date AND ($3::uuid IS NULL OR d.user_id>$3::uuid) ORDER BY d.user_id LIMIT $4`,[church,day,cursor||null,limit+1])).rows;
  return {day,scope,scopeChurch:church===UNASSIGNED?null:church,inProgress:day===taipeiToday(),nextCursor:rows.length>limit?rows[limit-1].cursor:null,members:rows.slice(0,limit).map(({cursor:_cursor,currentChurch,...r})=>(knownChurch(normalizeChurch(currentChurch))||UNASSIGNED)===church?{...r,affiliationChanged:false}:{...r,userId:null,name:'已轉出或變更歸屬的會員',affiliationChanged:true})};
},true);}
