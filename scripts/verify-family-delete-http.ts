import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;

// Synthetic accounts and data in the existing disposable loopback integrity database only.
export async function verifyFamilyDeleteHttp(pool: Pool, makeClient: () => Client) {
  const root = '/api/life-groups';
  const actors: { id: string; client: Client }[] = [];
  for (const [index, role] of ['senior_pastor','member','member','member','admin','senior_pastor'].entries()) {
    const client = makeClient(), email = `delete-family-${randomUUID()}@example.test`;
    assert.equal((await client('/api/auth/register','POST',{ email, password: randomUUID(), displayName: `合成刪除驗收${index}` })).status,200);
    const id = (await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
    await pool.query('UPDATE users SET church=$2 WHERE id=$1',[id,index === 5 ? '火樂' : 'IM 行動教會']);
    await pool.query('DELETE FROM user_roles WHERE user_id=$1',[id]);
    await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
    actors.push({ id, client });
  }
  const [director,appointed,co,member,admin,foreign] = actors;
  const name = `合成待刪小家-${randomUUID()}`;
  const created = await director.client('/api/crm/groups','POST',{ name, church:'IM 行動教會', leaderUserId:appointed.id, coLeaderUserId:co.id });
  assert.equal(created.status,201); const id = (await created.json()).id;
  const version = async () => (await pool.query('SELECT version FROM small_groups WHERE id=$1',[id])).rows[0].version;
  const input = async () => ({ version:await version(), confirmName:name });
  const mutate = async (client: Client, restore = false, body?: unknown) => client(`${root}/management/${id}${restore ? '/restore' : ''}`,restore ? 'POST' : 'DELETE',body ?? await input());
  const groupDigest = async () => (await pool.query('SELECT md5(row_to_json(g)::text) AS digest FROM small_groups g WHERE id=$1',[id])).rows;
  const protectedTables = ['users','user_roles','access_grants','crm_scope_assignments','small_group_members','life_group_requests','life_group_shares','life_group_comments','life_group_prayed','life_group_care','life_group_care_updates','life_group_care_watches','life_group_reading','devotional_notes','personal_prayers','user_reading_progress'];
  const protectedDigest = async () => {
    const result: Record<string,unknown> = {};
    for (const table of protectedTables) result[table] = (await pool.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(digest,',' ORDER BY digest),'')) AS digest FROM (SELECT md5(row_to_json(t)::text) AS digest FROM ${table} t) d`)).rows;
    return result;
  };
  const listed = async () => (await (await director.client(root+'/management')).json()).groups.find((g:{id:string}) => g.id === id);
  assert.equal((await listed()).canDelete,true);
  assert.equal((await (await appointed.client(root+'/management')).json()).groups.find((g:{id:string}) => g.id === id).canDelete,false);
  for (const actor of [appointed,co,member,foreign]) {
    assert.equal((await mutate(actor.client)).status,403);
    assert.equal((await mutate(actor.client,true)).status,403);
  }
  // Explicit group-level member management still does not grant church-level deletion.
  const assignment = (await pool.query("INSERT INTO crm_scope_assignments(assignee_user_id,assigned_by_user_id,scope_type,church,group_id,can_manage_members) VALUES($1,$2,'group',$3,$4,true) RETURNING id",[member.id,director.id,'IM 行動教會',id])).rows[0].id;
  assert.equal((await (await member.client(root+'/management')).json()).groups.find((g:{id:string}) => g.id === id).canDelete,false);
  assert.equal((await mutate(member.client)).status,403);
  assert.equal((await mutate(member.client,true)).status,403);
  await pool.query('DELETE FROM crm_scope_assignments WHERE id=$1',[assignment]);
  assert.equal((await makeClient()(`${root}/management/${id}`,'DELETE',await input())).status,401);
  const unchanged = await groupDigest();
  assert.equal((await mutate(director.client,false,{version:await version()})).status,400);
  assert.equal((await mutate(director.client,false,{version:await version(),confirmName:name+'錯'})).status,400);
  assert.equal((await mutate(director.client,false,{version:0,confirmName:name})).status,400);
  assert.equal((await mutate(director.client,false,{version:await version()+1,confirmName:name})).status,409);
  assert.equal((await mutate(director.client,true)).status,409);
  assert.deepEqual(await groupDigest(),unchanged);
  await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2)',[id,member.id]);
  assert.equal((await listed()).ordinaryMemberCount,1);
  assert.equal((await listed()).unlinkedActiveMemberCount,0);
  assert.equal((await mutate(director.client)).status,409);
  assert.deepEqual(await groupDigest(),unchanged);
  await pool.query('UPDATE small_group_members SET is_active=false WHERE group_id=$1 AND user_id=$2',[id,member.id]);
  const unlinked = (await pool.query('INSERT INTO small_group_members(group_id,member_email) VALUES($1,$2) RETURNING id',[id,'unlinked-fixture@example.test'])).rows[0].id;
  assert.equal((await listed()).ordinaryMemberCount,1);
  assert.equal((await listed()).unlinkedActiveMemberCount,1);
  assert.equal((await mutate(director.client)).status,409);
  await pool.query('UPDATE small_group_members SET is_active=false WHERE id=$1',[unlinked]);
  await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2),($1,$3)',[id,appointed.id,co.id]);
  assert.equal((await listed()).ordinaryMemberCount,0);
  const share = randomUUID();
  assert.equal((await appointed.client(`${root}/${id}/shares/${share}`,'PUT',{kind:'message',title:'合成歷史',body:'合成小家歷史保留驗收',consent:true})).status,200);
  assert.equal((await co.client(`${root}/${id}/shares/${share}/comments/${randomUUID()}`,'PUT',{body:'合成留言歷史'})).status,200);
  const care = randomUUID();
  assert.equal((await appointed.client(`${root}/${id}/care/${care}`,'PUT',{name:'合成關懷',need:'合成關懷歷史保留',consent:true})).status,200);
  const invite = await (await appointed.client(`${root}/${id}/invite`,'POST')).json();
  const before = await protectedDigest(), firstVersion = await version();
  const originalEvents = (await pool.query('SELECT id,md5(row_to_json(e)::text) AS digest FROM family_membership_events e WHERE group_id=$1 ORDER BY id',[id])).rows;
  const concurrent = await Promise.all([mutate(director.client,false,{version:firstVersion,confirmName:name}),mutate(admin.client,false,{version:firstVersion,confirmName:name})]);
  assert.deepEqual(concurrent.map(r => r.status).sort(),[200,409]);
  assert.deepEqual(await protectedDigest(),before);
  assert.deepEqual((await pool.query('SELECT id,md5(row_to_json(e)::text) AS digest FROM family_membership_events e WHERE id=ANY($1::uuid[]) ORDER BY id',[originalEvents.map(e=>e.id)])).rows,originalEvents);
  const deleted = (await pool.query('SELECT lifecycle,is_active,is_listed,leader_user_id,co_leader_user_id,version FROM small_groups WHERE id=$1',[id])).rows[0];
  assert.deepEqual(deleted,{ lifecycle:'archived',is_active:false,is_listed:false,leader_user_id:appointed.id,co_leader_user_id:co.id,version:firstVersion+1 });
  assert.equal((await mutate(director.client)).status,409);
  assert.equal((await pool.query('SELECT 1 FROM life_group_invites WHERE group_id=$1',[id])).rowCount,0);
  assert(!(await (await member.client(root+'/directory')).json()).groups.some((g:{id:string}) => g.id === id));
  assert(!(await (await appointed.client(root)).json()).groups.some((g:{id:string}) => g.id === id));
  assert.equal((await appointed.client(`${root}/${id}/shares?kind=all`)).status,404);
  assert.equal((await appointed.client(`${root}/${id}/invite`,'POST')).status,404);
  assert.equal((await member.client(`${root}/directory/${id}/join`,'POST',{})).status,404);
  assert.equal((await member.client(`${root}/join`,'POST',{token:invite.token})).status,404);
  assert.equal((await mutate(appointed.client,true)).status,403);
  assert.equal((await mutate(admin.client,true)).status,200);
  assert.deepEqual(await protectedDigest(),before);
  assert.equal((await pool.query('SELECT lifecycle,is_active,is_listed FROM small_groups WHERE id=$1',[id])).rows[0].lifecycle,'active');
  assert.equal((await pool.query('SELECT is_listed FROM small_groups WHERE id=$1',[id])).rows[0].is_listed,false);
  assert.equal((await pool.query('SELECT 1 FROM life_group_invites WHERE group_id=$1',[id])).rowCount,0);
  assert.equal((await member.client(`${root}/join`,'POST',{token:invite.token})).status,404);
  assert.equal((await appointed.client(`${root}/${id}/shares/${share}`)).status,200);
  assert.equal((await mutate(director.client,true)).status,409);
  // Previously archived families from older releases are recoverable through the same explicit route.
  const old = (await pool.query("INSERT INTO small_groups(name,church,is_active,is_listed,lifecycle) VALUES($1,$2,false,false,'archived') RETURNING id,version",['合成歷史封存','IM 行動教會'])).rows[0];
  assert.equal((await director.client(`${root}/management/${old.id}/restore`,'POST',{version:old.version,confirmName:'合成歷史封存'})).status,200);
  assert.deepEqual((await pool.query('SELECT lifecycle,is_active,is_listed FROM small_groups WHERE id=$1',[old.id])).rows[0],{lifecycle:'active',is_active:true,is_listed:false});
  const events = (await pool.query("SELECT action FROM family_membership_events WHERE group_id=$1 AND action IN ('archived','restored') ORDER BY created_at",[id])).rows;
  assert.deepEqual(events,[{action:'archived'},{action:'restored'}]);
  console.log('PASS family deletion: scoped authorization, name/version validation, NULL/ordinary-member blocking, concurrent CAS, retained 16 protected tables/original audit, hidden access/invite revocation, independent/historical restoration and audit');
}
