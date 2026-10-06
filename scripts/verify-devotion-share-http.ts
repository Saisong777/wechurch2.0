import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
type Client=(path:string,method?:string,body?:unknown)=>Promise<Response>;
export async function verifyDevotionShareHttp(pool:Pool,makeClient:()=>Client){
 const owner=makeClient(),other=makeClient(),guest=makeClient();const ids:string[]=[];let ownerCookie='';let origin='';
 for(const client of [owner,other]){
  const email=`multishare-${randomUUID()}@example.test`;
  const registration=await client('/api/auth/register','POST',{email,password:randomUUID(),displayName:'Synthetic multi-share fixture'});assert.equal(registration.status,200);
  if(client===owner){ownerCookie=registration.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');origin=new URL(registration.url).origin;}
  ids.push((await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id);
 }
 const group=(await pool.query("INSERT INTO small_groups(name,church,leader_user_id) VALUES('Synthetic share group','Fixture',$1) RETURNING id",[ids[1]])).rows[0];
 await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2)',[group.id,ids[0]]);
 const makeNote=async()=>{const r=await owner('/api/devotional-notes','POST',{verseReference:'詩篇 23',verseText:'Synthetic scripture',observation:'PRIVATE fixture original',clientMutationId:randomUUID()});assert.equal(r.status,201);return (await r.json()).id as string;};
 const day=(await(await owner('/api/devotion-wall/window')).json()).day;
 const input={sourceId:await makeNote(),title:'Synthetic excerpt',body:'Explicit selected excerpt',reference:'詩篇 23',consent:true,group:{groupId:group.id},wall:{day,anonymous:true}};
 const endpoint=(id:string)=>`/api/devotion-wall/shares/${id}`;
 const counts=async(id:string)=>({group:(await pool.query('SELECT count(*)::int n FROM life_group_shares WHERE id=$1',[id])).rows[0].n,wall:(await pool.query('SELECT count(*)::int n FROM devotion_wall_posts WHERE id=$1',[id])).rows[0].n,ledger:(await pool.query('SELECT count(*)::int n FROM devotion_share_requests WHERE request_id=$1',[id])).rows[0].n});
 const crossSite=await fetch(origin+endpoint(randomUUID()),{method:'PUT',headers:{'Content-Type':'application/json',cookie:ownerCookie,origin:'https://outside.example.test'},body:JSON.stringify(input)});assert.equal(crossSite.status,403);
 const noOriginCrossSite=await fetch(origin+endpoint(randomUUID()),{method:'PUT',headers:{'Content-Type':'application/json',cookie:ownerCookie,'sec-fetch-site':'cross-site'},body:JSON.stringify(input)});assert.equal(noOriginCrossSite.status,403);
 assert.equal((await guest(endpoint(randomUUID()),'PUT',input)).status,401);
 assert.equal((await other(endpoint(randomUUID()),'PUT',input)).status,404);
 for(const patch of [{consent:false},{group:undefined,wall:undefined},{body:'x'.repeat(20001)},{userId:ids[1]},{wall:{day:'2000-01-01',anonymous:true}}])assert([400,409].includes((await owner(endpoint(randomUUID()),'PUT',{...input,...patch})).status));
 const requestId=randomUUID();
 const responses=await Promise.all([owner(endpoint(requestId),'PUT',input),owner(endpoint(requestId),'PUT',input)]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);assert.deepEqual(await counts(requestId),{group:1,wall:1,ledger:1});
 const result=await responses[0].json();assert.equal(result.group.groupId,group.id);assert.equal(result.wall.day,day);
 assert.equal((await owner(endpoint(requestId),'PUT',{...input,body:'Changed excerpt'})).status,409);
 assert.equal((await owner(endpoint(requestId),'PUT',{...input,wall:undefined})).status,409);
 assert.equal((await pool.query('SELECT is_anonymous FROM life_group_shares WHERE id=$1',[requestId])).rows[0].is_anonymous,false);
 assert.equal((await pool.query('SELECT is_anonymous FROM devotion_wall_posts WHERE id=$1',[requestId])).rows[0].is_anonymous,true);
 assert.equal((await pool.query('SELECT observation FROM devotional_notes WHERE id=$1',[input.sourceId])).rows[0].observation,'PRIVATE fixture original');
 await pool.query('UPDATE small_group_members SET is_active=false WHERE group_id=$1 AND user_id=$2',[group.id,ids[0]]);
 assert.equal((await owner(endpoint(requestId),'PUT',input)).status,404);
 await pool.query('UPDATE small_group_members SET is_active=true WHERE group_id=$1 AND user_id=$2',[group.id,ids[0]]);
 await pool.query('UPDATE devotion_wall_posts SET withdrawn_at=now() WHERE id=$1',[requestId]);
 assert.equal((await owner(endpoint(requestId),'PUT',input)).status,409);assert.deepEqual(await counts(requestId),{group:1,wall:1,ledger:1});
 // Actual PostgreSQL failure after the group insert must roll back group+wall+receipt.
 const failId=randomUUID(),failing={...input,sourceId:await makeNote()};
 await pool.query(`CREATE FUNCTION multishare_fail_wall() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${failId}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER multishare_fail_wall BEFORE INSERT ON devotion_wall_posts FOR EACH ROW EXECUTE FUNCTION multishare_fail_wall()`);
 try{assert.equal((await owner(endpoint(failId),'PUT',failing)).status,503);assert.deepEqual(await counts(failId),{group:0,wall:0,ledger:0});}finally{await pool.query('DROP TRIGGER multishare_fail_wall ON devotion_wall_posts;DROP FUNCTION multishare_fail_wall()');}
 assert.equal((await owner(endpoint(failId),'PUT',failing)).status,201);assert.deepEqual(await counts(failId),{group:1,wall:1,ledger:1});
 // A ledger failure after both inserts is also atomic.
 const ledgerFailId=randomUUID(),ledgerInput={...input,sourceId:await makeNote()};
 await pool.query(`CREATE FUNCTION multishare_fail_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='${ledgerFailId}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER multishare_fail_ledger BEFORE INSERT ON devotion_share_requests FOR EACH ROW EXECUTE FUNCTION multishare_fail_ledger()`);
 try{assert.equal((await owner(endpoint(ledgerFailId),'PUT',ledgerInput)).status,503);assert.deepEqual(await counts(ledgerFailId),{group:0,wall:0,ledger:0});}finally{await pool.query('DROP TRIGGER multishare_fail_ledger ON devotion_share_requests;DROP FUNCTION multishare_fail_ledger()');}
 const hiddenId=await makeNote();await pool.query('UPDATE devotional_notes SET hidden=true WHERE id=$1',[hiddenId]);
 assert.equal((await owner(endpoint(randomUUID()),'PUT',{...input,sourceId:hiddenId})).status,404);
 const deletedId=await makeNote();await pool.query('INSERT INTO devotional_note_deletions(note_id,user_id) VALUES($1,$2)',[deletedId,ids[0]]);
 assert.equal((await owner(endpoint(randomUUID()),'PUT',{...input,sourceId:deletedId})).status,404);
 // A membership removal already in progress wins the locked authorization recheck.
 const membershipRaceId=randomUUID(),membershipRaceInput={...input,sourceId:await makeNote()},removal=await pool.connect();
 let pendingRemoval:Promise<Response>|undefined;
 try{
  await removal.query('BEGIN');await removal.query('UPDATE small_group_members SET is_active=false WHERE group_id=$1 AND user_id=$2',[group.id,ids[0]]);
  pendingRemoval=owner(endpoint(membershipRaceId),'PUT',membershipRaceInput);
  let blocked=false;
  for(let i=0;i<100;i++){blocked=!!(await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND position('SELECT id FROM small_group_members' in query)>0")).rowCount;if(blocked)break;await new Promise(r=>setTimeout(r,10));}
  assert(blocked,'membership authorization waits for concurrent removal');await removal.query('COMMIT');
  assert.equal((await pendingRemoval).status,404);assert.deepEqual(await counts(membershipRaceId),{group:0,wall:0,ledger:0});
 }finally{await removal.query('ROLLBACK');removal.release();}
 await pool.query('UPDATE small_group_members SET is_active=true WHERE group_id=$1 AND user_id=$2',[group.id,ids[0]]);
 // Existing co-manager and pastor access needs no ordinary membership row.
 const managerGroup=(await pool.query("INSERT INTO small_groups(name,church,co_leader_user_id) VALUES('Synthetic co manager','Fixture',$1) RETURNING id",[ids[0]])).rows[0];
 assert.equal((await owner(endpoint(randomUUID()),'PUT',{...input,sourceId:await makeNote(),group:{groupId:managerGroup.id},wall:undefined})).status,201);
 await pool.query('UPDATE small_groups SET co_leader_user_id=NULL,pastor_user_id=$2 WHERE id=$1',[managerGroup.id,ids[0]]);
 assert.equal((await owner(endpoint(randomUUID()),'PUT',{...input,sourceId:await makeNote(),group:{groupId:managerGroup.id},wall:undefined})).status,201);
 const wallId=randomUUID();assert.equal((await owner(endpoint(wallId),'PUT',{...input,sourceId:await makeNote(),group:undefined})).status,201);assert.deepEqual(await counts(wallId),{group:0,wall:1,ledger:1});
 const groupId=randomUUID();assert.equal((await owner(endpoint(groupId),'PUT',{...input,sourceId:await makeNote(),wall:undefined})).status,201);assert.deepEqual(await counts(groupId),{group:1,wall:0,ledger:1});
 const conflictNote=await makeNote();assert.equal((await owner('/api/devotion-wall','POST',{sourceId:conflictNote,day,title:'Old content',body:'old',reference:'詩篇 23',anonymous:false,consent:true})).status,201);
 const conflictId=randomUUID();assert.equal((await owner(endpoint(conflictId),'PUT',{...input,sourceId:conflictNote})).status,409);assert.deepEqual(await counts(conflictId),{group:0,wall:0,ledger:0});
 const raceSource=await makeNote(),raceId=randomUUID(),raceInput={...input,sourceId:raceSource};
 const oldAndNew=await Promise.all([owner('/api/devotion-wall','POST',{sourceId:raceSource,day,title:input.title,body:input.body,reference:input.reference,anonymous:true,consent:true}),owner(endpoint(raceId),'PUT',raceInput)]);
 assert(oldAndNew.every(r=>[200,201].includes(r.status)));assert.equal((await pool.query('SELECT count(*)::int n FROM devotion_wall_posts WHERE source_note_id=$1',[raceSource])).rows[0].n,1);
 assert.equal((await owner(endpoint(raceId),'PUT',raceInput)).status,200);
 console.log('PASS multi-share HTTP: single/both destinations, private excerpt, exact concurrent replay, ownership, hidden/tombstone, removed member, withdrawn, old-wall conflict, CSRF, co-manager/pastor, locked membership-removal race, legacy-wall race, true wall/ledger-trigger atomic rollback');
}
