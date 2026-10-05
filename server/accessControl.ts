import { Router, type Request, type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from './db';
import { normalizeChurch, getChurchAliases } from './churches';
import { GroupError } from './groupError';
import { grantInput, roleTemplateInput, rolePresets, globalPermissions, type AccessGrant, type Permission } from '../shared/accessControl';

const projection = `g.id,g.user_id AS "userId",g.role_id AS "roleId",r.name AS "roleName",g.church,g.scope,
 g.group_id AS "groupId",g.member_id AS "memberId",g.permissions,g.expires_at AS "expiresAt",g.active,g.version,g.reason,
 coalesce(s.name,m.display_name,g.church) AS "scopeName"`;
const joins = 'access_grants g JOIN access_roles r ON r.id=g.role_id LEFT JOIN small_groups s ON s.id=g.group_id LEFT JOIN users m ON m.id=g.member_id';

// No cache: revocation, expiry and church moves are enforced on the next request.
export async function activeGrants(userId: string): Promise<AccessGrant[]> {
  const own = (await pool.query('SELECT church FROM users WHERE id=$1', [userId])).rows[0];
  const church = normalizeChurch(own?.church);
  if (!church) return [];
  return (await pool.query(`SELECT ${projection} FROM ${joins}
    WHERE g.user_id=$1 AND g.active AND (g.expires_at IS NULL OR g.expires_at>now()) AND g.church=ANY($2::text[])
      AND (g.scope<>'group' OR (s.is_active AND s.church=ANY($2::text[])))
      AND (g.scope<>'member' OR m.church=ANY($2::text[]))`, [userId, getChurchAliases(church)])).rows;
}
export async function hasPermission(userId: string, permission: Permission, scope?: 'site' | 'church') {
  return (await activeGrants(userId)).some(g => (!scope || g.scope === scope) && g.permissions.includes(permission));
}
export async function memberRoleNames(ids:string[]) {
  if(!ids.length)return new Map<string,string[]>();
  const rows=(await pool.query(`SELECT g.user_id,g.church,u.church AS user_church,r.name,g.scope,s.church AS group_church,s.is_active AS group_active,m.church AS member_church FROM access_grants g
    JOIN access_roles r ON r.id=g.role_id JOIN users u ON u.id=g.user_id
    LEFT JOIN small_groups s ON s.id=g.group_id LEFT JOIN users m ON m.id=g.member_id
    WHERE g.user_id=ANY($1::uuid[]) AND g.active AND (g.expires_at IS NULL OR g.expires_at>now())`,[ids])).rows;
  const result=new Map<string,string[]>();
  for(const row of rows){if(normalizeChurch(row.church)!==normalizeChurch(row.user_church))continue;
    if(row.scope==='group'&&(!row.group_active||normalizeChurch(row.group_church)!==normalizeChurch(row.church)))continue;
    if(row.scope==='member'&&normalizeChurch(row.member_church)!==normalizeChurch(row.church))continue;
    result.set(row.user_id,[...new Set([...(result.get(row.user_id)||[]),row.name])]);}
  return result;
}
export async function accessActor(id: string, c: Pick<PoolClient, 'query'> = pool) {
  const row = (await c.query('SELECT u.id,u.church,coalesce(r.role,\'member\') AS role FROM users u LEFT JOIN user_roles r ON r.user_id=u.id WHERE u.id=$1', [id])).rows[0];
  if (!row) throw new GroupError(401, '請先登入。');
  return { id, church: normalizeChurch(row.church), role: String(row.role) };
}
async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
async function director(id: string, church: string, c: Pick<PoolClient, 'query'> = pool) {
  const a = await accessActor(id, c);
  if (a.role !== 'admin' && !(a.role === 'senior_pastor' && a.church === normalizeChurch(church))) throw new GroupError(403, '只有管理員或所屬教會主任牧師可以授權。');
  return a;
}
async function audit(c: PoolClient, actor: string, church: string, target: string, action: string, before: unknown, after: unknown) {
  await c.query('INSERT INTO access_audit(church,actor_id,target_id,action,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6)', [church, actor, target, action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);
}

export async function myAccess(id: string) {
  const a = await accessActor(id), grants = await activeGrants(id);
  const permissions = [...new Set(grants.flatMap(g => g.permissions))];
  const legacyLeader = ['admin','senior_pastor','pastor','minister','group_leader','leader','future_leader'].includes(a.role);
  return { grants, permissions, canManageAccess: ['admin','senior_pastor'].includes(a.role),
    canEnterCrm: legacyLeader || permissions.some(p => ['members.read','members.manage','groups.manage','care.manage'].includes(p)),
    canEnterAdmin: legacyLeader || permissions.length > 0 };
}

export async function changeAccountRole(actor: string, targetId: string, role: string) {
  z.string().uuid().parse(targetId);
  z.enum(['admin','senior_pastor','pastor','minister','leader','group_leader','future_leader','member']).parse(role);
  return transaction(async c => {
    // Serialize all account-role changes, including legacy CRM entry points.
    await c.query("SELECT pg_advisory_xact_lock(hashtext('access-account-roles'))");
    const target=await accessActor(targetId,c), a=await director(actor,target.church || '',c);
    // Legacy data can contain multiple role rows; protect every role the update would replace.
    const protectedRoles=(await c.query("SELECT role FROM user_roles WHERE user_id=$1 AND role IN ('admin','senior_pastor')",[targetId])).rows.map(r=>String(r.role));
    if(a.role!=='admin' && ([role,...protectedRoles].some(r=>['admin','senior_pastor'].includes(r))))throw new GroupError(403,'管理者職分限系統管理員調整。');
    if(protectedRoles.includes('admin') && role!=='admin' && Number((await c.query("SELECT count(DISTINCT user_id) FROM user_roles WHERE role='admin'")).rows[0].count)<=1)throw new GroupError(409,'不可移除最後一位系統管理員。');
    const updated=await c.query('UPDATE user_roles SET role=$2,updated_at=now() WHERE user_id=$1',[targetId,role]);
    if(!updated.rowCount)await c.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[targetId,role]);
    await audit(c,actor,target.church || '',targetId,'變更既有帳號角色',{role:target.role},{role});
    return {ok:true};
  });
}

export function accessControlRoutes(resolveId: (req: Request) => Promise<string | null>) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const id = await resolveId(req);
    if (!id) return void res.status(401).json({ error: '請先登入。' });
    if (!['GET','HEAD'].includes(req.method)) {
      let invalid = req.get('sec-fetch-site') === 'cross-site';
      if (req.get('origin')) { try { invalid ||= new URL(req.get('origin')!).host !== req.get('host'); } catch { invalid = true; } }
      if (invalid) return void res.status(403).json({ error: '不接受跨網站寫入。' });
    }
    res.locals.actor = id; next();
  });
  router.get('/me', async (_req, res) => res.json(await myAccess(res.locals.actor)));
  router.put('/account-role/:id',async(req,res)=>{
    const input=z.object({role:z.string()}).strict().parse(req.body);
    res.json(await changeAccountRole(res.locals.actor,req.params.id,input.role));
  });
  router.get('/', async (req, res) => {
    const a = await accessActor(res.locals.actor);
    const church = normalizeChurch(z.string().max(120).optional().parse(req.query.church) || a.church);
    if (!church) throw new GroupError(400, '請先指定教會。');
    await director(a.id, church);
    const aliases = getChurchAliases(church);
    const users = (await pool.query(`SELECT u.id,coalesce(u.display_name,u.email) AS name,u.email,coalesce(r.role,'member') AS role
      FROM users u LEFT JOIN user_roles r ON r.user_id=u.id WHERE u.church=ANY($1::text[]) ORDER BY name,u.id`, [aliases])).rows;
    const roles = (await pool.query('SELECT id,name,permissions,version,true AS editable FROM access_roles WHERE church=$1 ORDER BY created_at,id', [church])).rows;
    const groups = (await pool.query('SELECT id,name FROM small_groups WHERE church=ANY($1::text[]) AND is_active ORDER BY name,id', [aliases])).rows;
    const grants = (await pool.query(`SELECT ${projection} FROM ${joins} WHERE g.church=$1 ORDER BY g.created_at DESC LIMIT 2000`, [church])).rows;
    const history = (await pool.query(`SELECT a.id,a.action,a.target_id AS "targetId",a.created_at AS "createdAt",u.display_name AS "actorName",a.before_value AS before,a.after_value AS after
      FROM access_audit a JOIN users u ON u.id=a.actor_id WHERE a.church=$1 ORDER BY a.created_at DESC,a.id LIMIT 100`, [church])).rows;
    const legacyScopes = (await pool.query(`SELECT a.id,a.assignee_user_id AS "userId",a.scope_type AS scope,a.can_view_personal AS "canViewPersonal",
      a.can_manage_care AS "canManageCare",a.can_manage_members AS "canManageMembers",a.ends_at AS "expiresAt",coalesce(s.name,m.display_name,a.church,'指定成員') AS "scopeName"
      FROM crm_scope_assignments a JOIN users u ON u.id=a.assignee_user_id LEFT JOIN small_groups s ON s.id=a.group_id LEFT JOIN users m ON m.id=a.member_user_id
      LEFT JOIN potential_members p ON p.id=a.potential_member_id
      WHERE a.is_active AND a.starts_at<=now() AND (a.ends_at IS NULL OR a.ends_at>now())
        AND u.church=ANY($1::text[]) AND (a.church=ANY($1::text[]) OR s.church=ANY($1::text[]) OR m.church=ANY($1::text[]) OR p.church=ANY($1::text[]))`, [aliases])).rows;
    const appointments = (await pool.query(`SELECT id,name,leader_user_id AS "leaderId",co_leader_user_id AS "coLeaderId",pastor_user_id AS "pastorId" FROM small_groups WHERE is_active AND church=ANY($1::text[])`, [aliases])).rows;
    res.json({ church, isSystemAdmin: a.role === 'admin', users, roles, groups, grants, history, legacyScopes, appointments });
  });
  router.post('/presets', async (req, res) => {
    const { church: raw } = z.object({ church: z.string().min(1).max(120) }).strict().parse(req.body);
    const church = normalizeChurch(raw)!;
    await transaction(async c => {
      await director(res.locals.actor, church, c);
      for (const name of rolePresets) await c.query('INSERT INTO access_roles(church,name) VALUES($1,$2) ON CONFLICT(church,name) DO NOTHING', [church,name]);
      await audit(c, res.locals.actor, church, res.locals.actor, '建立職分範本', null, { names: rolePresets });
    });
    res.json({ ok: true });
  });
  router.post('/roles', async (req, res) => {
    const { church: raw, ...rest } = z.object({ church: z.string().min(1).max(120) }).passthrough().parse(req.body);
    const input = roleTemplateInput.parse(rest), church = normalizeChurch(raw)!;
    const role = await transaction(async c => {
      const a = await director(res.locals.actor, church, c);
      if (a.role !== 'admin' && input.permissions.some(p => globalPermissions.includes(p))) throw new GroupError(403, '全站功能只能由系統管理員授權。');
      const row = (await c.query('INSERT INTO access_roles(church,name,permissions) VALUES($1,$2,$3) RETURNING id', [church,input.name,JSON.stringify(input.permissions)])).rows[0];
      await audit(c, a.id, church, row.id, '新增職分', null, input); return row;
    });
    res.status(201).json(role);
  });
  router.put('/roles/:id', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id), input = roleTemplateInput.parse(req.body);
    await transaction(async c => {
      const old = (await c.query('SELECT * FROM access_roles WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if (!old) throw new GroupError(404,'找不到職分。');
      const a = await director(res.locals.actor, old.church, c);
      if (a.role !== 'admin' && [...old.permissions,...input.permissions].some(p => globalPermissions.includes(p))) throw new GroupError(403,'全站功能只能由系統管理員授權。');
      if (old.version !== input.version) throw new GroupError(409,'職分已更新，請重新載入。');
      await c.query('UPDATE access_roles SET name=$2,permissions=$3,version=version+1 WHERE id=$1', [id,input.name,JSON.stringify(input.permissions)]);
      await audit(c,a.id,old.church,id,'修改職分範本',old,input);
    });
    res.json({ ok:true });
  });
  const saveGrant = async (req: Request, actor: string, id?: string) => {
    const input = grantInput.parse(req.body), church = normalizeChurch(input.church)!;
    if (input.expiresAt && Date.parse(input.expiresAt) <= Date.now()) throw new GroupError(400,'到期時間必須在未來。');
    return transaction(async c => {
      const a = await director(actor, church, c);
      if (input.scope === 'site' && a.role !== 'admin') throw new GroupError(403,'全站功能只能由系統管理員授權。');
      const createId=input.requestId || randomUUID();
      if(!id){
        await c.query("SELECT pg_advisory_xact_lock(hashtext('access-grant:' || $1))",[createId]);
        const previous=(await c.query('SELECT * FROM access_grants WHERE id=$1',[createId])).rows[0];
        if(previous){
          const same=previous.active && previous.version===1 && previous.user_id===input.userId && previous.role_id===input.roleId && previous.church===church
            && previous.scope===input.scope && previous.group_id===input.groupId && previous.member_id===input.memberId && previous.reason===input.reason
            && (previous.expires_at?new Date(previous.expires_at).toISOString():null)===input.expiresAt
            && JSON.stringify([...previous.permissions].sort())===JSON.stringify([...input.permissions].sort());
          if(!same)throw new GroupError(409,'這筆授權已建立或異動，請重新載入後確認。');
          return {id:createId};
        }
      }
      const target = await accessActor(input.userId,c);
      if (target.church !== church) throw new GroupError(403,'成員必須屬於指定教會。');
      if (!(await c.query('SELECT id FROM access_roles WHERE id=$1 AND church=$2 FOR SHARE',[input.roleId,church])).rowCount) throw new GroupError(403,'職分不屬於此教會。');
      if (input.groupId && !(await c.query('SELECT id FROM small_groups WHERE id=$1 AND church=ANY($2) AND is_active FOR SHARE',[input.groupId,getChurchAliases(church)])).rowCount) throw new GroupError(403,'小家不在此教會。');
      if (input.memberId && (await accessActor(input.memberId,c)).church !== church) throw new GroupError(403,'指定會員不在此教會。');
      const old = id ? (await c.query('SELECT * FROM access_grants WHERE id=$1 FOR UPDATE',[id])).rows[0] : null;
      if (id && (!old || old.church !== church || old.user_id !== input.userId || old.role_id !== input.roleId)) throw new GroupError(404,'找不到相同成員的授權。');
      if (id && (!old.active || old.version !== input.version)) throw new GroupError(409,'授權已更新或撤回，請重新載入。');
      if (old?.scope === 'site' && a.role !== 'admin') throw new GroupError(403,'全站授權限系統管理員調整。');
      const values = [input.userId,input.roleId,church,input.scope,input.groupId,input.memberId,JSON.stringify(input.permissions),input.expiresAt,input.reason];
      const row = id
        ? (await c.query('UPDATE access_grants SET user_id=$1,role_id=$2,church=$3,scope=$4,group_id=$5,member_id=$6,permissions=$7,expires_at=$8,reason=$9,version=version+1,updated_at=now() WHERE id=$10 RETURNING id',[...values,id])).rows[0]
        : (await c.query('INSERT INTO access_grants(user_id,role_id,church,scope,group_id,member_id,permissions,expires_at,reason,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',[...values,createId])).rows[0];
      await audit(c,a.id,church,row.id,id ? '修改授權' : '新增授權',old,input); return row;
    });
  };
  router.post('/grants',async(req,res)=>res.status(201).json(await saveGrant(req,res.locals.actor)));
  router.put('/grants/:id',async(req,res)=>res.json(await saveGrant(req,res.locals.actor,z.string().uuid().parse(req.params.id))));
  router.delete('/grants/:id',async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id), input=z.object({version:z.number().int().positive(),reason:z.string().trim().min(1).max(500)}).strict().parse(req.body);
    await transaction(async c=>{
      const old=(await c.query('SELECT * FROM access_grants WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!old)throw new GroupError(404,'找不到授權。');
      const a=await director(res.locals.actor,old.church,c);
      if(old.scope==='site' && a.role!=='admin')throw new GroupError(403,'全站授權限系統管理員調整。');
      if(!old.active || old.version!==input.version)throw new GroupError(409,'授權已更新或撤回，請重新載入。');
      await c.query('UPDATE access_grants SET active=false,version=version+1,updated_at=now() WHERE id=$1',[id]);
      await audit(c,a.id,old.church,id,'撤回授權',old,input);
    });res.json({ok:true});
  });
  const errors:ErrorRequestHandler=(e,_req,res,_next)=>{
    if(e instanceof z.ZodError)return void res.status(400).json({error:e.issues.map(i=>i.message).join('；')});
    if(e instanceof GroupError)return void res.status(e.status).json({error:e.message});
    if(e?.code==='23505')return void res.status(409).json({error:'這個職分名稱已存在。'});
    console.error('[access-control] Request failed');res.status(500).json({error:'無法完成權限設定，請重新載入後再試。'});
  };router.use(errors);return router;
}
