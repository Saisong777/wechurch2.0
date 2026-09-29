import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
type Client=(path:string,method?:string,body?:unknown)=>Promise<Response>;
export async function verifyAccessControl(pool:Pool,makeClient:()=>Client){
 const fixture=async(role:string,church='IM 行動教會')=>{
  const client=makeClient(),email=`access-${randomUUID()}@example.test`;
  assert.equal((await client('/api/auth/register','POST',{email,password:randomUUID(),displayName:'Access fixture'})).status,200);
  const id=(await pool.query('UPDATE users SET church=$2 WHERE email=$1 RETURNING id',[email,church])).rows[0].id;
  const result=await pool.query('UPDATE user_roles SET role=$2 WHERE user_id=$1',[id,role]);
  if(!result.rowCount)await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
  return {id,client,email};
 };
 const admin=await fixture('admin'),senior=await fixture('senior_pastor'),worker=await fixture('member'),member=await fixture('member'),other=await fixture('member','Another Church');
 const guest=makeClient();
 assert.equal((await guest('/api/access-control')).status,401);
 assert.equal((await worker.client('/api/access-control')).status,403);
 assert.equal((await senior.client('/api/access-control?church=Another%20Church')).status,403);
 assert.equal((await worker.client('/api/access-control/presets','POST',{church:'IM 行動教會'})).status,403);
 const mixedAdmin=(await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin') RETURNING id",[worker.id])).rows[0].id;
 try{
  assert.equal((await senior.client('/api/access-control/account-role/'+worker.id,'PUT',{role:'member'})).status,403,'senior pastor cannot downgrade an admin hidden behind a legacy member row');
  assert.equal((await senior.client('/api/user-roles/'+worker.id,'PUT',{role:'member'})).status,403);
 }finally{await pool.query('DELETE FROM user_roles WHERE id=$1',[mixedAdmin]);}
 const data=await (await admin.client('/api/access-control')).json();
 assert(data.roles.some((r:{name:string})=>r.name==='同工'));
 const roleId=data.roles.find((r:{name:string})=>r.name==='同工').id;
 const base={userId:worker.id,roleId,permissions:[],scope:'member',church:'IM 行動教會',groupId:null,memberId:member.id,expiresAt:null,reason:'驗收'};
 assert.equal((await senior.client('/api/access-control/grants','POST',{...base,userId:other.id})).status,403);
 assert.equal((await senior.client('/api/access-control/grants','POST',{...base,memberId:other.id})).status,403);
 assert.equal((await senior.client('/api/access-control/grants','POST',{...base,scope:'site',memberId:null,permissions:['devotions.manage']})).status,403);
 const firstRequest={...base,requestId:randomUUID()};
 const created=await admin.client('/api/access-control/grants','POST',firstRequest);assert.equal(created.status,201);const {id}=await created.json();
 const replay=await admin.client('/api/access-control/grants','POST',firstRequest);assert.equal(replay.status,201);assert.equal((await replay.json()).id,id);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM access_grants WHERE id=$1',[id])).rows[0].n,1);
 assert.equal((await admin.client('/api/access-control/grants','POST',{...firstRequest,permissions:['members.manage']})).status,409);
 assert.equal((await worker.client('/api/users')).status,403,'title alone must not grant CRM');
 assert.equal((await (await worker.client('/api/access-control/me')).json()).grants[0].roleName,'同工');
 const body={...base,permissions:['members.read'],version:1};
 assert.equal((await admin.client('/api/access-control/grants/'+id,'PUT',body)).status,200);
 const list=await worker.client('/api/users');assert.equal(list.status,200);
 const rows=await list.json();assert(rows.some((r:{id:string})=>r.id===member.id));assert(!rows.some((r:{id:string})=>r.id===other.id));
 const visible=rows.find((r:{id:string})=>r.id===member.id);assert(!('birthday' in visible));assert(!('address' in visible));
 assert.equal((await worker.client('/api/users/'+member.id+'/profile','PATCH',{displayName:'no'})).status,403);
 assert.equal((await worker.client('/api/admin/users-for-email')).status,403);
 assert.equal((await admin.client('/api/access-control/grants/'+id,'PUT',body)).status,409,'stale edit rejected');
 assert.equal((await admin.client('/api/access-control/grants/'+id,'PUT',{...base,version:2,permissions:['members.manage','email.send']})).status,200);
 assert.equal((await worker.client('/api/users/'+member.id+'/profile','PATCH',{displayName:'Edited fixture'})).status,200);
 assert.equal((await worker.client('/api/users/'+other.id+'/profile','PATCH',{displayName:'no'})).status,403);
 const directory=await worker.client('/api/admin/users-for-email');assert.equal(directory.status,200);
 const recipients=await directory.json();assert(recipients.some((r:{id:string})=>r.id===member.id));assert(!recipients.some((r:{id:string})=>r.id===other.id));
 assert.equal((await worker.client('/api/send-bulk-email','POST',{recipients:[{email:other.email}],subject:'No send',body:'No send',isHtml:false,requestId:randomUUID()})).status,403);
 assert.equal((await worker.client('/api/user-roles/'+worker.id,'PUT',{role:'admin'})).status,403);
 // Multiple titles coexist; editing the preset cannot silently change existing grants.
 const elder=data.roles.find((r:{name:string})=>r.name==='長老');
 assert.equal((await admin.client('/api/access-control/grants','POST',{...base,roleId:elder.id})).status,201);
 assert.equal((await admin.client('/api/access-control/roles/'+roleId,'PUT',{name:'同工',permissions:['wall.moderate'],version:1})).status,200);
 assert(!(await (await worker.client('/api/access-control/me')).json()).permissions.includes('wall.moderate'));
 assert.equal((await admin.client('/api/access-control/grants/'+id,'DELETE',{version:3,reason:'結束驗收'})).status,200);
 assert.equal((await worker.client('/api/admin/users-for-email')).status,403);
 assert.equal((await worker.client('/api/users')).status,403);
 assert.equal((await worker.client('/api/users/'+member.id+'/profile','PATCH',{displayName:'no'})).status,403);
 const expiring=await admin.client('/api/access-control/grants','POST',{...base,permissions:['members.read'],expiresAt:new Date(Date.now()+3600000).toISOString()});
 const expiredId=(await expiring.json()).id;
 await pool.query("UPDATE access_grants SET expires_at=now()-interval '1 second' WHERE id=$1",[expiredId]);
 assert.equal((await worker.client('/api/users')).status,403);
 const moved=await admin.client('/api/access-control/grants','POST',{...base,permissions:['members.read']});assert.equal(moved.status,201);
 await pool.query("UPDATE users SET church='Another Church' WHERE id=$1",[worker.id]);
 assert.equal((await worker.client('/api/users')).status,403);
 await pool.query("UPDATE users SET church='IM 行動教會' WHERE id=$1",[worker.id]);
 // Public content authority cannot unlock personal notes or group-only posts.
 const global=await admin.client('/api/access-control/grants','POST',{...base,scope:'site',memberId:null,permissions:['devotions.manage','wall.moderate']});assert.equal(global.status,201);
 assert.equal((await worker.client('/api/admin/church-devotions?from=2026-09-01&to=2026-09-30')).status,200);
 assert.equal((await worker.client('/api/admin/inbox')).status,403);
 assert.equal((await worker.client('/api/users/'+member.id+'/profile')).status,403);
 const globalId=(await global.json()).id;
 const noteResponse=await member.client('/api/devotional-notes','POST',{verseReference:'約翰福音 3:16',verseText:'Fixture',observation:'PRIVATE_ORIGINAL',clientMutationId:randomUUID()});
 assert.equal(noteResponse.status,201);const note=await noteResponse.json();
 assert(!(await (await worker.client('/api/devotional-notes')).text()).includes('PRIVATE_ORIGINAL'));
 assert.equal((await worker.client('/api/devotional-notes/'+note.id,'PATCH',{observation:'blocked',version:1})).status,409);
 const window=await (await member.client('/api/devotion-wall/window')).json();
 const publicNote=await member.client('/api/devotion-wall','POST',{sourceId:note.id,day:window.day,title:'Fixture public excerpt',body:'Public only',reference:'約翰福音 3:16',anonymous:false,consent:true});
 assert.equal(publicNote.status,201);const post=await publicNote.json();
 assert.equal((await worker.client('/api/devotion-wall/'+post.id,'DELETE')).status,200);
 assert.equal((await pool.query('SELECT observation FROM devotional_notes WHERE id=$1',[note.id])).rows[0].observation,'PRIVATE_ORIGINAL');
 assert.equal((await admin.client('/api/access-control/grants/'+globalId,'DELETE',{version:1,reason:'撤回公開內容管理'})).status,200);
 assert.equal((await worker.client('/api/admin/church-devotions')).status,403);
 assert.equal((await worker.client('/api/devotion-wall/'+post.id,'DELETE')).status,404);
 // A scoped family administrator can manage membership but cannot read private group posts.
 const createGroup=async(name:string)=>{const r=await admin.client('/api/life-groups/management','POST',{name,church:'IM 行動教會'});assert.equal(r.status,201);return(await r.json()).id;};
 const group=await createGroup('Scoped access family'),unscoped=await createGroup('Other access family');
 const groupGrant=await admin.client('/api/access-control/grants','POST',{...base,scope:'group',groupId:group,memberId:null,permissions:['groups.manage']});
 assert.equal(groupGrant.status,201);const groupGrantId=(await groupGrant.json()).id;
 assert.equal((await worker.client('/api/life-groups/management/'+group)).status,200);
 assert.equal((await worker.client('/api/life-groups/management/'+unscoped)).status,403);
 assert.equal((await worker.client('/api/life-groups/'+group+'/shares?kind=all')).status,404);
 const settings={version:1,name:'Scoped access family',description:'Updated by delegated coworker',meeting:'',announcement:'',listed:false,status:'active',leaderId:admin.id};
 assert.equal((await worker.client('/api/life-groups/management/'+group,'PATCH',settings)).status,200);
 assert.equal((await admin.client('/api/access-control/grants/'+groupGrantId,'DELETE',{version:1,reason:'撤回小家管理'})).status,200);
 assert.equal((await worker.client('/api/life-groups/management/'+group)).status,403);
 // Read-only membership access does not become care authority through another scoped grant.
 const person=async(userId:string)=>{const p=(await pool.query("INSERT INTO persons(display_name,church,notes) VALUES('Access fixture','IM 行動教會','PRIVATE_CARE') RETURNING id")).rows[0].id;await pool.query("INSERT INTO person_identity_links(person_id,user_id,source_type) VALUES($1,$2,'user')",[p,userId]);return p;};
 const scopedPerson=await person(member.id),ownPerson=await person(worker.id);
 const careGrant=await admin.client('/api/access-control/grants','POST',{...base,memberId:worker.id,permissions:['care.manage']});
 assert.equal(careGrant.status,201);const careGrantId=(await careGrant.json()).id;
 assert.equal((await worker.client('/api/pastoral/persons/'+ownPerson+'/tasks','POST',{title:'Fixture follow up',visibility:'team'})).status,201);
 assert.equal((await worker.client('/api/pastoral/persons/'+scopedPerson+'/tasks','POST',{title:'Must not leak scope',visibility:'team'})).status,404);
 assert.equal((await admin.client('/api/access-control/grants/'+careGrantId,'DELETE',{version:1,reason:'撤回牧養跟進'})).status,200);
 assert.equal((await worker.client('/api/pastoral/persons/'+ownPerson+'/tasks')).status,403);
 // Visit delegation remains inside one church and disappears after revocation.
 const visitGrant=await admin.client('/api/access-control/grants','POST',{...base,scope:'church',memberId:null,permissions:['visits.manage']});
 assert.equal(visitGrant.status,201);const visitGrantId=(await visitGrant.json()).id;
 const visitId=randomUUID();
 assert.equal((await member.client('/api/care-visits/'+visitId,'PUT',{name:'Fixture visit',reason:'Testing care workflow',contactMethod:'example.test',urgency:'normal',consent:true})).status,200);
 const inbox=await worker.client('/api/care-visits?mode=inbox');assert.equal(inbox.status,200);assert((await inbox.json()).requests.some((r:{id:string})=>r.id===visitId));
 assert.equal((await worker.client('/api/care-visits/'+visitId,'PATCH',{version:1,status:'assigned',assigneeId:worker.id,dueDate:null,note:'Fixture arrangement'})).status,200);
 assert.equal((await other.client('/api/care-visits/'+visitId)).status,404);
 assert.equal((await admin.client('/api/access-control/grants/'+visitGrantId,'DELETE',{version:1,reason:'撤回探訪安排'})).status,200);
 assert.equal((await worker.client('/api/care-visits?mode=inbox')).status,403);
 assert.equal((await worker.client('/api/care-visits/'+visitId)).status,404);
 const beforeAdmins=(await pool.query("SELECT user_id FROM user_roles WHERE role='admin' AND user_id<>$1",[admin.id])).rows.map(r=>r.user_id);
 try{
  await pool.query("UPDATE user_roles SET role='member' WHERE role='admin' AND user_id<>$1",[admin.id]);
  assert.equal((await admin.client('/api/access-control/account-role/'+admin.id,'PUT',{role:'member'})).status,409);
  assert.equal((await admin.client('/api/user-roles/'+admin.id,'PUT',{role:'member'})).status,409);
  const duplicate=(await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin') RETURNING id",[admin.id])).rows[0].id;
  try{assert.equal((await admin.client('/api/access-control/account-role/'+admin.id,'PUT',{role:'member'})).status,409,'duplicate legacy rows do not represent another administrator');}
  finally{await pool.query('DELETE FROM user_roles WHERE id=$1',[duplicate]);}
 }finally{await pool.query("UPDATE user_roles SET role='admin' WHERE user_id=ANY($1::uuid[])",[beforeAdmins]);}
 assert((await pool.query("SELECT count(*)::int AS n FROM access_audit WHERE actor_id=$1",[admin.id])).rows[0].n>=8);
 console.log('PASS access controls: multi-role, strict scopes, no self-escalation/private data, explicit preset application, stale writes, expiry, church transfer, revocation, audit and last-admin protection');
}
