import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {taipeiToday} from '../shared/churchDevotion';
import {churchCatalog} from '../shared/churches';
type Client=(path:string,method?:string,body?:unknown)=>Promise<Response>;
export async function verifyChurchOnboardingHttp(pool:Pool,makeClient:()=>Client){
 assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name,/^wechurch_integrity_[a-f0-9]{32}$/);
 const fixture=async(name='Onboarding fixture',church:string|null=null,role?:string)=>{
  const client=makeClient(),email=`onboarding-${randomUUID()}@example.test`,password=randomUUID();
  const response=await client('/api/auth/register','POST',{email,password,displayName:name});assert.equal(response.status,200,await response.text());
  const id=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
  if(church!==null)await pool.query('UPDATE users SET church=$2 WHERE id=$1',[id,church]);
  if(role)await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
  return {client,id,email,password};
 };
 const member=await fixture(),admin=await fixture('Administrator',null,'admin'),pastor=await fixture('Pastor','IM 行動教會','pastor'),otherPastor=await fixture('Other pastor','火樂','minister'),leader=await fixture('Group leader','IM 行動教會','leader');

 // Saved browser cookie/store TTL must never revive an expired or invalid Passport identity.
 for(const invalid of ['expired','missing_expiry','stale_version','mismatched_member'] as const){
  const target=await fixture(`Invalid identity ${invalid}`);
  const row=(await pool.query("SELECT sid,sess FROM auth_sessions WHERE sess->'passport'->'user'->>'sessionUserId'=$1 ORDER BY expire DESC LIMIT 1",[target.id])).rows[0];assert(row);
  const saved=row.sess.passport.user;
  if(invalid==='expired')saved.expires_at=Math.floor(Date.now()/1000)-1;
  if(invalid==='missing_expiry')delete saved.expires_at;
  if(invalid==='stale_version')saved.sessionVersion=99;
  if(invalid==='mismatched_member'){saved.sessionUserId=randomUUID();delete saved.loginReceiptId;delete saved.loginReceiptAt;}
  await pool.query("UPDATE auth_sessions SET sess=$2,expire=now()+interval '1 day' WHERE sid=$1",[row.sid,JSON.stringify(row.sess)]);
  assert.equal((await target.client('/api/auth/user')).status,401,invalid);
  for(const path of ['/api/me/church-onboarding','/api/me/church-login-summary','/api/admin/church-login-inbox','/api/admin/church-login-inbox/days/2001-01-01'])assert.equal((await target.client(path)).status,401,`${invalid} ${path}`);
  assert.equal((await target.client('/api/me/church-onboarding','POST',{churchId:'火樂',requestId:randomUUID()})).status,401,invalid);
  assert.equal((await target.client(`/api/admin/church-login-inbox/${randomUUID()}/handle`,'PATCH',{version:1})).status,401,invalid);
  assert.equal((await target.client('/api/admin/church-login-inbox/days/read','POST',{day:'2001-01-01',scope:'unassigned'})).status,401,invalid);
  assert.equal((await pool.query('SELECT church FROM users WHERE id=$1',[target.id])).rows[0].church,null,`${invalid} cannot assign church`);
  assert.equal((await target.client('/api/bible/books')).status,200,'invalid identity must not gate public Bible');
 }
 assert.equal((await makeClient()('/api/me/church-onboarding')).status,401);
 assert.equal((await makeClient()('/api/bible/books')).status,200,'unmatched public Bible API stays anonymous');
 const status=await (await member.client('/api/me/church-onboarding')).json();assert.equal(status.canChoose,true);assert.equal(status.choices.length,3);
 const requestId=randomUUID(),choice={churchId:'IM 行動教會',requestId};
 const concurrent=await Promise.all([member.client('/api/me/church-onboarding','POST',choice),member.client('/api/me/church-onboarding','POST',{churchId:'火樂',requestId:randomUUID()})]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,403]);
 const selected=(await pool.query('SELECT church FROM users WHERE id=$1',[member.id])).rows[0].church;
 const winner=selected==='IM 行動教會'?choice:{churchId:'火樂',requestId:(await pool.query("SELECT request_id FROM church_affiliation_events WHERE user_id=$1 AND source='initial_choice'",[member.id])).rows[0].request_id};
 assert.equal((await member.client('/api/me/church-onboarding','POST',winner)).status,200);
 assert.equal((await pool.query('SELECT count(*)::int n FROM church_affiliation_events WHERE user_id=$1',[member.id])).rows[0].n,1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM church_login_receipts WHERE user_id=$1',[member.id])).rows[0].n,1);
 assert.equal((await pool.query('SELECT sum(login_count)::int n FROM church_login_daily WHERE user_id=$1',[member.id])).rows[0].n,1);
 assert.equal((await pool.query('SELECT church FROM church_login_daily WHERE user_id=$1',[member.id])).rows[0].church,'__unassigned','initial choice does not move the historical login');
 if(selected!=='IM 行動教會')assert.equal((await admin.client(`/api/users/${member.id}/profile`,'PATCH',{church:'IM 行動教會',expectedChurch:selected})).status,200);
 await pool.query("INSERT INTO church_catalog(id,display_name) VALUES('Unknown historic','Unknown historic')");
 const unknown=await fixture('Historical unknown','Unknown historic');assert.equal((await (await unknown.client('/api/me/church-onboarding')).json()).reason,'manager_required');
 assert.equal((await leader.client('/api/admin/church-login-inbox')).status,403);assert.equal((await (await leader.client('/api/me/church-login-summary')).json()).canManage,false);
 assert.equal((await member.client('/api/admin/church-login-inbox')).status,403,'ordinary member cannot read staff inbox');
 const inbox=await (await pastor.client('/api/admin/church-login-inbox')).json();const arrival=inbox.arrivals.find((r:{userId:string})=>r.userId===member.id);assert(arrival);assert.equal(arrival.email,member.email);
 assert(!JSON.stringify(await (await otherPastor.client('/api/admin/church-login-inbox')).json()).includes(member.id));
 assert.equal((await member.client(`/api/admin/church-login-inbox/${arrival.id}/handle`,'PATCH',{version:arrival.version})).status,403,'ordinary member cannot handle staff arrival');
 assert.equal((await otherPastor.client(`/api/admin/church-login-inbox/${arrival.id}/handle`,'PATCH',{version:arrival.version})).status,403);
 assert.equal((await pastor.client(`/api/admin/church-login-inbox/${arrival.id}/handle`,'PATCH',{version:arrival.version})).status,200);
 assert.equal((await pastor.client(`/api/admin/church-login-inbox/${arrival.id}/handle`,'PATCH',{version:arrival.version})).status,409);
 assert.equal((await admin.client(`/api/users/${member.id}/profile`,'PATCH',{church:null,expectedChurch:'IM 行動教會'})).status,200);
 assert.equal((await (await member.client('/api/me/church-onboarding')).json()).canChoose,false);
 assert.equal((await member.client('/api/me/church-onboarding','POST',{churchId:'火樂',requestId:randomUUID()})).status,403);
 assert.equal((await admin.client(`/api/users/${member.id}/profile`,'PATCH',{church:'IM 行動教會',expectedChurch:null})).status,200);
 await pool.query("INSERT INTO church_login_daily(church,user_id,day,first_login_at,last_login_at) VALUES('__unassigned',$1,'2000-01-01','2000-01-01','2000-01-01')",[unknown.id]);
 const unassigned=await (await admin.client('/api/admin/church-login-inbox?scope=unassigned')).json();assert(unassigned.days.some((d:{day:string})=>d.day==='2000-01-01'));assert.equal(unassigned.counts.unassignedUnreadDigestDays,1);
 assert.equal((await otherPastor.client('/api/admin/church-login-inbox/days/2000-01-01?scope=unassigned')).status,403);
 assert.equal((await admin.client('/api/admin/church-login-inbox/days/read','POST',{day:'2000-01-01',scope:'unassigned'})).status,200);
 const oldDay='2001-01-01';await pool.query("INSERT INTO church_login_daily(church,user_id,day,first_login_at,last_login_at,login_count) VALUES('IM 行動教會',$1,$2,$2::date,$2::date,2)",[member.id,oldDay]);
 await pool.query("INSERT INTO church_login_daily(church,user_id,day,first_login_at,last_login_at,login_count) VALUES('IM 行動教會',$1,$2,$2::date,$2::date,3)",[leader.id,'2001-01-02']);
 await pool.query("INSERT INTO church_login_daily(church,user_id,day,first_login_at,last_login_at,login_count) VALUES('IM 行動教會',$1,$2,$2::date,$2::date,2)",[member.id,'2001-01-02']);
 const page1=await (await pastor.client('/api/admin/church-login-inbox/days/2001-01-02?limit=1')).json();assert(page1.nextCursor);
 const page2=await (await pastor.client(`/api/admin/church-login-inbox/days/2001-01-02?limit=1&cursor=${page1.nextCursor}`)).json();assert.equal(page2.nextCursor,null);assert.equal(page1.members[0].loginCount+page2.members[0].loginCount,5);assert.notEqual(page1.members[0].userId,page2.members[0].userId);
 const days=await (await pastor.client('/api/admin/church-login-inbox')).json();assert(days.days.some((d:{day:string})=>d.day===oldDay),'old unread day is reachable');
 const detail=await (await pastor.client(`/api/admin/church-login-inbox/days/${oldDay}?limit=1`)).json();assert.equal(detail.members[0].loginCount,2);assert.equal(detail.members[0].userId,member.id);
 assert.equal((await pastor.client('/api/admin/church-login-inbox/days/read','POST',{day:oldDay})).status,200);
 assert.equal((await pastor.client('/api/admin/church-login-inbox/days/read','POST',{day:taipeiToday()})).status,400);
 assert.equal((await admin.client(`/api/users/${member.id}/profile`,'PATCH',{church:'火樂',expectedChurch:'IM 行動教會'})).status,200);
 const departed=await (await pastor.client(`/api/admin/church-login-inbox/days/${oldDay}`)).json();assert.equal(departed.members[0].userId,null);assert.equal(departed.members[0].affiliationChanged,true);
 await pool.query("DELETE FROM user_roles WHERE user_id=$1 AND role='pastor'",[pastor.id]);assert.equal((await pastor.client('/api/admin/church-login-inbox')).status,403);
 await pool.query("INSERT INTO church_member_arrivals(user_id,church,reason,created_at) VALUES($1,'IM 行動教會','first_login','2030-01-01 00:00:00.123456+00'),($2,'IM 行動教會','first_login','2030-01-01 00:00:00.123455+00') ON CONFLICT(user_id,(coalesce(church,''))) DO UPDATE SET created_at=EXCLUDED.created_at,status='pending'",[leader.id,pastor.id]);
 const pagingStaff=await fixture('Paging pastor','IM 行動教會','minister');
 const arrivalPage1=await (await pagingStaff.client('/api/admin/church-login-inbox?limit=1')).json();assert(arrivalPage1.nextCursor);assert.equal(arrivalPage1.arrivals[0].userId,leader.id);
 const arrivalPage2=await (await pagingStaff.client(`/api/admin/church-login-inbox?limit=1&cursor=${encodeURIComponent(arrivalPage1.nextCursor)}`)).json();assert.equal(arrivalPage2.arrivals[0].userId,pastor.id,'microsecond cursor cannot skip same-millisecond arrival');
 const before=(await pool.query('SELECT count(*)::int n FROM church_login_receipts WHERE user_id=$1',[member.id])).rows[0].n;
 assert.equal((await member.client('/api/auth/email-login','POST',{email:member.email,password:member.password})).status,200);
 for(let i=0;i<3;i++)assert.equal((await member.client('/api/auth/user')).status,200);
 assert.equal((await pool.query('SELECT count(*)::int n FROM church_login_receipts WHERE user_id=$1',[member.id])).rows[0].n,before+1,'auth polling does not count as new login');
 // True saved sessions record receipt at original server time even if checked much later.
 const saved=(await pool.query("SELECT sess FROM auth_sessions WHERE sess->'passport'->'user'->>'sessionUserId'=$1 ORDER BY expire DESC LIMIT 1",[member.id])).rows[0].sess;
 const identity=saved.passport.user,midnight='2002-01-01T15:59:59.000Z',receipt=randomUUID();identity.loginReceiptId=receipt;identity.loginReceiptAt=midnight;
 await pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,now()+interval \'1 day\')',[randomUUID(),JSON.stringify(saved)]);
 assert.equal((await pool.query('SELECT day::text FROM church_login_daily WHERE user_id=$1 AND day=\'2002-01-01\'',[member.id])).rowCount,1);
 identity.loginReceiptId=randomUUID();identity.loginReceiptAt=new Date().toISOString();
 await Promise.all([1,2].map(()=>pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,now()+interval \'1 day\')',[randomUUID(),JSON.stringify(saved)])));
 assert.equal((await pool.query('SELECT count(*)::int n FROM church_login_receipts WHERE receipt_id=$1',[identity.loginReceiptId])).rows[0].n,1,'concurrent saves of one receipt are idempotent');
 const mismatchedSid=randomUUID(),mismatchedSave=structuredClone(saved);mismatchedSave.passport.user.sessionUserId=otherPastor.id;
 await assert.rejects(pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,now()+interval \'1 day\')',[mismatchedSid,JSON.stringify(mismatchedSave)]),/Login receipt owner mismatch/);
 assert.equal((await pool.query('SELECT 1 FROM auth_sessions WHERE sid=$1',[mismatchedSid])).rowCount,0);
 assert.equal((await pool.query('SELECT user_id FROM church_login_receipts WHERE receipt_id=$1',[identity.loginReceiptId])).rows[0].user_id,member.id);
 // Atomic receipt failure rolls back session too, including logout/expiry/replacement cases.
 await pool.query("CREATE FUNCTION fail_login_receipt_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic receipt failure'; END $$; CREATE TRIGGER fail_login_receipt_fixture BEFORE INSERT ON church_login_receipts FOR EACH ROW EXECUTE FUNCTION fail_login_receipt_fixture()");
 const failureClient=makeClient();assert.equal((await failureClient('/api/auth/email-login','POST',{email:member.email,password:member.password})).status,503);
 assert.equal((await failureClient('/api/auth/user')).status,401);
 const badSid=randomUUID();identity.loginReceiptId=randomUUID();await assert.rejects(pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,now())',[badSid,JSON.stringify(saved)]));assert.equal((await pool.query('SELECT 1 FROM auth_sessions WHERE sid=$1',[badSid])).rowCount,0);
 await pool.query('DROP TRIGGER fail_login_receipt_fixture ON church_login_receipts; DROP FUNCTION fail_login_receipt_fixture()');
 // SQL durable hook and JS normalization must share every supported alias.
 for(const c of churchCatalog)for(const alias of [c.id,...c.aliases]){
  await pool.query('INSERT INTO church_catalog(id,display_name) VALUES($1,$1) ON CONFLICT DO NOTHING',[alias]);
  await pool.query('UPDATE users SET church=$2 WHERE id=$1',[member.id,alias]);identity.loginReceiptId=randomUUID();identity.loginReceiptAt=new Date().toISOString();
  await pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,now()+interval \'1 day\')',[randomUUID(),JSON.stringify(saved)]);
  assert.equal((await pool.query('SELECT church FROM church_login_receipts WHERE receipt_id=$1',[identity.loginReceiptId])).rows[0].church,c.id);
 }
 console.log('PASS church onboarding: single choice, race/idempotency, permanent lock, staff isolation/revocation, persistent arrivals, unlimited unread dates, daily member privacy, exact login dedupe, original Taipei date, session/receipt atomic rollback and all church aliases');
}
