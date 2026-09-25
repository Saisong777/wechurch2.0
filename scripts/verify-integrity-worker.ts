import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import express from 'express';

const url = new URL(process.env.DATABASE_URL!);
assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
assert.match(url.pathname, /^\/wechurch_integrity_[a-f0-9]{32}$/);
const { pool } = await import('../server/db');
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
try {
  await pool.query('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)');
  const journal = JSON.parse(fs.readFileSync('migrations/meta/_journal.json','utf8')).entries;
  for (const entry of journal) {
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
  const app = express(); app.use(express.json());
  const { registerRoutes } = await import('../server/routes');
  await registerRoutes(app);
  await new Promise<void>(resolve => { server = app.listen(0,'127.0.0.1',resolve); });
  const address = server!.address(); assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const makeClient = () => {
    const cookies = new Map<string,string>();
    return async (path: string, method='GET', body?: unknown) => {
      const response = await fetch(origin+path,{method, headers:{'Content-Type':'application/json',origin,cookie:[...cookies].map(([key,value])=>`${key}=${value}`).join('; ')},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
      for(const cookie of response.headers.getSetCookie()) { const value=cookie.split(';')[0]; const split=value.indexOf('='); cookies.set(value.slice(0,split),value.slice(split+1)); }
      return response;
    };
  };
  const a=makeClient(),b=makeClient(),guest=makeClient(); const ids:string[]=[];
  for (const hidden of ['/uploads/.bible-study/public-20260925-v1/data/core.sqlite', '/uploads/%2ebible-study/public-20260925-v1/NOTICE.md']) {
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
  const empty=await guest('/api/church-reading/today?date=2026-09-13'); assert.equal(empty.status,200);
  const brief=await empty.json();assert.equal(brief.sourceStatus,'unpublished');assert.equal(brief.scriptureReference,'');
  const { verifySupportHttp }=await import('./verify-support-http');
  await verifySupportHttp(pool,a,b,guest,makeClient,ids[0],ids[1]);
  const { verifyMentoringHttp }=await import('./verify-mentoring-http'); await verifyMentoringHttp(pool,makeClient);
  const { verifyLineIdentity }=await import('./verify-line-identity'); await verifyLineIdentity(pool);
  const { verifyImImportHttp }=await import('./verify-im-import-http'); await verifyImImportHttp(pool,a,b,guest,ids);
  const repo=await import('../server/churchDevotionRepository');
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
  const group=(await pool.query('INSERT INTO small_groups(name,church,leader_user_id) VALUES($1,$2,$3) RETURNING id',['Note sharing fixture','Fixture',ids[0]])).rows[0];
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
  const prayerResponse=await b(`/api/personal-prayers/${randomUUID()}`,'PUT',{title:'Private original',prayer:'Never publish this original'});
  assert.equal(prayerResponse.status,200);
  const prayer=await prayerResponse.json();
  assert.equal((await b('/api/prayer-sharing','POST',{items:[{sourceId:prayer.id,title:'Shared title',body:'Shared excerpt'}],groupId:null,publicWall:true,anonymous:true,consent:true})).status,200);
  const deliveries=await (await b('/api/prayer-sharing')).json();
  assert.equal(deliveries.find((item:{prayerId:string})=>item.prayerId===prayer.id)?.content,'Shared title\n\nShared excerpt');
  assert(!JSON.stringify(await (await a('/api/prayer-sharing')).json()).includes(prayer.id));
  console.log('PASS fresh migrations, real HTTP permissions, mentoring, LINE identity, empty schedule and version restore');
} finally {
  if(server) await new Promise<void>(resolve=>server!.close(()=>resolve()));
  await pool.end();
}
process.exit(0);
