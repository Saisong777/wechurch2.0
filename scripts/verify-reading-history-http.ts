import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { shiftDevotionDate, taipeiToday } from '../shared/churchDevotion';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;
// Fixtures are confined to the existing freshly-created localhost test database.
export async function verifyReadingHistoryHttp(pool: Pool, makeClient: () => Client) {
  assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name, /^wechurch_integrity_[a-f0-9]{32}$/);
  const churches = ['IM 行動教會', '桃園WeChurch', '火樂'];
  const today = taipeiToday(), yesterday = shiftDevotionDate(today, -1), older = shiftDevotionDate(today, -2);
  const register = async (church: string | null) => {
    const client = makeClient(), email = `reading-history-${randomUUID()}@example.test`;
    const response = await client('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: 'Synthetic history fixture' });
    assert.equal(response.status, 200);
    const id = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id as string;
    await pool.query('UPDATE users SET church=$2,church_choice_locked=true,church_choice_none=$3 WHERE id=$1', [id, church, church === null]);
    return { id, client };
  };
  const members = [];
  for (const church of churches) members.push(await register(church));
  const none = await register(null), guest = makeClient(), owner = members[0];
  const noteInput = { verseReference: '詩篇 23', verseText: 'Synthetic scripture', observation: 'Synthetic private reflection' };
  const dates = [today, yesterday, older];
  const entries: { id: string; date: string; church: string }[] = [];
  for (let i = 0; i < churches.length; i++) for (const date of dates) {
    const entry = (await pool.query(`INSERT INTO church_devotions(church,date,plan_name,day_number,scripture_reference,scripture_text,devotional_title,devotional_text,status,updated_by)
      VALUES($1,$2,'Synthetic history plan',1,'詩篇 23','Synthetic scripture',$3,$4,'published',$5) RETURNING id`,
    [churches[i], date, `${churches[i]} ${date}`, `Synthetic ${churches[i]} ${date}`, members[i].id])).rows[0];
    entries.push({ id: entry.id, date, church: churches[i] });
  }
  for (let i = 0; i < members.length; i++) for (const date of dates) {
    const response = await members[i].client(`/api/church-reading/today?date=${date}`);
    assert.equal(response.status, 200);
    const reading = await response.json();
    assert.equal(reading.date, date); assert.equal(reading.devotionalTitle, `${churches[i]} ${date}`);
    assert.equal(reading.id, entries.find(e => e.date === date && e.church === churches[i])!.id);
  }
  const emptyDate = shiftDevotionDate(today, -30), empty = await owner.client(`/api/church-reading/today?date=${emptyDate}`);
  assert.equal(empty.status, 200); const unavailable = await empty.json();
  assert.equal(unavailable.date, emptyDate); assert.equal(unavailable.sourceStatus, 'unpublished'); assert.equal(unavailable.devotionalText, '');
  assert.equal((await guest(`/api/church-reading/today?date=${older}`)).status, 401);
  assert.equal((await none.client(`/api/church-reading/today?date=${older}`)).status, 403);
  assert.equal((await owner.client('/api/church-reading/today?date=2026-02-30')).status, 400);
  console.log('PASS reading history: published past dates, no fallback, three isolated churches, guest and no-church boundary');

  const noteIds: string[] = [];
  for (const date of [yesterday, older]) {
    const mutationId = randomUUID();
    const input = { ...noteInput, devotionalDate: date, sourceDevotionalDate: today, sourceLabel: 'forged client label', userId: members[1].id, clientMutationId: mutationId };
    const response = await owner.client('/api/devotional-notes', 'POST', input);
    assert.equal(response.status, 201); const note = await response.json(); noteIds.push(note.id);
    assert.equal(note.userId, owner.id); assert.equal(note.sourceDevotionalDate, date); assert.equal(note.sourceLabel, '教會每日靈修');
    assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(note.createdAt)), today);
    const retried = await owner.client('/api/devotional-notes', 'POST', input); assert.equal(retried.status, 201); assert.equal((await retried.json()).id, note.id);
    assert.equal((await owner.client('/api/devotional-notes', 'POST', { ...input, devotionalDate: today })).status, 409);
  }
  for (let i = 0; i < 2; i++) {
    const date = [yesterday, older][i];
    const response = await owner.client(`/api/devotional-notes/by-reference?ref=${encodeURIComponent(noteInput.verseReference)}&date=${date}`);
    assert.equal(response.status, 200); assert.equal((await response.json()).id, noteIds[i]);
    assert.equal(await (await members[1].client(`/api/devotional-notes/by-reference?ref=${encodeURIComponent(noteInput.verseReference)}&date=${date}`)).json(), null);
  }
  assert.equal(await (await owner.client(`/api/devotional-notes/by-reference?ref=${encodeURIComponent(noteInput.verseReference)}&date=${today}`)).json(), null);
  const undated = await owner.client(`/api/devotional-notes/by-reference?ref=${encodeURIComponent(noteInput.verseReference)}`); assert.equal(undated.status, 200); assert(noteIds.includes((await undated.json()).id));
  assert.equal((await owner.client('/api/devotional-notes/by-reference?ref=x&date=2026-02-30')).status, 400);
  const beforeInvalid = (await pool.query('SELECT count(*)::int n FROM devotional_notes WHERE user_id=$1', [owner.id])).rows[0].n;
  for (const devotionalDate of ['2026-02-30', shiftDevotionDate(today, 1), null, ['2026-01-01']]) {
    assert.equal((await owner.client('/api/devotional-notes', 'POST', { ...noteInput, devotionalDate, clientMutationId: randomUUID() })).status, 400);
  }
  assert.equal((await pool.query('SELECT count(*)::int n FROM devotional_notes WHERE user_id=$1', [owner.id])).rows[0].n, beforeInvalid);
  console.log('PASS reading history: exact owner/reference/date notes, server-fixed provenance, actual writing time, idempotent date binding, rejected future/invalid writes');

  const importedId = randomUUID();
  await pool.query(`INSERT INTO devotional_notes(id,user_id,verse_reference,verse_text,source_devotional_date,source_label,observation)
    VALUES($1,$2,'Synthetic imported ref','Synthetic imported text',$3,'Synthetic legacy import','Original import')`, [importedId, owner.id, older]);
  const patch = await owner.client(`/api/devotional-notes/${importedId}`, 'PATCH', { version: 1, observation: '补記', devotionalDate: today, sourceDevotionalDate: today, sourceLabel: 'forged replacement' });
  assert.equal(patch.status, 200); const updated = await patch.json();
  assert.equal(updated.sourceDevotionalDate, older); assert.equal(updated.sourceLabel, 'Synthetic legacy import'); assert.equal(updated.observation, '补記');
  const noneNote = await none.client('/api/devotional-notes', 'POST', { ...noteInput, clientMutationId: randomUUID() }); assert.equal(noneNote.status, 201, 'no-church personal notebook remains available');
  console.log('PASS reading history: existing imported source metadata cannot be overwritten; no-church personal notes preserved');

  const groupId = (await pool.query("INSERT INTO small_groups(name,church,leader_user_id) VALUES('Synthetic historical readers','IM 行動教會',$1) RETURNING id", [owner.id])).rows[0].id;
  const oldEntry = entries.find(e => e.date === older && e.church === churches[0])!;
  assert.equal((await owner.client(`/api/life-groups/${groupId}/reading/${oldEntry.id}`, 'PUT', { version: 1, done: true })).status, 200);
  const oldProgress = await (await owner.client(`/api/life-groups/${groupId}/reading?date=${older}`)).json();
  assert(oldProgress.readers.some((r: { id: string }) => r.id === owner.id));
  const todayProgress = await (await owner.client(`/api/life-groups/${groupId}/reading?date=${today}`)).json(); assert.equal(todayProgress.readers.length, 0);
  const stored = (await pool.query('SELECT devotion_id FROM life_group_reading WHERE group_id=$1 AND user_id=$2', [groupId, owner.id])).rows;
  assert.deepEqual(stored.map(r => r.devotion_id), [oldEntry.id]);
  console.log('PASS reading history: existing group completion attaches to the historical entry, never today');
}
