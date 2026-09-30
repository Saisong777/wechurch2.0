import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export async function benchmarkCapacity(pool: Pool, origin: string) {
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/wechurch_integrity_[a-f0-9]{32}$/);
  const users = (await pool.query(`INSERT INTO users(email,display_name)
    SELECT 'capacity-'||n||'@example.test','Capacity fixture '||n FROM generate_series(1,5000) n RETURNING id,email`)).rows;
  await pool.query(`INSERT INTO auth_users(id,email,first_name)
    SELECT 'local_'||id,email,display_name FROM users WHERE email LIKE 'capacity-%@example.test'`);
  await pool.query(`INSERT INTO devotional_notes(user_id,verse_reference,verse_text,observation,hidden,created_at)
    SELECT u.id,'約翰福音 3:16','Fixture scripture',repeat('Fixture private reflection. ',20),false,now()-n*interval '1 day'
    FROM users u CROSS JOIN generate_series(1,30) n WHERE email LIKE 'capacity-%@example.test'`);
  await pool.query(`INSERT INTO devotion_wall_posts(source_note_id,user_id,published_day,title,body,reference,expires_at)
    SELECT n.id,n.user_id,(now() AT TIME ZONE 'Asia/Taipei')::date,'Fixture share',repeat('Shared reflection. ',30),'約翰福音 3:16',
    (((now() AT TIME ZONE 'Asia/Taipei')::date+1)::timestamp AT TIME ZONE 'Asia/Taipei')
    FROM (SELECT DISTINCT ON(user_id) id,user_id FROM devotional_notes ORDER BY user_id,created_at DESC) n
    JOIN users u ON u.id=n.user_id WHERE u.email LIKE 'capacity-%@example.test'`);
  await pool.query('ANALYZE users; ANALYZE devotional_notes; ANALYZE devotion_wall_posts; ANALYZE auth_users');
  const cookies: string[] = [];
  for (const user of users.slice(0, 250)) {
    const sid = randomUUID();
    const session = { cookie: { originalMaxAge: 3600000, expires: new Date(Date.now()+3600000).toISOString(), secure: false, httpOnly: true, path: '/', sameSite: 'lax' },
      passport: { user: { claims: { sub: `local_${user.id}`, email: user.email }, sessionUserId: user.id, sessionVersion: 0, expires_at: Math.floor(Date.now()/1000)+3600 } } };
    await pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,now()+interval \'1 hour\')', [sid, JSON.stringify(session)]);
    const signature = createHmac('sha256', process.env.SESSION_SECRET!).update(sid).digest('base64').replace(/=+$/, '');
    cookies.push(`connect.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`);
  }
  const reports = [];
  const headers = { cookie: cookies[0], origin };
  const notesControl = await (await fetch(origin+'/api/devotional-notes', { headers })).json();
  assert.equal(notesControl.length, 30, 'Benchmark must read actual private fixture notes');
  const wallControl = await (await fetch(origin+'/api/devotion-wall', { headers })).json();
  assert.equal(wallControl.posts.length, 30, 'Benchmark must read a populated bounded wall page');
  const chapterControl = await fetch(origin+'/api/bible-study/chapter?book=43&chapter=3', { headers });
  assert.equal(chapterControl.status, 200, 'Benchmark must read valid Bible data');
  assert((await chapterControl.json()).length>20);
  for (const scenario of [{concurrency:25,total:1000},{concurrency:50,total:1000},{concurrency:100,total:1000},{concurrency:250,total:1000},{concurrency:100,total:8000}]) {
    const {concurrency,total} = scenario;
    const times: number[] = []; const writes: number[] = []; const errors: Record<string, number> = {};
    let counter = 0; let bytes = 0; const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, (_, worker) => (async () => {
      while (counter < total) {
        const n = counter++; const write = n % 10 === 9;
        const route = write ? '/api/devotional-notes' : n%10===8 ? '/api/bible-study/chapter?book=43&chapter=3' : n%10>=5 ? '/api/devotion-wall' : '/api/devotional-notes';
        const begin = performance.now();
        try {
          const response = await fetch(origin+route, { method: write?'POST':'GET', headers: { cookie: cookies[worker], origin, 'Content-Type':'application/json' },
            body: write ? JSON.stringify({ verseReference:'約翰福音 3:16',verseText:'Fixture scripture',observation:'Capacity write',clientMutationId:randomUUID() }) : undefined, signal: AbortSignal.timeout(30000) });
          const text = await response.text(); bytes += Buffer.byteLength(text);
          if (!response.ok) errors[String(response.status)] = (errors[String(response.status)] || 0)+1;
          else {
            const data = JSON.parse(text);
            const valid = write ? typeof data.id === 'string' : route.includes('bible-study') ? Array.isArray(data) && data.length>20 : route.includes('devotion-wall') ? data.posts?.length===30 : Array.isArray(data) && data.length>=30;
            if (!valid) errors.invalidPayload = (errors.invalidPayload || 0)+1;
          }
        } catch { errors.network = (errors.network || 0)+1; }
        const elapsed = performance.now()-begin; times.push(elapsed); if(write) writes.push(elapsed);
        // The sustained phase models active readers, while retaining the real shared-IP ingress guard.
        if (total>1000) await new Promise(resolve=>setTimeout(resolve,Math.max(0,800-elapsed)));
      }
    })()));
    times.sort((a,b)=>a-b); writes.sort((a,b)=>a-b);
    const percentile=(a:number[],p:number)=>Math.round(a[Math.min(a.length-1,Math.floor(a.length*p))] || 0);
    const report = { concurrency, requests:total, paced:total>1000, durationSeconds:Math.round((performance.now()-started)/1000), requestsPerSecond:Math.round(total*1000/(performance.now()-started)), p50Ms:percentile(times,.5), p95Ms:percentile(times,.95), p99Ms:percentile(times,.99), writeP95Ms:percentile(writes,.95), errors, responseMB:Math.round(bytes/1048576), rssMB:Math.round(process.memoryUsage().rss/1048576), poolPeakBound:20 };
    reports.push(report); console.log('CAPACITY_RESULT '+JSON.stringify(report));
  }
  console.log('CAPACITY_SCOPE '+JSON.stringify({members:5000,initialPrivateNotes:150000,wallPosts:5000,reports,limitations:['Localhost isolated fixtures, not Railway networking or CPU','Short bursts plus 64-second paced mixed workload, not a 5000-concurrent-user certification','Single-process in-memory rate limits and cache; no failover tested']}));
  assert(reports.every(report=>Object.keys(report.errors).length===0), 'Capacity benchmark recorded HTTP or network failures');
}
