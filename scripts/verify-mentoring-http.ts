import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
type Client=(path:string,method?:string,body?:unknown)=>Promise<Response>;

export async function verifyMentoringHttp(pool:Pool,makeClient:()=>Client){
  const clients=[makeClient(),makeClient(),makeClient(),makeClient()];const ids:string[]=[];
  for(const [index,client] of clients.entries()){
    const email=`mentor-${randomUUID()}@example.test`;
    assert.equal((await client('/api/auth/register','POST',{email,password:randomUUID(),displayName:`Mentoring fixture ${index}`})).status,200);
    ids.push((await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id);
  }
  const [learner,mentor,next,other]=clients,[learnerId,mentorId,nextId]=ids;
  const person=(await pool.query("INSERT INTO persons(display_name,notes) VALUES('Learner fixture','PERSON_SECRET') RETURNING id")).rows[0].id;
  await pool.query("INSERT INTO person_identity_links(person_id,user_id,source_type) VALUES($1,$2,'user')",[person,learnerId]);
  const template=(await pool.query("SELECT id FROM journey_templates WHERE slug='love-journey-28'")).rows[0].id;
  const day=(await pool.query('SELECT id FROM journey_days WHERE template_id=$1 AND day_number=1',[template])).rows[0].id;
  const journeyId=(await pool.query("INSERT INTO person_journeys(person_id,template_id,owner_user_id,private_note) VALUES($1,$2,$3,'JOURNEY_SECRET') RETURNING id",[person,template,learnerId])).rows[0].id;
  const progressId=(await pool.query("INSERT INTO journey_progress(person_journey_id,journey_day_id,day_number,response_text,mentor_note) VALUES($1,$2,1,'SHARE_ONLY_BY_CHOICE','MENTOR_SECRET') RETURNING id",[journeyId,day])).rows[0].id;
  const groupId=(await pool.query("INSERT INTO small_groups(name,church,leader_user_id,pastor_user_id) VALUES('Mentoring fixture','Fixture',$1,$2) RETURNING id",[mentorId,nextId])).rows[0].id;
  await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2)',[groupId,learnerId]);
  const id=randomUUID(),input={journeyId,groupId,mentorId,cadenceDays:14,agreement:'Synthetic mutual agreement',consent:true};
  assert.equal((await learner(`/api/mentoring/contracts/${id}`,'PUT',{...input,consent:false})).status,400);
  assert.equal((await other(`/api/mentoring/contracts/${randomUUID()}`,'PUT',input)).status,404);
  assert.equal((await learner(`/api/mentoring/contracts/${id}`,'PUT',input)).status,200);
  assert.equal((await learner(`/api/mentoring/contracts/${id}`,'PUT',input)).status,200);
  assert.equal((await pool.query('SELECT count(*)::int n FROM mentoring_contracts WHERE id=$1',[id])).rows[0].n,1);
  let detail=await (await mentor(`/api/mentoring/contracts/${id}`)).json();assert.deepEqual(detail.progress,[]);assert.deepEqual(detail.feedback,[]);
  assert.equal((await other(`/api/mentoring/contracts/${id}`)).status,404);
  assert.equal((await learner(`/api/mentoring/contracts/${id}`,'PATCH',{version:1,action:'accept',consent:true})).status,409);
  assert.equal((await learner(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:1,visibility:'mentor',mentorContractId:id})).status,404);
  assert.equal((await mentor(`/api/mentoring/contracts/${id}`,'PATCH',{version:1,action:'accept',consent:true})).status,200);
  detail=await (await mentor(`/api/mentoring/contracts/${id}`)).json();assert.equal(detail.progress[0].responseText,null);assert(!JSON.stringify(detail).includes('SECRET'));
  assert.equal((await learner(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:1,visibility:'mentor',mentorContractId:id})).status,200);
  detail=await (await mentor(`/api/mentoring/contracts/${id}`)).json();assert.equal(detail.progress[0].responseText,'SHARE_ONLY_BY_CHOICE');
  const entryId=randomUUID(),feedback={version:2,kind:'practice',body:'Practice fixture'};
  assert.equal((await learner(`/api/mentoring/contracts/${id}/feedback/${entryId}`,'PUT',feedback)).status,200);
  assert.equal((await learner(`/api/mentoring/contracts/${id}/feedback/${entryId}`,'PUT',feedback)).status,200);
  assert.equal((await mentor(`/api/mentoring/contracts/${id}/feedback/${randomUUID()}`,'PUT',{version:3,kind:'practice',body:'Cannot impersonate practice'})).status,400);
  assert.equal((await learner(`/api/mentoring/contracts/${randomUUID()}`,'PUT',{...input,mentorId:nextId})).status,409);
  assert.equal((await learner(`/api/mentoring/contracts/${id}`,'PATCH',{version:2,action:'end',consent:true})).status,409);
  assert.equal((await learner(`/api/mentoring/contracts/${id}`,'PATCH',{version:3,action:'end',consent:true})).status,200);
  assert.equal((await mentor(`/api/mentoring/contracts/${id}`)).status,404);
  assert.equal((await mentor(`/api/mentoring/contracts/${id}/feedback/${randomUUID()}`,'PUT',{version:4,kind:'feedback',body:'After end'})).status,404);
  assert.equal((await (await mentor('/api/mentoring/contracts?mode=mentor')).json()).contracts.length,0);
  assert.equal((await (await learner(`/api/mentoring/contracts/${id}`)).json()).feedback.length,1);
  const progress=(await pool.query('SELECT visibility,version,mentor_contract_id FROM journey_progress WHERE id=$1',[progressId])).rows[0];assert.equal(progress.visibility,'private');assert.equal(progress.mentor_contract_id,null);assert.equal(progress.version,3);
  const newId=randomUUID();assert.equal((await learner(`/api/mentoring/contracts/${newId}`,'PUT',{...input,mentorId:nextId})).status,200);
  assert.equal((await next(`/api/mentoring/contracts/${newId}`,'PATCH',{version:1,action:'accept',consent:true})).status,200);
  detail=await (await next(`/api/mentoring/contracts/${newId}`)).json();assert.equal(detail.progress[0].responseText,null);assert.equal(detail.feedback.length,0);
  assert.equal((await learner(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:3,visibility:'mentor',mentorContractId:id})).status,404);
  assert.equal((await learner(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:2,visibility:'mentor',mentorContractId:newId})).status,404);
  assert.equal((await learner(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:3,visibility:'mentor',mentorContractId:newId})).status,200);
  await pool.query("INSERT INTO person_identity_links(person_id,user_id,source_type) VALUES($1,$2,'user')",[person,ids[3]]);
  const mergedOther=await other('/api/me/love-journey');assert.equal(mergedOther.status,200);assert.equal((await mergedOther.json()).loveJourney,null);
  assert.equal((await other(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:4,responseText:'CROSS_ACCOUNT_WRITE'})).status,404);
  assert.equal((await other(`/api/me/love-journey/${journeyId}/status`,'PATCH',{expectedStatus:'active',status:'paused'})).status,409);
  const secondJourney=(await pool.query('INSERT INTO person_journeys(person_id,template_id,owner_user_id) VALUES($1,$2,$3) RETURNING id',[person,template,learnerId])).rows[0].id;
  await assert.rejects(pool.query("INSERT INTO journey_progress(person_journey_id,journey_day_id,day_number,visibility,mentor_contract_id) VALUES($1,$2,1,'mentor',$3)",[secondJourney,day,newId]),(error:{code?:string})=>error.code==='23503');
  await pool.query('UPDATE small_group_members SET is_active=false WHERE group_id=$1 AND user_id=$2',[groupId,learnerId]);
  assert.equal((await next(`/api/mentoring/contracts/${newId}`)).status,404);
  const closures=await (await next('/api/mentoring/closures')).json();
  assert.deepEqual(closures,[{id:newId,status:'active',version:2}]);
  assert.deepEqual(await (await other('/api/mentoring/closures')).json(),[]);
  assert.equal((await learner(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:4,visibility:'mentor',mentorContractId:newId})).status,404);
  assert.equal((await next(`/api/mentoring/contracts/${newId}`,'PATCH',{version:closures[0].version,action:'end',consent:true})).status,200);
  const pending=randomUUID();
  await pool.query('UPDATE small_group_members SET is_active=true WHERE group_id=$1 AND user_id=$2',[groupId,learnerId]);
  assert.equal((await learner(`/api/mentoring/contracts/${pending}`,'PUT',input)).status,200);
  await pool.query('UPDATE small_group_members SET is_active=false WHERE group_id=$1 AND user_id=$2',[groupId,learnerId]);
  assert.equal((await mentor(`/api/mentoring/contracts/${pending}`,'PATCH',{version:1,action:'accept',consent:true})).status,404);
  assert.equal((await mentor(`/api/mentoring/contracts/${pending}`,'PATCH',{version:1,action:'decline',consent:true})).status,200);
  await pool.query('UPDATE small_group_members SET is_active=true WHERE group_id=$1 AND user_id=$2',[groupId,learnerId]);
  const contenders=[randomUUID(),randomUUID()];const invites=await Promise.all(contenders.map((candidate,i)=>learner(`/api/mentoring/contracts/${candidate}`,'PUT',{...input,mentorId:i?nextId:mentorId})));
  assert.deepEqual(invites.map(r=>r.status).sort(),[200,409]);
  const winner=invites.findIndex(r=>r.status===200),winnerId=contenders[winner],winnerMentor=winner?next:mentor;
  assert.equal((await winnerMentor(`/api/mentoring/contracts/${winnerId}`,'PATCH',{version:1,action:'accept',consent:true})).status,200);
  const race=await Promise.all([
    learner(`/api/me/love-journey/progress/${progressId}`,'PATCH',{version:5,visibility:'mentor',mentorContractId:winnerId}),
    learner(`/api/mentoring/contracts/${winnerId}`,'PATCH',{version:2,action:'end',consent:true}),
  ]);
  assert([200,404].includes(race[0].status));assert.equal(race[1].status,200);
  assert.equal((await pool.query('SELECT visibility FROM journey_progress WHERE id=$1',[progressId])).rows[0].visibility,'private');
  assert.equal((await winnerMentor(`/api/mentoring/contracts/${winnerId}`)).status,404);
  return {pendingNoAccess:true,mutualConsent:true,privateProjection:true,explicitAnswerShare:true,idempotentInviteAndFeedback:true,staleVersion:true,exitRevokes:true,newMentorNoInheritance:true,groupExitRevokes:true,mergedAccountOwnership:true,crossJourneyForeignKey:true,concurrentInvites:true,endShareRace:true};
}
