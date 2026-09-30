import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import os from 'node:os';
import path from 'node:path';
import type { Pool } from 'pg';
import { taipeiToday } from '../shared/churchDevotion';

type Json = Record<string, any>;
type Actor = { id: string; email: string; cookie: string; role: string; note?: Json; prayer?: Json; contact?: Json };
type Scenario = { name: string; status: 'passed' | 'failed'; requests: number; durationMs: number; error?: string };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Every request is a real session-authenticated HTTP request to a disposable database.
// Fixture sessions intentionally do not claim to test the external Google consent flow.
export async function simulateChurch(pool: Pool, origin: string) {
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.DISABLE_OUTBOUND_EMAIL, '1');
  assert.equal(process.env.DISABLE_MORNING_BRIEF, '1');
  const dbName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  assert.match(dbName, /^wechurch_integrity_[a-f0-9]{32}$/);
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, dbName);
  assert.equal(Number((await pool.query('SELECT count(*) FROM users')).rows[0].count), 0);
  const runId = randomUUID(), directory = path.resolve('output/church-simulation', runId);
  await mkdir(directory, { recursive: true });
  const start = new Date(), cases: Scenario[] = [], loads: Json[] = [];
  const counts: Record<string, number> = {};
  let requests = 0;
  let loadPhase = false;
  const writeTimes = new Map<string, number[]>();
  const actors: Actor[] = [], groups: string[] = [], assignments: string[] = [];
  const today = taipeiToday(), dashboard = '/api/life-groups/dashboard';
  let devotion: Json;
  async function call(actor: Actor | null, route: string, method = 'GET', body?: unknown) {
    if (!loadPhase && actor && method !== 'GET') {
      const times = (writeTimes.get(actor.id) || []).filter(t => Date.now() - t < 60000);
      if (times.length >= 90) await sleep(Math.max(0, 60050 - (Date.now() - times[0])));
      writeTimes.set(actor.id, [...times.filter(t => Date.now() - t < 60000), Date.now()]);
    }
    requests++;
    const response = await fetch(origin + route, { method, redirect: 'manual', signal: AbortSignal.timeout(30000),
      headers: { origin, cookie: actor?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    const data = text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
    counts[String(response.status)] = (counts[String(response.status)] || 0) + 1;
    return { status: response.status, data, headers: response.headers };
  }
  async function ok(actor: Actor | null, route: string, method = 'GET', body?: unknown, expected = 200): Promise<any> {
    const result = await call(actor, route, method, body);
    assert.equal(result.status, expected, `${method} ${route}: expected ${expected}, received ${result.status}`);
    return result.data;
  }
  async function scenario(name: string, work: () => Promise<void>) {
    const begin = performance.now(), before = requests;
    try { await work(); cases.push({ name, status: 'passed', requests: requests - before, durationMs: Math.round(performance.now() - begin) }); }
    catch (error) { cases.push({ name, status: 'failed', requests: requests - before, durationMs: Math.round(performance.now() - begin), error: error instanceof Error ? error.message.slice(0, 700) : 'Unknown failure' }); }
    console.log('CHURCH_SCENARIO ' + JSON.stringify(cases.at(-1)));
  }
  async function concurrent<T>(values: T[], limit: number, work: (value: T, index: number) => Promise<void>) {
    let next = 0;
    const failures: unknown[] = [];
    await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const index = next++;
        try { await work(values[index], index); } catch (error) { failures.push(error); }
      }
    }));
    if (failures.length) throw new Error(`${failures.length}/${values.length} actors failed: ${String(failures[0]).slice(0, 600)}`);
  }
  try {
    for (let i = 0; i < 500; i++) {
      const role = i < 450 ? (i % 15 === 0 ? 'group_leader' : 'member') : i < 455 ? 'pastor' : ['senior_pastor', 'admin', 'minister', 'future_leader', 'leader'][i - 455] || 'member';
      const id = randomUUID(), email = `simulation-${i}@example.test`, sid = randomUUID();
      const session = { cookie: { originalMaxAge: 3600000, expires: new Date(Date.now() + 3600000).toISOString(), secure: false, httpOnly: true, path: '/', sameSite: 'lax' },
        passport: { user: { claims: { sub: `local_${id}`, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(Date.now() / 1000) + 3600 } } };
      await pool.query("INSERT INTO users(id,email,display_name,church) VALUES($1,$2,$3,'IM 行動教會')", [id, email, `模擬會友 ${String(i + 1).padStart(3, '0')}`]);
      await pool.query('INSERT INTO auth_users(id,email,first_name) VALUES($1,$2,$3)', [`local_${id}`, email, `Simulation ${i}`]);
      await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [id, role]);
      await pool.query("INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,now()+interval '1 hour')", [sid, JSON.stringify(session)]);
      const signature = createHmac('sha256', process.env.SESSION_SECRET!).update(sid).digest('base64').replace(/=+$/, '');
      actors.push({ id, email, role, cookie: `connect.sid=${encodeURIComponent(`s:${sid}.${signature}`)}` });
    }
    const senior = actors[455], admin = actors[456];
    await scenario('500 independent sessions and unassigned newcomers', async () => {
      await concurrent(actors, 10, async actor => {
        assert.equal((await ok(actor, '/api/auth/user')).legacyUserId, actor.id);
        assert.equal((await ok(actor, '/api/life-groups')).groups.length, 0);
      });
      await ok(null, '/api/devotional-notes', 'GET', undefined, 401);
    });
    await scenario('30 families / 450 members / 5 area responsibility scopes', async () => {
      for (let g = 0; g < 30; g++) {
        const name = `模擬牧區 ${Math.floor(g / 6) + 1} 小家 ${g + 1}`;
        // Model already-established homes. Creation/leadership handoff is separately
        // exercised by verify-family-http; an administrative creator is not an attendee.
        const group = (await pool.query("INSERT INTO small_groups(name,church,leader_user_id) VALUES($1,'IM 行動教會',$2) RETURNING id", [name, actors[g * 15].id])).rows[0];
        groups.push(group.id);
        for (const actor of actors.slice(g * 15, g * 15 + 15)) await pool.query("INSERT INTO small_group_members(group_id,user_id,history_from,joined_at) VALUES($1,$2,now()-interval '30 days',now()-interval '30 days')", [group.id, actor.id]);
        await ok(senior, `/api/life-groups/management/${group.id}`, 'PATCH', { version: 1, name, description: 'Synthetic family', meeting: 'Friday', announcement: 'PRIVATE_MEETING_ADDRESS', listed: true, status: 'active', leaderId: actors[g * 15].id });
        const assignment = await ok(senior, '/api/crm/scope-assignments', 'POST', { assigneeUserId: actors[450 + Math.floor(g / 6)].id, scopeType: 'group', groupId: group.id, canManageCare: true, canManageMembers: true, canViewPersonal: false }, 201);
        assignments.push(assignment.id);
      }
      assert.equal(groups.length, 30);
      const directory = await ok(actors[460], '/api/life-groups/directory');
      assert.equal(directory.groups.length, 30);
      assert(!JSON.stringify(directory).includes('PRIVATE_MEETING_ADDRESS'));
      for (let p = 0; p < 5; p++) {
        const result = await ok(actors[450 + p], dashboard);
        assert.deepEqual(result.groups.map((g: Json) => g.id).sort(), groups.slice(p * 6, p * 6 + 6).sort());
        const roster = await ok(actors[450 + p], '/api/users?church=all');
        const allowed = new Set([...actors.slice(p * 90, p * 90 + 90).map(a => a.id), actors[450 + p].id]);
        assert(roster.length >= 90 && roster.every((u: Json) => allowed.has(u.id)));
        assert(roster.filter((u: Json) => u.id !== actors[450 + p].id).every((u: Json) => !('email' in u)));
        await ok(actors[450 + p], `${dashboard}?scope=${groups[(p * 6 + 6) % 30]}`, 'GET', undefined, 404);
      }
      assert.equal((await ok(admin, dashboard)).groups.length, 0);
      assert.equal((await ok(senior, dashboard)).groups.length, 30);
      const pastor = actors[450], person = actors[1];
      await ok(pastor, `/api/users/${person.id}/profile`, 'GET', undefined, 403);
      const personalGrant = await ok(senior, '/api/crm/scope-assignments', 'POST', { assigneeUserId: pastor.id, scopeType: 'member', memberUserId: person.id, canViewPersonal: true, canManageCare: false, canManageMembers: false }, 201);
      await ok(pastor, `/api/users/${person.id}/profile`);
      const roster = await ok(pastor, '/api/users?church=all');
      assert.equal(roster.find((u: Json) => u.id === person.id).email, person.email);
      assert(roster.filter((u: Json) => u.id !== person.id && u.id !== pastor.id).every((u: Json) => !('email' in u)));
      await ok(senior, `/api/crm/scope-assignments/${personalGrant.id}`, 'DELETE');
      await ok(pastor, `/api/users/${person.id}/profile`, 'GET', undefined, 403);
    });
    assert.equal(groups.length, 30, 'Family setup must complete before dependent scenarios');
    await scenario('Published daily devotion, version conflict and invalid date', async () => {
      const body = { date: today, planName: 'Simulation daily reading', dayNumber: 1, scriptureReference: '約翰福音 3:16', scriptureText: 'Synthetic scripture fixture', devotionalTitle: 'Simulation devotion', devotionalText: 'Synthetic teaching content', prayer: 'Synthetic prayer', loveAction: 'Encourage someone', status: 'published' };
      devotion = await ok(senior, '/api/admin/church-devotions', 'POST', body, 201);
      await ok(actors[1], '/api/admin/church-devotions', 'POST', body, 403);
      await ok(senior, '/api/admin/church-devotions', 'POST', { ...body, date: '2026-02-30' }, 400);
      assert.equal((await ok(null, '/api/church-reading/today')).devotionalTitle, body.devotionalTitle);
    });
    await scenario('Licensed Bible assets, four translations, commentary, original text and cross references', async () => {
      const { verifyAssets } = await import('./bible-study-assets.mjs');
      verifyAssets(path.resolve('bible-study-data'));
      const info = await ok(actors[1], '/api/bible-study/info');
      for (const translation of Object.keys(info.translations)) {
        const chapter = await ok(actors[1], `/api/bible-study/chapter?book=43&chapter=3&translation=${translation}`);
        assert(chapter.length >= 30 && chapter.every((v: Json) => v.body && v.license));
      }
      const notes = await ok(actors[1], '/api/bible-study/notes?book=43&chapter=3&verse=16');
      assert(notes.length > 0);
      for (const source of info.note_sources) assert(Array.isArray(await ok(actors[1], `/api/bible-study/notes?book=43&chapter=3&verse=16&source=${source}`)));
      const hebrew = await ok(actors[1], '/api/bible-study/tokens?book=1&chapter=1&verse=1');
      assert(hebrew.tokens.length > 0 && hebrew.language === 'he');
      const greek = await ok(actors[1], '/api/bible-study/tokens?book=43&chapter=3&verse=16');
      assert(greek.tokens.length > 0 && greek.language === 'el');
      assert((await ok(actors[1], '/api/bible-study/dictionary?term=G26')).length > 0);
      const refs = await ok(actors[1], '/api/bible-study/xrefs?book=43&chapter=3&verse=16');
      assert(refs.length > 0);
      assert((await ok(actors[1], `/api/bible-study/preview?start=${refs[0].start}&end=${refs[0].end}`)).verses.length > 0);
      const search = await ok(actors[1], '/api/bible-study/search?q=' + encodeURIComponent('神愛世人'));
      assert(search.length > 0);
      assert((await ok(actors[1], '/api/bible-study/item?id=' + encodeURIComponent(search[0].id))).body);
      await ok(actors[1], '/api/bible-study/chapter?book=999&chapter=1', 'GET', undefined, 400);
      await ok(actors[1], '/api/bible-study/chapter?book=43&book=1', 'GET', undefined, 400);
      await ok(actors[1], '/data/core.sqlite', 'GET', undefined, 404);
    });
    await scenario('500 people: private notes, prayers, grace, contacts and bookmarks', async () => {
      await concurrent(actors, 10, async (actor, i) => {
        const token = `PRIVATE_${i}_`;
        actor.note = await ok(actor, '/api/devotional-notes', 'POST', { verseReference: '約翰福音 3:16', verseText: 'Fixture', observation: token + 'OBSERVATION', application: token + 'APPLICATION', clientMutationId: randomUUID() }, 201);
        actor.prayer = await ok(actor, `/api/personal-prayers/${randomUUID()}`, 'PUT', { title: `Prayer ${i}`, prayer: token + 'PRAYER' });
        actor.contact = await ok(actor, '/api/care/contacts', 'POST', { name: `Contact ${i}`, need: token + 'NEED' }, 201);
        await ok(actor, '/api/saved-verses', 'POST', { verseReference: '約翰福音 3:16', verseText: 'Fixture', bookName: '約翰福音', chapter: 3, verseStart: 16, notes: token + 'BOOKMARK' }, 201);
        await ok(actor, `/api/personal-prayers/${randomUUID()}`, 'PUT', { title: `Grace ${i}`, prayer: token + 'GRACE', recordKind: 'grace', occurredOn: today, status: 'answered', responseType: 'grace' });
      });
    });
    await scenario('500 owners: readback and next-account IDOR denial', async () => {
      await concurrent(actors, 10, async (actor, i) => {
        const next = actors[(i + 1) % actors.length];
        const notes = await ok(actor, '/api/devotional-notes');
        assert.equal(notes.length, 1); assert.equal(notes[0].id, actor.note!.id); assert.equal(notes[0].observation, `PRIVATE_${i}_OBSERVATION`);
        const prayers = await ok(actor, '/api/personal-prayers');
        assert.equal(prayers.length, 2); assert(prayers.some((p: Json) => p.id === actor.prayer!.id));
        const contacts = await ok(actor, '/api/care/contacts');
        assert.equal(contacts.length, 1); assert.equal(contacts[0].id, actor.contact!.id);
        const bookmarks = await ok(actor, '/api/saved-verses');
        assert.equal(bookmarks.length, 1); assert.equal(bookmarks[0].notes, `PRIVATE_${i}_BOOKMARK`);
        await ok(next, `/api/devotional-notes/${actor.note!.id}`, 'PATCH', { version: 1, observation: 'ATTACK' }, 409);
        await ok(next, `/api/care/contacts/${actor.contact!.id}/actions`, 'GET', undefined, 404);
        await ok(next, `/api/personal-prayers/${actor.prayer!.id}`, 'PATCH', { ...actor.prayer, expectedUpdatedAt: actor.prayer!.updatedAt, prayer: 'ATTACK' }, 404);
      });
      assert.equal(Number((await pool.query("SELECT count(*) FROM devotional_notes WHERE observation='ATTACK'")).rows[0].count), 0);
    });
    await scenario('450 readers: group reading, selected excerpt, anonymous prayer and cross-family denial', async () => {
      await concurrent(actors.slice(0, 450), 10, async (actor, i) => {
        const group = groups[Math.floor(i / 15)];
        await ok(actor, `/api/life-groups/${group}/reading/${devotion.id}`, 'PUT', { version: devotion.version, done: true });
        await ok(actor, `/api/life-groups/${group}/shares/${randomUUID()}`, 'PUT', { kind: 'note', sourceId: actor.note!.id, title: `Shared ${i}`, body: `EXPLICIT_EXCERPT_${i}`, consent: true });
        await ok(actor, `/api/life-groups/${group}/shares/${randomUUID()}`, 'PUT', { kind: 'prayer', sourceId: actor.prayer!.id, title: 'Anonymous prayer', body: `EXPLICIT_PRAYER_${i}`, anonymous: true, consent: true });
        await ok(actor, `/api/life-groups/${groups[(Math.floor(i / 15) + 1) % 30]}/shares?kind=all`, 'GET', undefined, 404);
      });
      for (let g = 0; g < 30; g++) {
        const feed = await ok(actors[g * 15], `/api/life-groups/${groups[g]}/shares?kind=all`);
        assert.equal(feed.length, 30); assert(!JSON.stringify(feed).includes('PRIVATE_'));
        const anonymous = feed.find((p: Json) => p.kind === 'prayer' && !p.isOwner);
        assert.equal(anonymous.authorId, null); assert.equal(anonymous.authorName, '匿名');
        await ok(actors[g * 15], `/api/life-groups/${groups[g]}/shares/${anonymous.id}/comments/${randomUUID()}`, 'PUT', { body: 'Praying together' });
      }
    });
    await scenario('30 leaders: attendance, shared care, read-only scope privacy', async () => {
      for (let g = 0; g < 30; g++) {
        const leader = actors[g * 15], group = groups[g], meeting = randomUUID();
        const roster = await ok(leader, `${dashboard}/${group}/roster`);
        assert.equal(roster.length, 15);
        const route = `${dashboard}/${group}/gatherings/${meeting}`;
        await ok(leader, route, 'PUT', { date: today, kind: 'group', roster: roster.map((r: Json) => r.key) });
        const detail = await ok(leader, route);
        assert.equal(detail.counts.unrecorded, 15); assert.equal(detail.counts.absent, 0);
        await ok(leader, route, 'PATCH', { version: detail.version, entries: detail.entries.map((r: Json, n: number) => ({ key: r.key, status: n < 12 ? 'present' : n === 12 ? 'excused' : 'unrecorded' })), visitors: 2, cancelled: false });
        const final = await ok(leader, route);
        assert.deepEqual(final.counts, { present: 12, excused: 1, absent: 0, unrecorded: 2 });
        await ok(leader, `/api/life-groups/${group}/care/${randomUUID()}`, 'PUT', { name: `Shared care ${g}`, need: 'Approved excerpt', dueDate: today, consent: true });
        const overview = await ok(leader, `${dashboard}?scope=${group}`);
        assert.equal(overview.care.active, 1);
        const pastor = await ok(actors[450 + Math.floor(g / 6)], `${dashboard}?scope=${group}`);
        assert.equal(pastor.care.active, 0, 'Responsibility grant does not grant shared private content');
        assert.equal(pastor.gatherings[0].counts.present, 12);
        await ok(actors[g * 15 + 1], route, 'GET', undefined, 404);
      }
    });
    await scenario('30 urgent referrals: explicit excerpt, central pastoral inbox, conflict and cancellation', async () => {
      for (let g = 0; g < 30; g++) {
        const actor = actors[g * 15 + 1], pastor = actors[450 + Math.floor(g / 6)], id = randomUUID();
        const route = `/api/care-visits/${id}`;
        const input = { contactId: actor.contact!.id, name: `Visit ${g}`, reason: 'APPROVED_VISIT_REASON', contactMethod: 'Contact the requester', urgency: 'urgent', consent: true };
        await ok(actor, route, 'PUT', { ...input, consent: false }, 400);
        await ok(actor, route, 'PUT', input);
        await ok(actor, route, 'PUT', input);
        const inbox = await ok(pastor, '/api/care-visits?mode=inbox');
        assert(inbox.requests.some((r: Json) => r.id === id)); assert(!JSON.stringify(inbox).includes('PRIVATE_'));
        await ok(actors[(g * 15 + 16) % 450], `/api/care-visits/${id}/events`, 'GET', undefined, 404);
        const assignment = { version: 1, status: 'assigned', assigneeId: pastor.id, dueDate: today, note: 'Arrange a visit' };
        const race = await Promise.all([call(pastor, route, 'PATCH', assignment), call(pastor, route, 'PATCH', assignment)]);
        assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
        await ok(actor, route, 'PATCH', { ...assignment, version: 2, status: 'cancelled' });
        await ok(pastor, route, 'PATCH', { ...assignment, version: 3, status: 'completed' }, 409);
      }
    });
    await scenario('30 public prayers: anonymous reactions, encouragement, answered closure and private retention', async () => {
      for (let g = 0; g < 30; g++) {
        const actor = actors[g * 15 + 1], other = actors[(g * 15 + 16) % 450];
        await ok(actor, '/api/prayer-sharing', 'POST', { items: [{ sourceId: actor.prayer!.id, title: `Shared prayer ${g}`, body: 'Approved prayer excerpt' }], groupId: null, publicWall: true, anonymous: true, consent: true });
        const delivery = (await ok(actor, '/api/prayer-sharing')).find((r: Json) => r.prayerId === actor.prayer!.id);
        const post = (await ok(other, '/api/prayers')).find((p: Json) => p.id === delivery.postId);
        assert(post && post.userId === null && post.authorName === '匿名');
        await ok(other, `/api/prayers/${post.id}/reactions/heart`, 'PUT', { selected: true });
        await ok(other, `/api/prayers/${post.id}/reactions/heart`, 'PUT', { selected: true });
        await ok(other, `/api/prayers/${post.id}/comments`, 'POST', { kind: 'prayer', content: 'Praying with you' }, 201);
        await ok(actor, `/api/personal-prayers/${actor.prayer!.id}`, 'PATCH', { ...actor.prayer, expectedUpdatedAt: actor.prayer!.updatedAt, status: 'answered', responseType: 'grace', response: 'PRIVATE_ANSWER', closePublicShare: true });
        assert(!(await ok(other, '/api/prayers')).some((p: Json) => p.id === post.id));
        await ok(other, `/api/prayers/${post.id}/comments`, 'GET', undefined, 404);
        assert((await ok(actor, '/api/personal-prayers')).some((p: Json) => p.id === actor.prayer!.id && p.status === 'answered'));
      }
    });
    await scenario('40 newcomers: apply, no premature access, approve, no pre-join history', async () => {
      for (let i = 460; i < 500; i++) {
        const actor = actors[i], group = groups[(i - 460) % 30];
        await ok(actor, `/api/life-groups/directory/${group}/join`, 'POST', {});
        await ok(actor, `/api/life-groups/${group}`, 'GET', undefined, 404);
        await ok(senior, `/api/life-groups/management/${group}/requests/${actor.id}`, 'POST', { approve: true });
        await ok(actor, `/api/life-groups/${group}`);
        assert.equal((await ok(actor, `/api/life-groups/${group}/shares?kind=all`)).length, 0);
      }
    });
    await scenario('Concurrent saves: no lost updates, create retry, anonymous wall and withdrawal', async () => {
      for (let i = 0; i < 30; i++) {
        const actor = actors[i * 15 + 1], route = `/api/devotional-notes/${actor.note!.id}`;
        const results = await Promise.all([call(actor, route, 'PATCH', { version: 1, observation: 'Device A' }), call(actor, route, 'PATCH', { version: 1, observation: 'Device B' })]);
        assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      }
      const actor = actors[1], window = await ok(actor, '/api/devotion-wall/window');
      const post = await ok(actor, '/api/devotion-wall', 'POST', { sourceId: actor.note!.id, day: window.day, title: 'Approved public reflection', body: 'Only this excerpt', reference: '約翰福音 3:16', anonymous: true, consent: true }, 201);
      const feed = await ok(actors[16], '/api/devotion-wall');
      assert(!JSON.stringify(feed).includes(actor.id)); assert(!JSON.stringify(feed).includes('PRIVATE_'));
      await ok(actor, `/api/devotion-wall/${post.id}`, 'DELETE');
      assert.equal((await ok(actor, '/api/devotional-notes')).length, 1);
      const body = { verseReference: '約翰福音 3:16', verseText: 'Fixture', observation: 'Retry-safe', clientMutationId: randomUUID() };
      const copies = await Promise.all([ok(actor, '/api/devotional-notes', 'POST', body, 201), ok(actor, '/api/devotional-notes', 'POST', body, 201)]);
      assert.equal(copies[0].id, copies[1].id);
    });
    await scenario('30 transfers and exits: old access revoked, private records retained', async () => {
      for (let g = 0; g < 30; g++) {
        const actor = actors[g * 15 + 14], target = groups[(g + 1) % 30];
        await ok(senior, `/api/life-groups/management/${groups[g]}/move`, 'POST', { userId: actor.id, targetGroupId: target, reason: 'Synthetic transfer' });
        await ok(actor, `/api/life-groups/${groups[g]}/shares?kind=all`, 'GET', undefined, 404);
        assert.equal((await ok(actor, `/api/life-groups/${target}/shares?kind=all`)).length, 0);
        await ok(senior, `/api/life-groups/management/${target}/move`, 'POST', { userId: actor.id, targetGroupId: null, reason: 'Synthetic exit' });
        await ok(actor, `/api/life-groups/${target}`, 'GET', undefined, 404);
        assert.equal((await ok(actor, '/api/devotional-notes')).length, 1);
      }
    });
    await scenario('Revoking all five area appointments immediately removes scopes', async () => {
      for (const id of assignments) await ok(senior, `/api/crm/scope-assignments/${id}`, 'DELETE');
      for (let p = 0; p < 5; p++) assert.equal((await ok(actors[450 + p], dashboard)).groups.length, 0);
    });
    // Separate functional traffic from load windows; leave production rate limits enabled.
    console.log('CHURCH_LOAD cooldown 61s; default production HTTP limits remain enabled');
    await sleep(61000);
    loadPhase = true;
    for (const stage of [{ concurrency: 10 }, { concurrency: 50 }, { concurrency: 100 }, { concurrency: 250 }, { concurrency: 500 }, { concurrency: 100, paced: true }]) {
      const { concurrency } = stage;
      await scenario(`Mixed workload with ${concurrency} concurrent HTTP clients${stage.paced ? ' (50-second paced phase)' : ''}`, async () => {
        const times: number[] = [], errors: Record<string, number> = {};
        const delay = monitorEventLoopDelay({ resolution: 20 }); delay.enable();
        let peakPool = 0, peakWaiting = 0, peakRss = 0;
        const sampler = setInterval(() => { peakPool = Math.max(peakPool, pool.totalCount); peakWaiting = Math.max(peakWaiting, pool.waitingCount); peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 20);
        const begin = performance.now();
        const total = stage.paced ? 5000 : 1000;
        try {
          await concurrent(Array.from({ length: total }, (_, n) => n), concurrency, async n => {
            const actor = actors[n % 500], t = performance.now();
            try {
              const mode = Math.floor(n / 500) === 0 ? n % 5 : (n + 2) % 5;
              const route = ['/api/devotional-notes', '/api/personal-prayers', '/api/life-groups', '/api/bible-study/chapter?book=43&chapter=3', '/api/devotional-notes'][mode];
              const write = mode === 4;
              const result = await call(actor, route, write ? 'POST' : 'GET', write ? { verseReference: '約翰福音 3:16', verseText: 'Fixture', observation: 'Load note', clientMutationId: randomUUID() } : undefined);
              if (result.status !== (write ? 201 : 200)) errors[String(result.status)] = (errors[String(result.status)] || 0) + 1;
              else if (write ? !result.data.id : mode < 2 ? !Array.isArray(result.data) || result.data.length < 1 : mode === 2 ? !Array.isArray(result.data.groups) : !Array.isArray(result.data) || result.data.length < 30) errors.invalidPayload = (errors.invalidPayload || 0) + 1;
            } catch { errors.network = (errors.network || 0) + 1; }
            finally { times.push(performance.now() - t); if (stage.paced) await sleep(Math.max(0, 1000 - (performance.now() - t))); }
          });
        } finally { clearInterval(sampler); delay.disable(); }
        times.sort((a, b) => a - b);
        const percentile = (p: number) => Math.round(times[Math.ceil(times.length * p) - 1]);
        const report = { concurrency, requests: total, paced: !!stage.paced, readWriteRatio: '80:20', durationMs: Math.round(performance.now() - begin), p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), errors, peakPool, peakWaiting, peakRssMB: Math.round(peakRss / 1048576), eventLoopP99Ms: Math.round(delay.percentile(99) / 1e6) };
        loads.push(report); console.log('CHURCH_LOAD ' + JSON.stringify(report));
        assert.deepEqual(errors, {}); assert(report.p95Ms < 2000, 'Local engineering gate: p95 must be below 2000ms');
      });
    }
    await scenario('Post-load persistence, no foreign ownership and logout version revocation', async () => {
      assert.equal(Number((await pool.query('SELECT count(*) FROM users')).rows[0].count), 500);
      assert.equal(Number((await pool.query('SELECT count(*) FROM devotional_notes')).rows[0].count), 2501);
      assert.equal(Number((await pool.query('SELECT count(*) FROM personal_prayers')).rows[0].count), 1000);
      const actor = actors[499];
      await pool.query('UPDATE users SET session_version=session_version+1 WHERE id=$1', [actor.id]);
      await ok(actor, '/api/devotional-notes', 'GET', undefined, 401);
      assert((await ok(actors[498], '/api/devotional-notes')).every((n: Json) => n.userId === actors[498].id));
    });
    if (process.env.RUN_SECURITY_BROWSER === '1') await scenario('Mobile and desktop browser journeys against the populated 500-person model', async () => {
      const { verifySecurityBrowser } = await import('./verify-security-browser');
      await verifySecurityBrowser(pool, origin, actors[0].id);
    });
  } finally {
    const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const harnessSha256 = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
    const result = { runId, source, startedAt: start.toISOString(), finishedAt: new Date().toISOString(), model: { registeredUsers: 500, initialFamilyMembers: 450, families: 30, responsibilityAreas: 5, staffOutsideFamilies: 10, newcomers: 40, areaImplementation: 'six explicit family scope assignments per pastor; not a native district hierarchy' }, environment: { node: process.version, platform: process.platform, architecture: process.arch, cpus: os.cpus().length, dbPoolLimit: pool.options.max, productionRateLimits: true, syntheticDataOnly: true, externalDeliveryDisabled: true }, requests, statuses: counts, scenarios: cases, loads, verdict: cases.length && cases.every(c => c.status === 'passed') ? 'passed-with-scope-limitations' : 'failed', limitations: ['Local isolated PostgreSQL/HTTP, not Railway capacity certification', 'Signed synthetic sessions, not 500 real Google OAuth authorizations', 'Concurrent HTTP clients are not 500 browsers or a multi-hour soak', 'Bible load phase uses warm identical-chapter requests, not cold random full-corpus searches', 'Actual mobile devices, external notification delivery, disaster recovery and native pastoral-area lifecycle remain separate gates', 'Existing full regression suite must run separately; this model does not prove every possible state'] };
    await writeFile(path.join(directory, 'results.json'), JSON.stringify({ ...result, harnessSha256 }, null, 2));
    console.log(`CHURCH_REPORT ${path.join(directory, 'results.json')}`);
  }
  assert(cases.length > 0 && cases.every(c => c.status === 'passed'), 'Church simulation has failed scenarios; inspect results.json');
}
