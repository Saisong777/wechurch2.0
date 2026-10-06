import { pool } from './db';
import { churchContext, ChurchScopeError } from './churchContext';
import { getKnownChurchOptions, normalizeChurch } from '../shared/churches';
export async function pendingChurchAffiliations() {
  if(!churchContext()?.isSystemAdmin)throw new ChurchScopeError(403,'CHURCH_SCOPE_FORBIDDEN','需要系統管理權限。');
  return (await pool.query('SELECT id,display_name AS "displayName",email,church FROM users WHERE church IS NULL ORDER BY created_at,id LIMIT 500')).rows;
}
export async function approveChurchAffiliation(actor:string,target:string,updates:{expectedChurch?:string|null;church?:string|null;displayName?:string;avatarUrl?:string|null;birthday?:string|null;userGender?:string|null;address?:string|null}) {
  const next=normalizeChurch(updates.church);
  if(next&&!getKnownChurchOptions().some(c=>c.id===next))throw new ChurchScopeError(400,'INVALID_CHURCH_SCOPE','請選擇有效教會。');
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    // Same account lock is taken by authenticated church mutations, preventing a stale request from publishing during a move.
    await c.query("SELECT pg_advisory_xact_lock(hashtext('church-affiliation:' || $1))",[target]);
    if(!(await c.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role='admin' FOR SHARE",[actor])).rowCount)throw new ChurchScopeError(403,'CHURCH_SCOPE_FORBIDDEN','只有系統管理員可以核定教會。');
    const before=(await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[target])).rows[0];
    if(!before){await c.query('ROLLBACK');return undefined;}
    if(!Object.hasOwn(updates,'expectedChurch')||normalizeChurch(updates.expectedChurch)!==normalizeChurch(before.church))throw new ChurchScopeError(409,'CHURCH_AFFILIATION_CONFLICT','核定資料已更新，請重新載入後再試。');
    if(normalizeChurch(before.church)!==next){
      const groups=(await c.query('SELECT * FROM small_groups WHERE leader_user_id=$1 OR co_leader_user_id=$1 OR pastor_user_id=$1 OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=small_groups.id AND m.user_id=$1 AND m.is_active) ORDER BY id FOR UPDATE',[target])).rows;
      for(const g of groups.filter(g=>normalizeChurch(g.church)!==next)){
        await c.query('UPDATE small_group_members SET is_active=false,updated_at=now() WHERE group_id=$1 AND user_id=$2 AND is_active',[g.id,target]);
        await c.query('UPDATE small_groups SET leader_user_id=CASE WHEN leader_user_id=$2 THEN NULL ELSE leader_user_id END,co_leader_user_id=CASE WHEN co_leader_user_id=$2 THEN NULL ELSE co_leader_user_id END,pastor_user_id=CASE WHEN pastor_user_id=$2 THEN NULL ELSE pastor_user_id END,version=version+1,updated_at=now() WHERE id=$1',[g.id,target]);
        await c.query("UPDATE life_group_requests SET status='rejected' WHERE group_id=$1 AND user_id=$2 AND status='pending'",[g.id,target]);
        await c.query('DELETE FROM life_group_invites WHERE group_id=$1',[g.id]);
        await c.query("INSERT INTO family_membership_events(group_id,user_id,actor_id,action,reason) VALUES($1,$2,$3,'church_changed','管理者核定所屬教會異動')",[g.id,target,actor]);
        await c.query('DELETE FROM life_group_care_watches WHERE user_id=$1 AND care_id IN(SELECT id FROM life_group_care WHERE group_id=$2)',[target,g.id]);
        await c.query('UPDATE life_group_care SET responsible_id=NULL,version=version+1,updated_at=now() WHERE group_id=$1 AND responsible_id=$2',[g.id,target]);
      }
      await c.query('UPDATE access_grants SET active=false,version=version+1,updated_at=now() WHERE (user_id=$1 OR member_id=$1) AND active AND church IS DISTINCT FROM $2',[target,next]);
      await c.query('UPDATE crm_scope_assignments SET is_active=false,updated_at=now() WHERE (assignee_user_id=$1 OR member_user_id=$1) AND is_active',[target]);
      await c.query('INSERT INTO church_affiliation_events(actor_id,user_id,previous_church,next_church) VALUES($1,$2,$3,$4)',[actor,target,before.church,next]);
    }
    const fields:{[key:string]:string}={displayName:'display_name',avatarUrl:'avatar_url',birthday:'birthday',userGender:'user_gender',address:'address'};
    const values:unknown[]=[target,next];const sets=['church=$2'];
    for(const [key,col] of Object.entries(fields))if(Object.hasOwn(updates,key)){values.push(updates[key as keyof typeof updates]);sets.push(`${col}=$${values.length}`);}
    const after=(await c.query(`UPDATE users SET ${sets.join(',')},updated_at=now() WHERE id=$1 RETURNING id`,values)).rows[0];
    await c.query('COMMIT');return after;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
