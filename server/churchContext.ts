import type { PoolClient } from 'pg';
import { sql, type SQL } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, RequestHandler } from 'express';
import { pool } from './db';
import { GroupError } from './groupError';
import { getKnownChurchOptions, normalizeChurch } from '../shared/churches';

export interface ChurchContext { actorId:string; actorChurch:string|null; selectedChurch:string|null; isSystemAdmin:boolean; }
export class ChurchScopeError extends GroupError { constructor(status:number,public code:string,message:string){super(status,message);} }
const requestChurch = new AsyncLocalStorage<ChurchContext>();
export const churchContext = () => requestChurch.getStore();
export const runChurchContext = <T>(context:ChurchContext,work:()=>T):T => requestChurch.run(context,work);
export function selectedChurch():string {
  const church=churchContext()?.selectedChurch;
  if(!church)throw new ChurchScopeError(403,'CHURCH_APPROVAL_REQUIRED','請等待管理者核定所屬教會，再使用教會功能。');
  return church;
}
export function assertSelectedChurch(church:string|null|undefined) {
  if(normalizeChurch(church)!==selectedChurch())throw new ChurchScopeError(404,'CHURCH_RESOURCE_NOT_FOUND','找不到所選教會的內容。');
}
export function churchContextResponse(context:ChurchContext) {
  return {actorChurch:context.actorChurch,selectedChurch:context.selectedChurch,isSystemAdmin:context.isSystemAdmin,
    allowedOptions:getKnownChurchOptions().filter(c=>context.isSystemAdmin||c.id===context.actorChurch),requiresApproval:!context.actorChurch&&!context.isSystemAdmin};
}
export function resolveChurchContext(actorId:string,actorChurch:string|null,isSystemAdmin:boolean,header?:string,query?:unknown):ChurchContext {
  const options=getKnownChurchOptions();
  const own=normalizeChurch(actorChurch);
  const verified=options.some(c=>c.id===own)?own:null;
  if(query!==undefined&&typeof query!=='string')throw new ChurchScopeError(400,'INVALID_CHURCH_SCOPE','教會範圍格式不正確。');
  let wireHeader:string|undefined;
  try { wireHeader=header===undefined?undefined:decodeURIComponent(header); } catch { throw new ChurchScopeError(400,'INVALID_CHURCH_SCOPE','教會範圍編碼不正確。'); }
  const h=normalizeChurch(wireHeader),q=normalizeChurch(query as string|undefined);
  if(h&&q&&h!==q)throw new ChurchScopeError(400,'CHURCH_SCOPE_CONFLICT','教會範圍不一致，請重新選擇。');
  const requested=h||q;
  if(requested&&!options.some(c=>c.id===requested))throw new ChurchScopeError(400,'INVALID_CHURCH_SCOPE','請選擇有效的教會。');
  if(!isSystemAdmin&&requested&&requested!==verified)throw new ChurchScopeError(403,'CHURCH_SCOPE_FORBIDDEN','只能使用管理者核定的所屬教會。');
  return {actorId,actorChurch:verified,selectedChurch:isSystemAdmin?(requested||verified):verified,isSystemAdmin};
}
// These roots contain church content. Owner-only profile/notes/prayers/reading-progress are not gated here.
export const churchFeaturePrefixes=['/devotion-wall','/prayers','/church-reading','/admin/church-devotions','/life-groups','/families','/crm','/access-control','/care-visits','/feedback','/admin/feedback','/notifications','/reading-plans','/churches','/potential-members','/user-roles','/message-cards','/message-card-downloads','/card-questions','/icebreaker/cards'];
export function churchContextMiddleware(resolveId:(req:Request)=>Promise<string|null>):RequestHandler {
  return async(req,res,next)=>{
    try {
      const actor=await resolveId(req);
      const ownerWithdrawal=req.method==='DELETE'&&(/^\/devotion-wall\/[0-9a-f-]+$/.test(req.path)||/^\/life-groups\/[0-9a-f-]+\/shares\/[0-9a-f-]+$/.test(req.path));
      const guestCurrentCard=req.method==='GET'&&/^\/icebreaker\/cards\/[0-9a-f-]+$/.test(req.path)&&typeof req.query.gameId==='string';
      const messageInvite=req.method==='GET'&&(/^\/message-cards\/image\/[a-zA-Z0-9._-]+$/.test(req.path)||(/^\/message-cards\/[^/]+$/.test(req.path)&&!['all','upload'].includes(req.path.split('/').at(-1)!)));
      const invitedIntake=req.method==='POST'&&req.path==='/potential-members'&&typeof req.body?.shortCode==='string';
      const gated=!invitedIntake&&!messageInvite&&!guestCurrentCard&&!ownerWithdrawal&&(churchFeaturePrefixes.some(p=>req.path===p||req.path.startsWith(`${p}/`))||req.path==='/users'||req.path==='/sessions'||(req.method==='POST'&&req.path==='/icebreaker/games'));
      if(!actor){if(gated||req.path==='/church-context')return void res.status(401).json({error:'請先登入。'});return next();}
      const row=(await pool.query("SELECT u.church,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin') AS admin FROM users u WHERE u.id=$1",[actor])).rows[0];
      if(!row)return void res.status(401).json({error:'請重新登入。'});
      const context=resolveChurchContext(actor,row.church,row.admin,req.get('X-WeChurch-Church'),req.query.church);
      res.setHeader('Cache-Control','private, no-store');
      if(gated&&!context.selectedChurch)throw new ChurchScopeError(403,'CHURCH_APPROVAL_REQUIRED','請等待管理者核定所屬教會，再使用教會功能。');
      requestChurch.run(context,next);
    }catch(e){if(e instanceof ChurchScopeError)return void res.status(e.status).json({error:e.message,code:e.code});next(e);}
  };
}

// A finite catalog maps to server-owned SQL constants, never request/body interpolation.
export function churchPredicate(alias:string=''):string {
  const constants:Record<string,string>={'IM 行動教會':"'IM 行動教會'",'桃園WeChurch':"'桃園WeChurch'",'火樂':"'火樂'"};
  const church=selectedChurch();const literal=constants[church];
  if(!literal)throw new ChurchScopeError(400,'INVALID_CHURCH_SCOPE','教會範圍不正確。');
  if(alias&&!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias))throw new Error('Invalid repository alias');
  return `${alias?alias+'.':''}church=${literal}`;
}
export async function lockChurchContext(c: {query:(text:string,values:unknown[])=>Promise<{rows:unknown[]}>}) {
  const context=churchContext();
  if(!context)return; // Non-HTTP internal queue jobs have their own fixed lease/ownership guard.
  const row=(await c.query("SELECT u.church,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin') AS admin FROM users u WHERE u.id=$1 FOR SHARE OF u",[context.actorId])).rows[0] as {church:string|null;admin:boolean}|undefined;
  if(!row||normalizeChurch(row.church)!==context.actorChurch||row.admin!==context.isSystemAdmin)throw new ChurchScopeError(409,'CHURCH_CONTEXT_CHANGED','所屬教會或權限已變更，請重新載入。');
}

// Drizzle writes use the same actor-row CAS and lock ordering as pg repositories.
export async function lockDrizzleChurchContext(tx:{execute:(query:SQL)=>Promise<{rows:unknown[]}>}) {
  const context=churchContext();
  if(!context)throw new ChurchScopeError(403,'CHURCH_APPROVAL_REQUIRED','缺少已核對的教會身份。');
  await lockChurchContext({query:async()=>tx.execute(sql`SELECT u.church,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin') AS admin FROM users u WHERE u.id=${context.actorId} FOR SHARE OF u`)});
}

export async function churchWrite<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
  selectedChurch();
  const client=await pool.connect();
  try{await client.query('BEGIN');await lockChurchContext(client);const result=await work(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
