import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;

export async function verifySupportHttp(pool: Pool, a: Client, b: Client, guest: Client, makeClient: () => Client, idA: string, idB: string) {
  const c = makeClient(), d = makeClient();
  const ids: string[] = [];
  for (const client of [c, d]) {
    const email = `scope-${randomUUID()}@example.test`;
    assert.equal((await client('/api/auth/register','POST',{ email, password: randomUUID(), displayName: 'Scope fixture' })).status, 200);
    ids.push((await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id);
  }
  const [idC,idD] = ids;
  await pool.query("UPDATE users SET church='HTTP church' WHERE id=ANY($1::uuid[])", [[idA,idB,idC,idD]]);
  const roleUpdate = await pool.query("UPDATE user_roles SET role='future_leader' WHERE user_id=$1",[idC]);
  if (!roleUpdate.rowCount) await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'future_leader')",[idC]);
  const group = async (leader: string) => (await pool.query("INSERT INTO small_groups(name,church,leader_user_id) VALUES('Scope group','HTTP church',$1) RETURNING id",[leader])).rows[0].id;
  const gA=await group(idA),gC=await group(idC);
  await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2)',[gA,idB]);
  const users = await a('/api/users?church=all'); assert.equal(users.status,200);
  const visible = (await users.json()).map((r: {id:string})=>r.id);
  assert(visible.includes(idB)); assert(!visible.includes(idD)); assert(!visible.includes(idC));
  const groups = await a('/api/crm/groups'); assert.equal(groups.status,200); assert.deepEqual((await groups.json()).map((g:{id:string})=>g.id),[gA]);
  await pool.query(`INSERT INTO crm_scope_assignments(assignee_user_id,assigned_by_user_id,scope_type,member_user_id,can_view_personal,can_manage_care,can_manage_members)
    VALUES($1,$2,'member',$3,true,true,true),($1,$2,'member',$4,false,false,false)`,[idC,idA,idB,idD]);
  assert.equal((await c(`/api/crm/groups/${gC}/members`,'POST',{userId:idD})).status,400);
  assert.equal((await pool.query('SELECT count(*)::int n FROM small_group_members WHERE user_id=$1',[idD])).rows[0].n,0);
  await pool.query(`INSERT INTO crm_scope_assignments(assignee_user_id,assigned_by_user_id,scope_type,group_id,can_manage_members) VALUES($1,$2,'group',$3,true)`,[idC,idA,gC]);
  assert.equal((await c(`/api/crm/groups/${gC}/members`,'POST',{userId:idB})).status,201);
  assert.equal((await pool.query('SELECT count(*)::int n FROM small_group_members WHERE user_id=$1 AND is_active',[idB])).rows[0].n,2);

  assert.equal((await guest('/api/support/requests')).status,401);
  const requestId=randomUUID(),target={kind:'group',id:gA,receiverId:idA},body={target,title:'Synthetic support',body:'Request body',consent:true};
  assert.equal((await b(`/api/support/requests/${requestId}`,'PUT',{...body,consent:false})).status,400);
  assert.equal((await b(`/api/support/requests/${requestId}`,'PUT',body)).status,200);
  assert.equal((await b(`/api/support/requests/${requestId}`,'PUT',body)).status,200);
  assert.equal((await pool.query('SELECT count(*)::int n FROM support_requests WHERE id=$1',[requestId])).rows[0].n,1);
  assert.equal((await c(`/api/support/requests/${requestId}`)).status,404);
  const openRequests=await b('/api/support/requests?filter=open');assert.equal(openRequests.status,200);assert((await openRequests.json()).requests.some((r:{id:string})=>r.id===requestId));
  const closedRequests=await b('/api/support/requests?filter=closed');assert.equal(closedRequests.status,200);assert(!(await closedRequests.json()).requests.some((r:{id:string})=>r.id===requestId));
  let detail=await (await a(`/api/support/requests/${requestId}`)).json();
  assert.equal((await a(`/api/support/requests/${requestId}`,'PATCH',{version:detail.request.version,status:'accepted',nextAction:'Contact tomorrow',dueDate:'2026-09-14'})).status,200);
  assert.equal((await a(`/api/support/requests/${requestId}`,'PATCH',{version:detail.request.version,status:'completed',dueDate:null})).status,409);
  detail=await (await a(`/api/support/requests/${requestId}`)).json();
  const replyId=randomUUID(),reply={version:detail.request.version,body:'PRIVATE_SENTINEL',private:true};
  assert.equal((await a(`/api/support/requests/${requestId}/replies/${replyId}`,'PUT',reply)).status,200);
  assert.equal((await a(`/api/support/requests/${requestId}/replies/${replyId}`,'PUT',reply)).status,200);
  detail=await (await b(`/api/support/requests/${requestId}`)).json();
  assert(!JSON.stringify(detail).includes('PRIVATE_SENTINEL'));
  assert.equal((await b(`/api/support/requests/${requestId}/transfer`,'POST',{version:detail.request.version,target:{kind:'group',id:gC,receiverId:idC},consent:true})).status,200);
  assert.equal((await a(`/api/support/requests/${requestId}`)).status,404);
  const transferred=await c(`/api/support/requests/${requestId}`);assert.equal(transferred.status,200);assert(!(await transferred.text()).includes('PRIVATE_SENTINEL'));
  detail=await (await b(`/api/support/requests/${requestId}`)).json();
  assert.equal((await b(`/api/support/requests/${requestId}`,'PATCH',{version:detail.request.version,status:'cancelled',dueDate:null})).status,200);
  assert.equal((await c(`/api/support/requests/${requestId}`)).status,404);
  detail=await (await b(`/api/support/requests/${requestId}`)).json();
  assert.equal((await b(`/api/support/requests/${requestId}`,'PATCH',{version:detail.request.version,status:'open',dueDate:null})).status,200);
  await pool.query('UPDATE small_groups SET leader_user_id=$2 WHERE id=$1',[gC,idD]);
  assert.equal((await c(`/api/support/requests/${requestId}`)).status,404);
  assert.equal((await d(`/api/support/requests/${requestId}`)).status,404);

  const person = async (userId:string) => {
    const id=(await pool.query("INSERT INTO persons(display_name,church,notes) VALUES('Fixture person','HTTP church','PERSON_PRIVATE') RETURNING id")).rows[0].id;
    await pool.query("INSERT INTO person_identity_links(person_id,user_id,source_type) VALUES($1,$2,'user')",[id,userId]);return id;
  };
  const pB=await person(idB),pD=await person(idD);
  await pool.query("INSERT INTO feature_toggles(feature_key,feature_name,is_enabled) VALUES('pastoral_beta','Synthetic pastoral',true) ON CONFLICT(feature_key) DO UPDATE SET is_enabled=true");
  const readD=await c(`/api/pastoral/persons/${pD}`);assert.equal(readD.status,200);assert(!(await readD.text()).includes('PERSON_PRIVATE'));
  const template=(await pool.query("INSERT INTO journey_templates(slug,name,duration_days) VALUES('love-journey-28','Fixture',28) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id")).rows[0].id;
  const day=(await pool.query("INSERT INTO journey_days(template_id,day_number,title) VALUES($1,1,'ORIGINAL_LESSON') RETURNING id",[template])).rows[0].id;
  const journey=(await pool.query("INSERT INTO person_journeys(person_id,template_id,owner_user_id) VALUES($1,$2,$3) RETURNING id",[pB,template,idB])).rows[0].id;
  const progress=(await pool.query("INSERT INTO journey_progress(person_journey_id,journey_day_id,day_number,response_text,mentor_note,content_snapshot) SELECT $1,id,1,'RESPONSE_PRIVATE','MENTOR_PRIVATE',to_jsonb(journey_days) FROM journey_days WHERE id=$2 RETURNING id",[journey,day])).rows[0].id;
  await pool.query("UPDATE journey_days SET title='EDITED_LESSON' WHERE id=$1",[day]);
  const readB=await c(`/api/pastoral/persons/${pB}`);assert.equal(readB.status,200);const text=await readB.text();assert(!text.includes('RESPONSE_PRIVATE'));assert(text.includes('ORIGINAL_LESSON'));assert(!text.includes('EDITED_LESSON'));
  const own=await b('/api/me/love-journey');assert.equal(own.status,200);const ownText=await own.text();assert(ownText.includes('RESPONSE_PRIVATE'));assert(!ownText.includes('MENTOR_PRIVATE'));assert(!ownText.includes('PERSON_PRIVATE'));
  const save=await b(`/api/me/love-journey/progress/${progress}`,'PATCH',{version:1,responseText:'SHARED_ANSWER',visibility:'pastoral'});assert.equal(save.status,200);assert(!(await save.text()).includes('MENTOR_PRIVATE'));
  assert.equal((await b(`/api/me/love-journey/progress/${progress}`,'PATCH',{version:1,responseText:'STALE_OVERWRITE'})).status,404);
  const shared=await c(`/api/pastoral/persons/${pB}`);assert((await shared.text()).includes('SHARED_ANSWER'));
  const staff=await c(`/api/pastoral/journey-progress/${progress}`,'PATCH',{version:2,status:'completed'});assert.equal(staff.status,200);const staffText=await staff.text();assert(!staffText.includes('SHARED_ANSWER'));assert(!staffText.includes('MENTOR_PRIVATE'));
  assert.equal((await c(`/api/pastoral/journey-progress/${progress}`,'PATCH',{version:3,responseText:'STAFF_OVERWRITE'})).status,400);
  await pool.query("INSERT INTO pastoral_tasks(person_id,title,description,visibility,created_by_user_id) VALUES($1,'Private task','TASK_PRIVATE','private',$2)",[pB,idA]);
  const tasks=await c(`/api/pastoral/persons/${pB}/tasks`);assert.equal(tasks.status,200);assert(!(await tasks.text()).includes('TASK_PRIVATE'));
  const summaries=await c('/api/pastoral/persons');assert.equal(summaries.status,200);
  assert.equal((await summaries.json()).persons.find((p:{id:string})=>p.id===pB).openTaskCount,0);
  const taskFiltered=await c('/api/pastoral/persons?filter=tasks');assert.equal(taskFiltered.status,200);
  assert(!(await taskFiltered.json()).persons.some((p:{id:string})=>p.id===pB));

  const potential=(await pool.query("INSERT INTO potential_members(email,name,church) VALUES($1,'Care fixture','HTTP church') RETURNING id",[`care-${randomUUID()}@example.test`])).rows[0].id;
  await pool.query(`INSERT INTO crm_scope_assignments(assignee_user_id,assigned_by_user_id,scope_type,potential_member_id,can_manage_care,can_manage_members) VALUES($1,$2,'member',$3,true,false)`,[idC,idA,potential]);
  assert.equal((await c(`/api/potential-members/${potential}`,'PATCH',{status:'member'})).status,200);
  assert.equal((await c(`/api/potential-members/${potential}`,'PATCH',{name:'Forbidden rename'})).status,403);

  const oldPerson=(await pool.query("INSERT INTO persons(display_name,church,merged_into_person_id) VALUES('Merged fixture','HTTP church',$1) RETURNING id",[pB])).rows[0].id;
  await pool.query("INSERT INTO pastoral_framework_stages(slug,code,name,display_name) VALUES('follow','F3','Fixture','Fixture') ON CONFLICT(slug) DO NOTHING");
  const stage=await c(`/api/pastoral/persons/${oldPerson}/stage`,'PATCH',{stageSlug:'follow'});assert.equal(stage.status,200);assert.equal((await stage.json()).personId,pB);
  assert.equal((await pool.query('SELECT pastoral_stage FROM persons WHERE id=$1',[pB])).rows[0].pastoral_stage,'follow');

  assert.equal((await b(`/api/me/love-journey/${journey}/status`,'PATCH',{expectedStatus:'active',status:'paused'})).status,200);
  assert.equal((await b(`/api/me/love-journey/progress/${progress}`,'PATCH',{version:3,responseText:'FORBIDDEN_WHILE_PAUSED'})).status,404);
  assert.equal((await b(`/api/me/love-journey/progress/${progress}`,'PATCH',{version:3,visibility:'private'})).status,200);
  assert.equal((await c(`/api/me/love-journey/${journey}/status`,'PATCH',{expectedStatus:'paused',status:'active'})).status,409);
  assert.equal((await b(`/api/me/love-journey/${journey}/status`,'PATCH',{expectedStatus:'active',status:'paused'})).status,409);
  assert.equal((await b(`/api/me/love-journey/${journey}/status`,'PATCH',{expectedStatus:'paused',status:'active'})).status,200);

  const e=makeClient(),email=`unclaimed-${randomUUID()}@example.test`;
  const unclaimed=(await pool.query("INSERT INTO persons(display_name,primary_email,notes) VALUES('Unclaimed fixture',$1,'DO_NOT_CLAIM') RETURNING id",[email])).rows[0].id;
  assert.equal((await e('/api/auth/register','POST',{email,password:randomUUID(),displayName:'Unclaimed fixture'})).status,200);
  const visit=await e('/api/me/love-journey');assert.equal(visit.status,200);const visitData=await visit.json();assert.notEqual(visitData.person.id,unclaimed);
  const repeatedVisit=await e('/api/me/love-journey');assert.equal((await repeatedVisit.json()).person.id,visitData.person.id);
  const idE=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
  await pool.query("UPDATE persons SET church='HTTP church' WHERE id=$1",[visitData.person.id]);
  await pool.query(`INSERT INTO crm_scope_assignments(assignee_user_id,assigned_by_user_id,scope_type,member_user_id,can_manage_care) VALUES($1,$2,'member',$3,true)`,[idC,idA,idE]);
  const staffStart=await c(`/api/pastoral/persons/${visitData.person.id}/love-journey/start`,'POST',{});assert.equal(staffStart.status,201);
  const started=(await staffStart.json()).journeyId;
  assert.equal((await (await e('/api/me/love-journey')).json()).loveJourney.id,started);
  assert.equal((await e('/api/me/love-journey/start','POST',{})).status,201);
  assert.equal((await pool.query('SELECT count(*)::int n FROM person_journeys WHERE person_id=$1',[visitData.person.id])).rows[0].n,1);
  await pool.query('UPDATE person_identity_links SET person_id=$1 WHERE user_id=$2',[visitData.person.id,idD]);
  assert.equal((await c(`/api/pastoral/persons/${visitData.person.id}/love-journey/start`,'POST',{})).status,409);
  return { crmGroupBoundary:true, capabilityScope:true, supportConsent:true, supportTransferRevocation:true, supportIdempotency:true, journeyPrivateProjection:true, lessonSnapshot:true, versionConflict:true, privateTaskCounts:true, careOnlyStatus:true, mergedStageTarget:true, pauseAndUnshare:true, selfIdentityNoEmailClaim:true };
}
