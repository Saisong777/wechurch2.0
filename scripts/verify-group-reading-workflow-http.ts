import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { shiftDevotionDate, taipeiToday } from '../shared/churchDevotion';
import { readingNoteResponse, readingReflectionResult } from '../shared/lifeGroup';
type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;

// Fresh disposable integrity DB only. The caller owns server/DB lifecycle; no standalone runner.
export async function verifyGroupReadingWorkflowHttp(pool: Pool, makeClient: () => Client) {
  const actors: { id: string; client: Client }[] = [];
  for (const church of ['IM 行動教會', 'IM 行動教會', '火樂']) {
    const client = makeClient(), email = `group-reading-${randomUUID()}@example.test`;
    assert.equal((await client('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: 'Synthetic group reading fixture' })).status, 200);
    const id = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id;
    await pool.query('UPDATE users SET church=$2 WHERE id=$1', [id, church]);
    actors.push({ id, client });
  }
  const [owner, nonmember, otherChurch] = actors, guest = makeClient();
  const groupId = (await pool.query("INSERT INTO small_groups(name,church,leader_user_id) VALUES('Synthetic reading group','IM 行動教會',$1) RETURNING id", [owner.id])).rows[0].id;
  const otherGroup = (await pool.query("INSERT INTO small_groups(name,church,leader_user_id) VALUES('Synthetic other church group','火樂',$1) RETURNING id", [otherChurch.id])).rows[0].id;
  const base = `/api/life-groups/${groupId}`;
  const devotion = async (date: string, church = 'IM 行動教會') => {
    const existing = (await pool.query('SELECT id,date::text,version,status FROM church_devotions WHERE church=$1 AND date=$2', [church, date])).rows[0];
    assert(!existing, `Synthetic reading date must be unused: ${date}/${church}`);
    return (await pool.query(`INSERT INTO church_devotions(church,date,plan_name,day_number,scripture_reference,scripture_text,devotional_title,devotional_text,status,updated_by)
      VALUES($1,$2,'Synthetic reading plan',1,'詩篇 23','Synthetic scripture','Synthetic daily title','Synthetic devotion','published',$3) RETURNING id,date::text,version`, [church, date, owner.id])).rows[0];
  };
  let firstDay = '1987-01-01';
  while ((await pool.query('SELECT 1 FROM church_devotions WHERE church=$1 AND date BETWEEN $2::date AND $2::date+30', ['IM 行動教會', firstDay])).rowCount) firstDay = shiftDevotionDate(firstDay, 31);
  const days = await Promise.all(Array.from({ length: 9 }, (_, i) => devotion(shiftDevotionDate(firstDay, i))));
  const crossDevotion = await devotion(firstDay, '火樂');
  // Use a far future date to avoid other fixtures' tomorrow publication and prove server enforcement.
  const future = await devotion('2190-01-01');
  const url = (entry = days[0], mutation = randomUUID(), group = groupId) => `/api/life-groups/${group}/reading/${entry.id}/reflections/${mutation}`;
  const body = (entry = days[0], patch = {}) => ({ devotionVersion: entry.version, noteId: null, noteVersion: null, observation: 'PRIVATE observation', receiving: 'Shared receiving', response: 'PRIVATE response', shareFields: ['receiving'], markRead: true, consent: true, ...patch });
  const counts = async (requestId: string) => (await pool.query(`SELECT
    (SELECT count(*)::int FROM life_group_shares WHERE id=$1) AS shares,
    (SELECT count(*)::int FROM devotion_share_requests WHERE user_id=$2 AND request_id=$1) AS receipts`, [requestId, owner.id])).rows[0];
  const noteFor = async (date: string) => (await pool.query('SELECT * FROM devotional_notes WHERE user_id=$1 AND source_devotional_date=$2', [owner.id, date])).rows;
  const feed = async (date?: string) => {
    const response = await owner.client(`${base}/shares?kind=note${date ? `&date=${date}` : ''}`); assert.equal(response.status, 200); return response.json() as Promise<{ id: string; body: string }[]>;
  };
  assert.equal((await guest(`${base}/reading/note?date=${firstDay}`)).status, 401);
  assert.equal((await nonmember.client(`${base}/reading/note?date=${firstDay}`)).status, 404);
  assert.equal((await otherChurch.client(`${base}/reading?date=${firstDay}`)).status, 404);
  for (const [client, endpoint, payload, status] of [
    [nonmember.client, url(), body(), 404], [otherChurch.client, url(), body(), 404],
    [owner.client, url(days[0], randomUUID(), otherGroup), body(), 404],
    [owner.client, url(crossDevotion), body(crossDevotion), 409],
    [owner.client, url(future), body(future), 403], [owner.client, url(), body(days[0], { devotionVersion: 99 }), 409],
    [owner.client, url(), body(days[0], { consent: false }), 400], [owner.client, url(), body(days[0], { shareFields: [] }), 400],
  ] as const) assert.equal((await client(endpoint, 'PUT', payload)).status, status);
  assert.equal((await owner.client(`${base}/reading/${future.id}`, 'PUT', { version: future.version, done: true })).status, 403);
  assert.equal((await owner.client(`${base}/reading?date=2190-01-01`)).status, 403);
  assert.equal((await owner.client(`${base}/reading?date=${shiftDevotionDate(taipeiToday(), 1)}`)).status, 200);
  const tomorrowDate = shiftDevotionDate(taipeiToday(), 1);
  const tomorrow = (await pool.query('SELECT id,date::text,version,status FROM church_devotions WHERE church=$1 AND date=$2', ['IM 行動教會', tomorrowDate])).rows[0] || await devotion(tomorrowDate);
  if (tomorrow.status === 'draft') await pool.query("UPDATE church_devotions SET status='published' WHERE id=$1", [tomorrow.id]);
  try {
    for (const done of [true, false]) assert.equal((await owner.client(`${base}/reading/${tomorrow.id}`, 'PUT', { version: tomorrow.version, done })).status, 403);
    assert.equal((await owner.client(url(tomorrow), 'PUT', body(tomorrow))).status, 403);
    assert.equal((await pool.query('SELECT 1 FROM life_group_reading WHERE group_id=$1 AND user_id=$2 AND devotion_id=$3', [groupId, owner.id, tomorrow.id])).rowCount, 0);
    assert.equal((await noteFor(tomorrowDate)).length, 0);
  } finally { if (tomorrow.status === 'draft') await pool.query("UPDATE church_devotions SET status='draft' WHERE id=$1", [tomorrow.id]); }

  // Different mutation UUIDs on the same fresh day cannot produce duplicate personal notes.
  const raceIds = [randomUUID(), randomUUID()];
  const race = await Promise.all(raceIds.map(id => owner.client(url(days[0], id), 'PUT', body())));
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
  const success = race.findIndex(r => r.status === 200), requestId = raceIds[success];
  const result = readingReflectionResult.parse(await race[success].json());
  assert.equal((await noteFor(firstDay)).length, 1);
  assert.deepEqual(await counts(requestId), { shares: 1, receipts: 1 });
  const original = (await noteFor(firstDay))[0];
  assert.equal(original.observation, 'PRIVATE observation'); assert.equal(original.action_plan, 'PRIVATE response');
  assert.deepEqual(JSON.parse(original.core_insight_note), { GOD_ATTRIBUTE: 'Shared receiving' });
  const preloadResponse = await owner.client(`${base}/reading/note?date=${firstDay}`); assert.equal(preloadResponse.status, 200);
  assert.deepEqual(readingNoteResponse.parse(await preloadResponse.json()).note, { id: result.noteId, version: 1, observation: 'PRIVATE observation', receiving: 'Shared receiving', response: 'PRIVATE response' });
  const publicFeed = await feed(firstDay);
  assert.equal(publicFeed.find(p => p.id === requestId)?.body, '領受\nShared receiving');
  assert(!JSON.stringify(publicFeed).includes('PRIVATE'));
  const read = () => pool.query('SELECT 1 FROM life_group_reading WHERE group_id=$1 AND user_id=$2 AND devotion_id=$3', [groupId, owner.id, days[0].id]);
  assert.equal((await read()).rowCount, 1);
  assert.equal((await owner.client(`${base}/reading/${days[0].id}`, 'PUT', { version: days[0].version, done: false })).status, 200);
  const replay = await Promise.all([owner.client(url(days[0], requestId), 'PUT', body()), owner.client(url(days[0], requestId), 'PUT', body())]);
  assert(replay.every(r => r.status === 200));
  for (const response of replay) assert.deepEqual(await response.json(), result);
  assert.equal((await read()).rowCount, 0, 'retry must not restore a later unchecked reading');
  assert.deepEqual(await noteFor(firstDay), [original]);
  assert.equal((await owner.client(url(days[0], requestId), 'PUT', body(days[0], { markRead: false }))).status, 409);

  // Tagged immutable receipt dates survive a later change to the private note date.
  await pool.query('UPDATE devotional_notes SET source_devotional_date=$2 WHERE id=$1', [result.noteId, days[8].date]);
  assert((await feed(firstDay)).some(p => p.id === requestId));
  assert(!(await feed(days[8].date)).some(p => p.id === requestId));
  await pool.query('UPDATE devotional_notes SET source_devotional_date=$2 WHERE id=$1', [result.noteId, firstDay]);
  await pool.query('UPDATE devotional_notes SET hidden=true WHERE id=$1', [result.noteId]);
  assert.equal((await owner.client(url(days[0], requestId), 'PUT', body())).status, 404);
  assert.equal((await owner.client(url(days[0]), 'PUT', body())).status, 409, 'hidden note cannot be replaced by a new mutation');
  await pool.query('UPDATE devotional_notes SET hidden=false WHERE id=$1', [result.noteId]);
  assert.equal((await owner.client(`${base}/shares/${requestId}`, 'DELETE')).status, 200);
  assert.equal((await owner.client(url(days[0], requestId), 'PUT', body())).status, 409);
  assert(!(await feed(firstDay)).some(p => p.id === requestId));

  // Preload and update existing journal data without replacing other fields or category notes.
  const existingId = randomUUID();
  await pool.query(`INSERT INTO devotional_notes(id,user_id,source_devotional_date,verse_reference,verse_text,observation,core_insight_category,core_insight_note,action_plan,scholars_note,cool_down_note,heartbeat_verse,title_phrase)
    VALUES($1,$2,$3,'詩篇 23','Preserved scripture','Prior observation','["PROMISE","GOD_ATTRIBUTE"]','{"PROMISE":"Preserved promise","GOD_ATTRIBUTE":"Prior receiving"}','Prior response','Preserved study','Preserved review','Preserved highlight','Preserved title')`, [existingId, owner.id, days[1].date]);
  const preload = readingNoteResponse.parse(await (await owner.client(`${base}/reading/note?date=${days[1].date}`)).json());
  assert.equal(preload.note?.id, existingId); assert.equal(preload.note?.receiving, 'Prior receiving');
  const update = body(days[1], { noteId: existingId, noteVersion: 1, markRead: false });
  const legacyPromise = 'Preserved promise '.repeat(400);
  await pool.query('UPDATE devotional_notes SET core_insight_note=$2 WHERE id=$1', [existingId, JSON.stringify({ PROMISE: legacyPromise, GOD_ATTRIBUTE: 'Prior receiving' })]);
  const updateId = randomUUID(); assert.equal((await owner.client(url(days[1], updateId), 'PUT', update)).status, 200);
  const updated = (await noteFor(days[1].date))[0];
  for (const [key, value] of Object.entries({ scholars_note: 'Preserved study', cool_down_note: 'Preserved review', heartbeat_verse: 'Preserved highlight', title_phrase: 'Preserved title', verse_text: 'Preserved scripture' })) assert.equal(updated[key], value);
  assert.deepEqual(JSON.parse(updated.core_insight_note), { PROMISE: legacyPromise, GOD_ATTRIBUTE: 'Shared receiving' });
  const staleId = randomUUID(); assert.equal((await owner.client(url(days[1], staleId), 'PUT', update)).status, 409);
  assert.deepEqual(await counts(staleId), { shares: 0, receipts: 0 });
  // Old and new publishers cannot interpret each other's receipt under the same UUID.
  assert.equal((await owner.client(`/api/devotion-wall/shares/${updateId}`, 'PUT', { sourceId: existingId, title: 'Legacy', body: 'Legacy', reference: '詩篇 23', consent: true, group: { groupId } })).status, 409);

  const deletedRequest = randomUUID(), deletedResponse = await owner.client(url(days[2], deletedRequest), 'PUT', body(days[2]));
  assert.equal(deletedResponse.status, 200); const deleted = readingReflectionResult.parse(await deletedResponse.json());
  assert.equal((await owner.client(`/api/devotional-notes/${deleted.noteId}`, 'DELETE', { version: deleted.noteVersion })).status, 200);
  assert.equal((await owner.client(url(days[2], deletedRequest), 'PUT', body(days[2]))).status, 409);
  assert.equal((await owner.client(url(days[2]), 'PUT', body(days[2], { noteId: deleted.noteId, noteVersion: deleted.noteVersion }))).status, 409);
  assert.equal((await noteFor(days[2].date)).length, 0);
  assert(!(await feed(days[2].date)).some(p => p.id === deletedRequest), 'existing delete-note policy withdraws linked shares');
  assert(!(await feed()).some(p => p.id === deletedRequest));
  const legacyId = randomUUID();
  assert.equal((await owner.client(`${base}/shares/${legacyId}`, 'PUT', { kind: 'note', title: 'Legacy undated share', body: 'Legacy excerpt', consent: true })).status, 200);
  assert((await feed()).some(p => p.id === legacyId));
  assert(!(await feed(days[2].date)).some(p => p.id === legacyId), 'legacy publication date must not be guessed as devotional date');

  // A final receipt failure must roll back the previously written note, snapshot and checkin.
  const failedId = randomUUID();
  await pool.query(`CREATE FUNCTION group_reading_fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='${failedId}'::uuid THEN RAISE EXCEPTION 'synthetic reading receipt failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER group_reading_fail_receipt BEFORE INSERT ON devotion_share_requests FOR EACH ROW EXECUTE FUNCTION group_reading_fail_receipt()`);
  try {
    assert.equal((await owner.client(url(days[3], failedId), 'PUT', body(days[3]))).status, 503);
    assert.deepEqual(await counts(failedId), { shares: 0, receipts: 0 });
    assert.equal((await noteFor(days[3].date)).length, 0);
    assert.equal((await pool.query('SELECT 1 FROM life_group_reading WHERE group_id=$1 AND user_id=$2 AND devotion_id=$3', [groupId, owner.id, days[3].id])).rowCount, 0);
  } finally { await pool.query('DROP TRIGGER group_reading_fail_receipt ON devotion_share_requests; DROP FUNCTION group_reading_fail_receipt()'); }
  assert.equal((await owner.client(url(days[3], failedId), 'PUT', body(days[3]))).status, 200);
  const sameKey = randomUUID();
  const sameKeyResponses = await Promise.all([owner.client(url(days[4], sameKey), 'PUT', body(days[4])), owner.client(url(days[4], sameKey), 'PUT', body(days[4]))]);
  assert(sameKeyResponses.every(r => r.status === 200));
  assert.deepEqual(await sameKeyResponses[0].json(), await sameKeyResponses[1].json());
  assert.equal((await noteFor(days[4].date)).length, 1);
  assert((await feed()).some(p => p.id === sameKey));
  console.log('PASS group reading workflow HTTP: private three-field preload/merge, selected-only snapshot, optional checkin, exact replay/uncheck, same-day and same-key concurrency, source date history, withdrawn/hidden/deleted guards, crosschurch/nonmember, preview read-only, stale CAS and actual final-receipt atomic rollback');
}
