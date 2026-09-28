import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

export async function simulateChurchHistory(pool: Pool, origin: string) {
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/wechurch_integrity_[a-f0-9]{32}$/);
  assert.equal(process.env.NODE_ENV, 'test');
  const users = (await pool.query("SELECT id,email,session_version FROM users WHERE email LIKE 'simulation-%@example.test' ORDER BY email")).rows;
  assert.equal(users.length, 500);
  const before = Number((await pool.query('SELECT count(*) FROM devotional_notes')).rows[0].count);
  await pool.query(`INSERT INTO devotional_notes(user_id,verse_reference,verse_text,observation,hidden,created_at)
    SELECT u.id,'約翰福音 3:16','Synthetic scripture',repeat('Historical private reflection. ',14),false,now()-n*interval '1 day'
    FROM users u CROSS JOIN generate_series(1,180) n WHERE u.email LIKE 'simulation-%@example.test'`);
  await pool.query('ANALYZE devotional_notes');
  assert.equal(Number((await pool.query('SELECT count(*) FROM devotional_notes')).rows[0].count), before + 90000);
  const cookies: string[] = [];
  for (const user of users) {
    const sid = randomUUID(), expires = new Date(Date.now() + 1800000);
    const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: false, httpOnly: true, path: '/', sameSite: 'lax' },
      passport: { user: { claims: { sub: `local_${user.id}`, email: user.email }, sessionUserId: user.id, sessionVersion: user.session_version, expires_at: Math.floor(expires.getTime() / 1000) } } };
    await pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,$3)', [sid, JSON.stringify(session), expires]);
    const signature = createHmac('sha256', process.env.SESSION_SECRET!).update(sid).digest('base64').replace(/=+$/, '');
    cookies.push(`connect.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`);
  }
  console.log('CHURCH_HISTORY seeded 90000 historical notes; 61s ingress cooldown');
  await new Promise(resolve => setTimeout(resolve, 61000));
  const reports: Array<Record<string, unknown>> = [];
  let successfulWrites = 0, failed = false;
  for (const concurrency of [25, 100, 250, 500]) {
    const total = 1000, times: number[] = [], errors: Record<string, number> = {};
    let next = 0, peakRss = 0, peakWaiting = 0, bytes = 0, stop = false;
    const begin = performance.now();
    const sample = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
      peakWaiting = Math.max(peakWaiting, pool.waitingCount);
      if (peakRss > 1536 * 1048576) stop = true;
    }, 20);
    try {
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (next < total && !stop) {
          const n = next++, userIndex = n % 500, write = n % 5 === 4, started = performance.now();
          const route = write ? '/api/devotional-notes' : n % 5 === 3 ? '/api/bible-study/chapter?book=43&chapter=3' : '/api/devotional-notes';
          try {
            const response = await fetch(origin + route, { method: write ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
              headers: { origin, cookie: cookies[userIndex], 'Content-Type': 'application/json' },
              body: write ? JSON.stringify({ verseReference: '約翰福音 3:16', verseText: 'Fixture', observation: 'Aged workload write', clientMutationId: randomUUID() }) : undefined });
            const body = await response.text(); bytes += Buffer.byteLength(body);
            if (response.status !== (write ? 201 : 200)) errors[String(response.status)] = (errors[String(response.status)] || 0) + 1;
            else {
              const data = JSON.parse(body);
              if (write && data.id) successfulWrites++;
              else if (!write && Array.isArray(data) && (route.includes('bible-study') ? data.length > 30 : data.length >= 181 && data.every(row => row.userId === users[userIndex].id))) { /* Valid content and owner. */ }
              else errors.invalidPayload = (errors.invalidPayload || 0) + 1;
            }
          } catch { errors.network = (errors.network || 0) + 1; }
          finally { times.push(performance.now() - started); }
        }
      }));
    } finally { clearInterval(sample); }
    times.sort((a, b) => a - b);
    const p95Ms = Math.round(times[Math.ceil(times.length * .95) - 1]);
    const report = { concurrency, plannedRequests: total, completedRequests: times.length, durationMs: Math.round(performance.now() - begin), p95Ms,
      p99Ms: Math.round(times[Math.ceil(times.length * .99) - 1]), peakRssMB: Math.round(peakRss / 1048576), peakWaiting, uncompressedResponseMB: Math.round(bytes / 1048576), errors,
      passed: !stop && times.length === total && p95Ms < 2000 && Object.keys(errors).length === 0, protectiveStop: stop };
    reports.push(report); failed ||= !report.passed;
    console.log('CHURCH_HISTORY ' + JSON.stringify(report));
    if (stop) break;
  }
  const persisted = Number((await pool.query('SELECT count(*) FROM devotional_notes')).rows[0].count);
  const persistencePassed = persisted === before + 90000 + successfulWrites;
  const directory = path.resolve('output/church-simulation-history', randomUUID());
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'results.json'), JSON.stringify({ at: new Date().toISOString(), members: 500, historicalNotesAdded: 90000, initialNotes: before,
    successfulWrites, persisted, persistencePassed, reports, verdict: failed || !persistencePassed ? 'failed' : 'passed-with-scope-limitations',
    limitations: ['Local client and server share process/RSS; not Railway capacity certification', '500 concurrent HTTP requests, not 500 full browsers', 'Seeded history is synthetic; four brief stages are not a soak or failover test'] }, null, 2));
  console.log('CHURCH_HISTORY_REPORT ' + path.join(directory, 'results.json'));
  assert(persistencePassed, 'Aged workload persistence mismatch');
  assert(!failed, 'Aged church workload failed the engineering latency/error/resource gate');
}
