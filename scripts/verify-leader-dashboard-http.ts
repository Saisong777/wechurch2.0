import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { taipeiToday } from '../shared/churchDevotion';
type Client=(path:string,method?:string,body?:unknown)=>Promise<Response>;
export async function verifyLeaderDashboardHttp(pool:Pool,makeClient:()=>Client){
  const base='/api/life-groups/dashboard'; const ids:string[]=[];const clients:Client[]=[];
  for(const name of ['A','B','Senior','Pastor','Minister','Admin','Foreign']){
    const c=makeClient(),email=`dashboard-${randomUUID()}@example.test`;
    assert.equal((await c('/api/auth/register','POST',{email,password:randomUUID(),displayName:`Dashboard ${name}`})).status,200);
    ids.push((await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id);clients.push(c);
  }
  const [a,b,senior,pastor,minister,admin,foreign]=clients;
  await pool.query("UPDATE users SET church='IM 行動教會' WHERE id=ANY($1::uuid[])",[ids]);
  await pool.query("UPDATE users SET church='Other church' WHERE id=$1",[ids[6]]);
  for(const [n,role] of ['group_leader','group_leader','senior_pastor','pastor','minister','admin','senior_pastor'].entries()){
    await pool.query('DELETE FROM user_roles WHERE user_id=$1',[ids[n]]);
    await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[ids[n],role]);
  }
  const g=randomUUID(),other=randomUUID();
  await pool.query("INSERT INTO small_groups(id,name,church,leader_user_id) VALUES($1,'Dashboard family','IM 行動教會',$2),($3,'Foreign family','Other church',$4)",[g,ids[0],other,ids[6]]);
  await pool.query("INSERT INTO small_group_members(group_id,user_id,history_from) VALUES($1,$2,now()),($1,$3,now())",[g,ids[1],ids[3]]);
  const prayers=[randomUUID(),randomUUID(),randomUUID()];
  await pool.query("INSERT INTO life_group_shares(id,group_id,author_id,kind,title,body,is_anonymous,created_at) VALUES($1,$2,$3,'prayer','ANON_SHARED','Shared only',true,now()-interval '10 days'),($4,$2,$3,'prayer','WITHDRAWN','Hidden',false,now()),($5,$6,$7,'prayer','FOREIGN_SHARED','Foreign',false,now())",[prayers[0],g,ids[0],prayers[1],prayers[2],other,ids[6]]);
  await pool.query('UPDATE life_group_shares SET withdrawn_at=now() WHERE id=$1',[prayers[1]]);
  // Private prayer and care writes exercise the actual personal routes; neither can appear in team counts.
  assert.equal((await a('/api/care/contacts','POST',{name:'PRIVATE_DASHBOARD_CONTACT',need:'PRIVATE_NEED'})).status,201);
  const careIds=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
  for(const [i,status] of ['following','new','completed','paused'].entries()) await pool.query(`INSERT INTO life_group_care(id,group_id,creator_id,name,need,status,due_date,created_at) VALUES($1,$2,$3,$4,'Shared need',$5,$6,now()-interval '10 days')`,[careIds[i],g,ids[0],`SHARED_CARE_${i}`,status,taipeiToday()]);
  const own=await a(base);assert.equal(own.status,200);assert.match(own.headers.get('cache-control')||'',/no-store/);
  const overview=await own.json();assert.equal(overview.care.active,2);assert.equal(overview.care.due,2);assert.equal(overview.care.unassigned,2);assert.equal(overview.prayers.recent,1);assert.equal(overview.prayers.items[0].authorName,'匿名');
  assert(!JSON.stringify(overview).includes('PRIVATE'));assert(!JSON.stringify(overview).includes('FOREIGN'));assert(!JSON.stringify(overview.prayers).includes(ids[0]));
  const list=await(await a(`${base}/care`)).json();assert.equal(list.total,2);assert.equal(list.items.length,2);
  assert.equal((await a(`/api/life-groups/${g}/care/${careIds[0]}`)).status,200);
  assert.equal((await foreign(`${base}?scope=${g}`)).status,404);assert.equal((await makeClient()(base)).status,401);
  assert.equal((await(await admin(base)).json()).groups.length,0);
  assert.equal((await(await b(base)).json()).groups.length,0);
  const seniorData=await(await senior(`${base}?scope=${g}`)).json();assert.equal(seniorData.groups.some((x:{id:string})=>x.id===g),true);assert.equal(seniorData.care.active,0);assert.equal(seniorData.prayers.recent,0);assert.equal(seniorData.groups.find((x:{id:string})=>x.id===g).sharedReadable,false);
  await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'member')",[ids[2]]);
  assert.equal((await senior(`${base}?scope=${g}`)).status,404,'ambiguous role rows must not grant church-wide access');
  await pool.query("DELETE FROM user_roles WHERE user_id=$1 AND role='member'",[ids[2]]);
  const assignment=randomUUID();
  await pool.query("INSERT INTO crm_scope_assignments(id,assignee_user_id,scope_type,group_id,can_manage_care,assigned_by_user_id) VALUES($1,$2,'group',$3,true,$4)",[assignment,ids[3],g,ids[2]]);
  // Current membership is not a grant to see pre-join shared content.
  const pastorData=await(await pastor(`${base}?scope=${g}`)).json();assert.equal(pastorData.care.active,0);assert.equal(pastorData.prayers.recent,0);
  await pool.query("INSERT INTO crm_scope_assignments(assignee_user_id,scope_type,member_user_id,can_manage_care,assigned_by_user_id) VALUES($1,'member',$2,true,$3)",[ids[4],ids[1],ids[2]]);
  assert.equal((await(await minister(base)).json()).groups.length,0);
  await pool.query("UPDATE crm_scope_assignments SET ends_at=now()-interval '1 second' WHERE id=$1",[assignment]);assert.equal((await pastor(`${base}?scope=${g}`)).status,404);
  const departed=randomUUID();
  await pool.query("INSERT INTO small_group_members(id,group_id,user_id,is_active,joined_at,updated_at) VALUES($1,$2,$3,false,'2026-09-01 00:00:00',now())",[departed,g,ids[4]]);
  await pool.query("INSERT INTO family_membership_events(group_id,user_id,actor_id,action,created_at) VALUES($1,$2,$3,'left','2026-09-10T17:00:00Z')",[g,ids[4],ids[0]]);
  const pastRoster=await(await a(`${base}/${g}/roster?date=2026-09-11`)).json();
  assert(pastRoster.some((m:{key:string})=>m.key===`user:${ids[4]}`),'Taipei departure day is Sep 11');
  const afterDeparture=await(await a(`${base}/${g}/roster?date=2026-09-12`)).json();
  assert(!afterDeparture.some((m:{key:string})=>m.key===`user:${ids[4]}`),'later updated_at must not reopen past membership');
  const roster=await(await a(`${base}/${g}/roster`)).json();assert.equal(roster.length,3);
  const meeting=randomUUID();const create={date:taipeiToday(),kind:'group',roster:roster.map((m:{key:string})=>m.key)};
  assert.equal((await foreign(`${base}/${g}/gatherings/${meeting}`,'PUT',create)).status,404);
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PUT',{...create,roster:[...create.roster,`user:${ids[6]}`]})).status,409);
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PUT',create)).status,200);
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PUT',create)).status,200);
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PUT',{...create,kind:'sunday'})).status,409,'same id cannot silently accept different input');
  let detail=await(await a(`${base}/${g}/gatherings/${meeting}`)).json();assert.equal(detail.counts.unrecorded,3);assert.equal(detail.counts.absent,0);
  const entries=detail.entries.map((e:{key:string},i:number)=>({key:e.key,status:['present','excused','unrecorded'][i]}));
  const save={version:detail.version,entries,visitors:2,cancelled:false};
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PATCH',{...save,entries:[...entries,entries[0]]})).status,400);
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PATCH',{...save,entries:entries.slice(0,1)})).status,400);
  const concurrent=await Promise.all([a(`${base}/${g}/gatherings/${meeting}`,'PATCH',save),senior(`${base}/${g}/gatherings/${meeting}`,'PATCH',save)]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  detail=await(await a(`${base}/${g}/gatherings/${meeting}`)).json();assert.equal(detail.counts.present,1);assert.equal(detail.counts.excused,1);assert.equal(detail.counts.unrecorded,1);
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PATCH',{...save,version:detail.version,cancelled:true})).status,200);
  assert.equal((await(await a(`${base}?scope=${g}`)).json()).gatherings.length,0);
  assert.equal((await(await a(`${base}/gatherings?scope=${g}`)).json()).total,1);
  // Role handoff: preserve organizational history and authors, revoke prior appointment views.
  await pool.query("UPDATE user_roles SET role='member' WHERE user_id=$1",[ids[1]]);
  await pool.query('UPDATE small_groups SET leader_user_id=$2 WHERE id=$1',[g,ids[1]]);
  assert.equal((await (await b(base+'/access')).json()).available,true);
  await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2)',[g,ids[0]]);
  assert.equal((await a(`${base}?scope=${g}`)).status,404);
  assert.equal((await a(`${base}/${g}/gatherings/${meeting}`,'PATCH',{...save,version:3})).status,404);
  const after=await(await b(`${base}?scope=${g}`)).json();assert.equal(after.care.active,2);assert.equal(after.prayers.recent,1);
  assert.equal((await b(`${base}/${g}/gatherings/${meeting}`)).status,200);
  assert.equal((await pool.query('SELECT created_by FROM group_gatherings WHERE id=$1',[meeting])).rows[0].created_by,ids[0]);
  assert.equal(Number((await pool.query('SELECT count(*) FROM group_gathering_events WHERE gathering_id=$1',[meeting])).rows[0].count),3);
  console.log('Leader dashboard HTTP: scoped roles, private/anonymous/history isolation, unknown attendance, conflicts, cancellation, and handoff passed.');
}
