import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import { contentSecurityPolicy } from '../server/contentSecurityPolicy';

const url = new URL(process.env.DATABASE_URL!);
assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
assert.match(url.pathname, /^\/wechurch_integrity_[a-f0-9]{32}$/);
const { pool } = await import('../server/db');
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
try {
  await pool.query('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)');
  const journal = JSON.parse(fs.readFileSync('migrations/meta/_journal.json','utf8')).entries;
  const legacyIds:string[]=[];
  for (const entry of journal) {
    if(entry.tag==='0029_church_onboarding_logins'&&process.env.RUN_CHURCH_ONBOARDING_ONLY==='1'){
      for(const church of ['IM 行動教會',null,null]){const id=randomUUID();legacyIds.push(id);await pool.query('INSERT INTO users(id,email,church) VALUES($1,$2,$3)',[id,`legacy-${id}@example.test`,church]);}
      await pool.query("INSERT INTO church_affiliation_events(actor_id,user_id,previous_church,next_church) VALUES($1,$1,'火樂',NULL)",[legacyIds[2]]);
    }
    const sql = fs.readFileSync(`migrations/${entry.tag}.sql`, 'utf8');
    const migrationClient=await pool.connect();
    await migrationClient.query('BEGIN');
    try {
      await migrationClient.query(sql);
      await migrationClient.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)',[createHash('sha256').update(sql).digest('hex'),entry.when]);
      await migrationClient.query('COMMIT');
    } catch(error) { await migrationClient.query('ROLLBACK'); throw error; }
    finally { migrationClient.release(); }
  }
  if(legacyIds.length){
    const rows=(await pool.query('SELECT id,church_choice_locked,church_login_seen FROM users WHERE id=ANY($1::uuid[])',[legacyIds])).rows;
    for(const row of rows){assert.equal(row.church_login_seen,true);assert.equal(row.church_choice_locked,row.id!==legacyIds[1]);}
    assert.equal((await pool.query('SELECT count(*)::int n FROM church_member_arrivals WHERE user_id=ANY($1::uuid[])',[legacyIds])).rows[0].n,0);
    console.log('PASS onboarding migration: assigned/cleared-history locked, never-assigned eligible, historical accounts not falsely announced');
  }
  const app = express(); app.use(express.json());
  app.use((_req, res, next) => { res.setHeader('Content-Security-Policy', contentSecurityPolicy()); next(); });
  if (process.env.RUN_SECURITY_BROWSER === '1') {
    app.get('/__test/csp-probe', (_req, res) => res.type('html').send('<main>Content security probe</main>'));
    app.get('/__test/csp-fallback', (_req, res) => res.type('html').send('<div id="root"></div><script src="/load-error.js"></script>'));
  }
  const { registerRoutes } = await import('../server/routes');
  await registerRoutes(app);
  // Production serves the SPA for unmatched paths; uploads must not fall through.
  if (process.env.RUN_SECURITY_BROWSER === '1') {
    assert(fs.existsSync('dist/public/index.html'), 'Build the frontend before browser acceptance');
    app.use(express.static(path.resolve('dist/public')));
    app.use((_req, res) => res.sendFile('index.html', { root: path.resolve('dist/public') }));
  } else app.use((_req, res) => res.status(200).type('html').send('<main>WeChurch</main>'));
  await new Promise<void>(resolve => { server = app.listen(0,'127.0.0.1',resolve); });
  const address = server!.address(); assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  process.env.PUBLIC_BASE_URL = origin;
  const makeClient = (approvedFixture=true) => {
    const cookies = new Map<string,string>();
    return async (path: string, method='GET', body?: unknown) => {
      const multipart = body instanceof FormData;
      const response = await fetch(origin+path,{method, headers:{...(!multipart ? {'Content-Type':'application/json'} : {}),origin,cookie:[...cookies].map(([key,value])=>`${key}=${value}`).join('; ')},body:body===undefined?undefined:multipart?body:JSON.stringify(body),redirect:'manual'});
      for(const cookie of response.headers.getSetCookie()) { const value=cookie.split(';')[0]; const split=value.indexOf('='); cookies.set(value.slice(0,split),value.slice(split+1)); }
      if(approvedFixture&&path==='/api/auth/register'&&response.status===200&&body&&typeof body==='object'&&'email' in body)await pool.query("UPDATE users SET church='IM 行動教會' WHERE email=$1",[(body as {email:string}).email]);
      return response;
    };
  };
  if(process.env.RUN_CHURCH_ONBOARDING_ONLY==='1'){
    const {verifyChurchOnboardingHttp}=await import('./verify-church-onboarding-http');await verifyChurchOnboardingHttp(pool,()=>makeClient(false));
  } else if(process.env.RUN_MULTICHURCH_ONLY==='1'){
    const {verifyMultichurchHttp}=await import('./verify-multichurch-http');await verifyMultichurchHttp(pool,()=>makeClient(false));
    const {verifyMultichurchExtraHttp}=await import('./verify-multichurch-extra-http');await verifyMultichurchExtraHttp(pool,()=>makeClient(false));
    const {verifyMultichurchRacesHttp}=await import('./verify-multichurch-races-http');await verifyMultichurchRacesHttp(pool,()=>makeClient(false));
  } else if (process.env.RUN_CHURCH_SIMULATION === '1') {
    const { simulateChurch } = await import('./simulate-church');
    await simulateChurch(pool, origin);
    if (process.env.RUN_CHURCH_HISTORY === '1') {
      const { simulateChurchHistory } = await import('./simulate-church-history');
      await simulateChurchHistory(pool, origin);
    }
  } else {
  const a=makeClient(),b=makeClient(),guest=makeClient(); const ids:string[]=[];
  const { verifyCareHttp } = await import('./verify-care-http');
  await verifyCareHttp(pool, makeClient);
  const { verifyDevotionShareHttp } = await import('./verify-devotion-share-http');
  await verifyDevotionShareHttp(pool,makeClient);
  const { verifyFeedbackHttp } = await import('./verify-feedback-http');
  await verifyFeedbackHttp(pool, makeClient);
  const { verifyFamilyHttp } = await import('./verify-family-http');
  await verifyFamilyHttp(pool, makeClient);
  const { verifyFamilyDeleteHttp } = await import('./verify-family-delete-http');
  await verifyFamilyDeleteHttp(pool, makeClient);
  const { verifyNotificationsHttp } = await import('./verify-notifications-http');
  await verifyNotificationsHttp(pool,makeClient);
  for (const hidden of ['/uploads/.bible-study/public-20260925-v1/data/core.sqlite', '/uploads/%2ebible-study/public-20260925-v1/NOTICE.md', '/uploads/%2Ebible-study/public-20260925-v1/data/core.sqlite', '/uploads/%252ebible-study/public-20260925-v1/NOTICE.md', '/uploads/missing-file.png']) {
    assert.equal((await guest(hidden)).status, 404);
  }
  for(const client of [a,b]) {
    const email=`integrity-${randomUUID()}@example.test`;
    const response=await client('/api/auth/register','POST',{email,password:randomUUID(),displayName:'Integrity fixture'});
    assert.equal(response.status,200);
    ids.push((await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id);
  }
  const role = await pool.query("UPDATE user_roles SET role='leader' WHERE user_id=$1",[ids[0]]);
  if (!role.rowCount) await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'leader')",[ids[0]]);
  const { verifyRetiredAiHttp } = await import('./verify-retired-ai-http');
  await verifyRetiredAiHttp(pool, a, b, guest, ids[0]);
  const { verifyAuditBoundaries } = await import('./verify-audit-boundaries');
  await verifyAuditBoundaries(pool, a, guest, ids[0], ids[1]);
  assert.equal((await guest('/api/church-reading/today?date=2026-09-13')).status,401);
  const empty=await a('/api/church-reading/today?date=2026-09-13'); assert.equal(empty.status,200);
  const brief=await empty.json();assert.equal(brief.sourceStatus,'unpublished');assert.equal(brief.scriptureReference,'');
  const { verifySupportHttp }=await import('./verify-support-http');
  await verifySupportHttp(pool,a,b,guest,makeClient,ids[0],ids[1]);
  // Existing support fixtures explicitly enable pastoral_beta for mentoring checks.
  const { verifyCoLeadersHttp } = await import('./verify-co-leaders-http');
  await verifyCoLeadersHttp(pool, makeClient);
  const { verifyMentoringHttp }=await import('./verify-mentoring-http'); await verifyMentoringHttp(pool,makeClient);
  const { verifyLineIdentity }=await import('./verify-line-identity'); await verifyLineIdentity(pool);
  const { verifyImImportHttp }=await import('./verify-im-import-http'); await verifyImImportHttp(pool,a,b,guest,ids);
  const nativeRepo=await import('../server/churchDevotionRepository');
  const {runChurchContext}=await import('../server/churchContext');
  const repo=new Proxy(nativeRepo,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function'||key==='DevotionConflict')return value;return async(...args:unknown[])=>{const actor=(await pool.query("SELECT church,EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role='admin') AS admin FROM users WHERE id=$1",[ids[0]])).rows[0];return runChurchContext({actorId:ids[0],actorChurch:actor.church,selectedChurch:actor.church,isSystemAdmin:actor.admin},()=>Reflect.apply(value,target,args));};}});
  const input={date:'2026-09-13',planName:'Fixture',dayNumber:1,scriptureReference:'以賽亞書 1',scriptureText:'',devotionalTitle:'Original',devotionalText:'Original body',prayer:'',loveAction:'',status:'published' as const};
  const original=await repo.saveChurchDevotion(ids[0],input);
  const history=await repo.churchDevotionHistory(original.id);
  const edited=await repo.saveChurchDevotion(ids[0],{...input,devotionalTitle:'Changed'},original.id,original.version);
  const restored=await repo.restoreChurchDevotion(ids[0],original.id,history[0].id,edited.version);
  assert.equal(restored.devotionalTitle,'Original'); assert.equal(restored.status,'draft');assert.equal(restored.version,3);
  await assert.rejects(repo.restoreChurchDevotion(ids[0],original.id,history[0].id,edited.version));
  await assert.rejects(repo.restoreChurchDevotion(ids[0],original.id,randomUUID(),restored.version));
  const preview=await repo.previewDevotionImport(ids[0],[{row:2,entry:input}],'replace');assert.equal(preview.rows[0].before?.version,3);
  const mutationId=randomUUID();
  const noteBody={verseReference:'以賽亞書 43',verseText:'Fixture scripture',observation:'original',clientMutationId:mutationId};
  const created=await b('/api/devotional-notes','POST',noteBody); assert.equal(created.status,201);
  const note=await created.json();assert.equal(note.version,1);
  const savedBible=await b('/api/saved-verses','POST',{userId:ids[0],verseReference:'創世記 1:1（Biblica® 當代譯本開放資源（繁體））',verseText:'Fixture text',bookName:'創世記',chapter:1,verseStart:1,notes:'Fixture attribution'});
  assert.equal(savedBible.status,201);
  const savedBibleId=(await savedBible.json()).id;
  assert((await (await b('/api/saved-verses')).json()).some((v:{id:string})=>v.id===savedBibleId));
  assert(!(await (await a('/api/saved-verses')).json()).some((v:{id:string})=>v.id===savedBibleId));
  assert.equal((await guest('/api/saved-verses')).status,401);
  assert.equal((await a(`/api/saved-verses/${savedBibleId}`,'DELETE')).status,200);
  assert((await (await b('/api/saved-verses')).json()).some((v:{id:string})=>v.id===savedBibleId));
  assert.equal((await b(`/api/saved-verses/${savedBibleId}`,'DELETE')).status,200);
  assert.equal((await b('/api/devotional-notes','POST',noteBody)).status,201);
  assert.equal((await b(`/api/devotional-notes/${note.id}`,'PATCH',{observation:'missing version'})).status,428);
  assert.equal((await b(`/api/devotional-notes/${note.id}`,'PATCH',{observation:'updated',version:1})).status,200);
  assert.equal((await b(`/api/devotional-notes/${note.id}`,'PATCH',{observation:'stale overwrite',version:1})).status,409);
  assert.equal((await b('/api/devotional-notes','POST',noteBody)).status,409);
  assert.equal((await a(`/api/devotional-notes/${note.id}`,'PATCH',{observation:'other account',version:2})).status,409);
  assert.equal((await pool.query('SELECT observation FROM devotional_notes WHERE id=$1',[note.id])).rows[0].observation,'updated');
  const group=(await pool.query('INSERT INTO small_groups(name,church,leader_user_id) VALUES($1,$2,$3) RETURNING id',['Note sharing fixture','IM 行動教會',ids[0]])).rows[0];
  const groupShareId=randomUUID();
  const groupSharePath=`/api/life-groups/${group.id}/shares/${groupShareId}`;
  const groupShareBody={kind:'note',sourceId:note.id,title:'Group excerpt',body:'Only selected note text',reference:'以賽亞書 43',anonymous:false,consent:true};
  assert(!(await (await b('/api/life-groups')).json()).groups.some((item:{id:string})=>item.id===group.id));
  assert.equal((await b(groupSharePath,'PUT',groupShareBody)).status,404);
  assert.equal((await guest(groupSharePath,'PUT',groupShareBody)).status,401);
  await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2)',[group.id,ids[1]]);
  assert((await (await b('/api/life-groups')).json()).groups.some((item:{id:string})=>item.id===group.id));
  assert.equal((await a(`/api/life-groups/${group.id}/shares/${randomUUID()}`,'PUT',groupShareBody)).status,404);
  assert.equal((await b(groupSharePath,'PUT',{...groupShareBody,consent:false})).status,400);
  const publicBefore=(await (await b('/api/devotion-wall/mine')).json()).posts.length;
  assert.equal((await b(groupSharePath,'PUT',groupShareBody)).status,200);
  assert.equal((await b(groupSharePath,'PUT',groupShareBody)).status,200);
  const groupShares=await (await a(`/api/life-groups/${group.id}/shares?kind=note`)).json();
  assert.equal(groupShares.filter((item:{id:string})=>item.id===groupShareId).length,1);
  assert.equal(groupShares.find((item:{id:string})=>item.id===groupShareId).body,groupShareBody.body);
  assert.equal((await (await b('/api/devotion-wall/mine')).json()).posts.length,publicBefore);
  assert.equal((await pool.query('SELECT observation FROM devotional_notes WHERE id=$1',[note.id])).rows[0].observation,'updated');
  assert.equal((await a(`/api/life-groups/${group.id}/members/${ids[1]}`,'DELETE')).status,200);
  assert.equal((await b(`/api/life-groups/${group.id}/shares?kind=note`)).status,404);
  assert.equal((await b(groupSharePath,'PUT',groupShareBody)).status,404);
  console.log('PASS note group sharing: membership, source ownership, consent, private original, no wall delivery, idempotent retry and removed-member denial');
  const window=await (await b('/api/devotion-wall/window')).json();
  const posted=await b('/api/devotion-wall','POST',{sourceId:note.id,day:window.day,title:'Fixture share',body:'Explicit excerpt only',reference:'以賽亞書 43',anonymous:true,consent:true});
  assert.equal(posted.status,201);
  const post=await posted.json();
  const mine=await (await b('/api/devotion-wall/mine')).json();
  assert(mine.posts.some((item:{id:string})=>item.id===post.id));
  assert(!(await (await a('/api/devotion-wall/mine')).json()).posts.some((item:{id:string})=>item.id===post.id));
  assert.equal((await guest('/api/devotion-wall/mine')).status,401);
  assert.equal((await a(`/api/devotion-wall/${post.id}`,'DELETE')).status,404);
  assert.equal((await b(`/api/devotion-wall/${post.id}`,'DELETE')).status,200);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM devotional_notes WHERE id=$1',[note.id])).rows[0].n,1);
  const deletePath=`/api/devotional-notes/${note.id}`;
  assert.equal((await guest(deletePath,'DELETE',{version:2})).status,401);
  assert.equal((await a(deletePath,'DELETE',{version:2})).status,404);
  assert.equal((await b(deletePath,'DELETE',{})).status,428);
  assert.equal((await b(deletePath,'DELETE',{version:1})).status,409);
  assert.equal((await b('/api/devotional-notes/not-a-uuid','DELETE',{version:2})).status,400);
  await pool.query(`CREATE FUNCTION fail_note_delete_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic delete failure'; END $$;
    CREATE TRIGGER fail_note_delete_fixture BEFORE DELETE ON devotional_notes FOR EACH ROW EXECUTE FUNCTION fail_note_delete_fixture()`);
  assert.equal((await b(deletePath,'DELETE',{version:2})).status,503);
  assert.equal((await b(deletePath)).status,200);
  assert.equal((await pool.query('SELECT withdrawn_at FROM life_group_shares WHERE id=$1',[groupShareId])).rows[0].withdrawn_at,null);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM devotional_note_deletions WHERE note_id=$1',[note.id])).rows[0].n,0);
  await pool.query('DROP TRIGGER fail_note_delete_fixture ON devotional_notes; DROP FUNCTION fail_note_delete_fixture()');
  assert.equal((await b(deletePath,'DELETE',{version:2})).status,200);
  assert.equal((await b(deletePath,'DELETE',{version:2})).status,200);
  assert.equal((await a(deletePath,'DELETE',{version:2})).status,404);
  assert.equal((await b(deletePath)).status,404);
  assert.equal((await b('/api/devotional-notes','POST',noteBody)).status,409);
  assert.equal((await b('/api/devotion-wall','POST',{sourceId:note.id,day:window.day,title:'Deleted source',body:'Should not publish',reference:'Fixture',anonymous:true,consent:true})).status,404);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM devotion_wall_posts WHERE source_note_id=$1',[note.id])).rows[0].n,0);
  const removedShare=(await pool.query('SELECT withdrawn_at,body,source_id FROM life_group_shares WHERE id=$1',[groupShareId])).rows[0];
  assert(removedShare.withdrawn_at);assert.equal(removedShare.body,'');assert.equal(removedShare.source_id,null);
  console.log('PASS note deletion: owner-only, version conflict, retry, share cleanup and stale-save protection');
  const prayerResponse=await b(`/api/personal-prayers/${randomUUID()}`,'PUT',{title:'Private original',prayer:'Never publish this original'});
  assert.equal(prayerResponse.status,200);
  const prayer=await prayerResponse.json();
  assert.equal((await b('/api/prayer-sharing','POST',{items:[{sourceId:prayer.id,title:'Shared title',body:'Shared excerpt'}],groupId:null,publicWall:true,anonymous:true,consent:true})).status,200);
  const deliveries=await (await b('/api/prayer-sharing')).json();
  assert.equal(deliveries.find((item:{prayerId:string})=>item.prayerId===prayer.id)?.content,'Shared title\n\nShared excerpt');
  assert(!JSON.stringify(await (await a('/api/prayer-sharing')).json()).includes(prayer.id));
  const { verifyPersonalPrayerHttp } = await import('./verify-personal-prayer-http');
  await verifyPersonalPrayerHttp(a,b,guest,prayer,deliveries.find((item:{prayerId:string})=>item.prayerId===prayer.id).postId);
  console.log('PASS fresh migrations, real HTTP permissions, mentoring, LINE identity, empty schedule and version restore');
  const { verifyBoundarySecurity } = await import('./verify-boundary-security');
  await verifyBoundarySecurity(pool, a, b, guest, makeClient, ids);
  const { runSecurityAccessRegressions } = await import('./security-access-regressions');
  await runSecurityAccessRegressions();
  const { verifyAuthSecurityHttp } = await import('./verify-auth-security-http');
  console.log(await verifyAuthSecurityHttp(pool, origin, makeClient));
  if (process.env.RUN_CAPACITY_BENCHMARK === '1') {
    const { benchmarkCapacity } = await import('./benchmark-capacity');
    await benchmarkCapacity(pool, origin);
  }
  if (process.env.RUN_SECURITY_BROWSER === '1') {
    const { verifySecurityBrowser } = await import('./verify-security-browser');
    await verifySecurityBrowser(pool, origin, ids[0]);
  }
  const { verifyLeaderDashboardHttp } = await import('./verify-leader-dashboard-http');
  await verifyLeaderDashboardHttp(pool, makeClient);
  const { verifyEmailPermissions } = await import('./verify-email-permissions');
  await verifyEmailPermissions(pool, makeClient);
  const { verifyAccessControl } = await import('./verify-access-control');
  await verifyAccessControl(pool, makeClient);
  const {verifyMultichurchHttp}=await import('./verify-multichurch-http');await verifyMultichurchHttp(pool,()=>makeClient(false));
    const {verifyMultichurchExtraHttp}=await import('./verify-multichurch-extra-http');await verifyMultichurchExtraHttp(pool,()=>makeClient(false));
    const {verifyMultichurchRacesHttp}=await import('./verify-multichurch-races-http');await verifyMultichurchRacesHttp(pool,()=>makeClient(false));

  }
} finally {
  if(server) await new Promise<void>(resolve=>server!.close(()=>resolve()));
  await pool.end();
}
process.exit(0);
