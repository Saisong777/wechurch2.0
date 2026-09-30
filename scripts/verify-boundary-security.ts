import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;

export async function verifyBoundarySecurity(pool: Pool, a: Client, b: Client, guest: Client, makeClient: () => Client, ids: string[]) {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    assert.equal((await guest(`/api/prayer-meetings/${randomUUID()}/participants`, method)).status, 410);
  }
  const host = makeClient();
  const create = await host('/api/icebreaker/games', 'POST', { mode: 'standalone', currentLevel: 'L1' });
  assert.equal(create.status, 200); const game = await create.json();
  assert.equal((await guest(`/api/icebreaker/games/${game.roomCode}`)).status, 200);
  assert.equal((await guest(`/api/icebreaker/games/${game.id}`, 'PATCH', { timerRunning: true })).status, 403);
  assert.equal((await guest(`/api/icebreaker/games/${game.id}/reset`, 'POST')).status, 403);
  assert.equal((await b(`/api/icebreaker/games/${game.id}/draw-card`, 'POST', { level: 'L1' })).status, 403);
  assert.equal((await host(`/api/icebreaker/games/${game.id}`, 'PATCH', { timerRunning: true })).status, 200);
  assert.equal((await host(`/api/icebreaker/games/${game.id}`, 'PATCH', { bibleStudySessionId: randomUUID() })).status, 400);
  assert.equal((await host(`/api/icebreaker/games/${game.id}/reset`, 'POST')).status, 200);
  assert.equal((await guest('/api/icebreaker/games', 'POST', { mode: 'session', bibleStudySessionId: randomUUID(), groupNumber: 1 })).status, 403);

  // Real HTTP access checks run before the existing administrator promotion.
  const actorBefore = (await pool.query('SELECT church, display_name FROM users WHERE id=$1', [ids[0]])).rows[0];
  assert.equal((await pool.query('SELECT role FROM user_roles WHERE user_id=$1', [ids[0]])).rows[0].role, 'leader');
  const ownChurch = `Boundary own ${randomUUID()}`;
  const otherChurch = `Boundary other ${randomUUID()}`;
  await pool.query('UPDATE users SET church=$2 WHERE id=$1', [ids[0], ownChurch]);
  const privateUserId = randomUUID();
  await pool.query(`INSERT INTO users(id,email,display_name,church,birthday,user_gender,address)
    VALUES($1,$2,'Private fixture',$3,'2000-01-01','other','Private fixture address')`,
    [privateUserId, `boundary-profile-${randomUUID()}@example.test`, otherChurch]);
  assert.equal((await a(`/api/users/${privateUserId}/profile?church=${encodeURIComponent(otherChurch)}`)).status, 403, 'leader cannot read an out-of-scope private profile');
  assert.equal((await a(`/api/users/${privateUserId}/profile`, 'PATCH', { displayName: 'Unauthorized' })).status, 403);
  for (const [client, userId] of [[a, ids[0]], [b, ids[1]]] as const) {
    const before = (await pool.query('SELECT church FROM users WHERE id=$1', [userId])).rows[0];
    assert.equal((await client(`/api/users/${userId}/profile`, 'PATCH', { church: otherChurch })).status, 403, 'self cannot change authorization-bearing church');
    assert.deepEqual((await pool.query('SELECT church FROM users WHERE id=$1', [userId])).rows[0], before);
  }
  const personalBefore = (await pool.query('SELECT church,birthday::text,user_gender,address FROM users WHERE id=$1', [ids[0]])).rows[0];
  assert.equal((await a(`/api/users/${ids[0]}/profile`, 'PATCH', { displayName: 'Boundary self edit' })).status, 200);
  assert.deepEqual((await pool.query('SELECT church,birthday::text,user_gender,address FROM users WHERE id=$1', [ids[0]])).rows[0], personalBefore, 'omitted profile fields are preserved');

  // Visibility alone must not grant personal-field access or member editing.
  const assignmentId = randomUUID();
  await pool.query(`INSERT INTO crm_scope_assignments(id,assignee_user_id,scope_type,member_user_id)
    VALUES($1,$2,'member',$3)`, [assignmentId, ids[0], privateUserId]);
  const listResponse = await a('/api/users?church=all'); assert.equal(listResponse.status, 200);
  const redacted = (await listResponse.json()).find((user: { id: string }) => user.id === privateUserId);
  assert.ok(redacted, 'assigned member remains visible in the directory');
  for (const key of ['password', 'email', 'birthday', 'userGender', 'address']) assert.equal(key in redacted, false, `${key} must be redacted`);
  assert.equal((await a(`/api/users/${privateUserId}/profile`)).status, 403);
  await pool.query('UPDATE crm_scope_assignments SET can_view_personal=true WHERE id=$1', [assignmentId]);
  const allowedProfile = await a(`/api/users/${privateUserId}/profile`); assert.equal(allowedProfile.status, 200);
  assert.equal((await allowedProfile.json()).address, 'Private fixture address');
  assert.equal((await a(`/api/users/${privateUserId}/profile`, 'PATCH', { displayName: 'View is not edit' })).status, 403);
  await pool.query('UPDATE crm_scope_assignments SET can_manage_members=true WHERE id=$1', [assignmentId]);
  assert.equal((await a(`/api/users/${privateUserId}/profile`, 'PATCH', { displayName: 'Authorized scoped edit' })).status, 200);
  assert.equal((await a(`/api/users/${privateUserId}/profile`, 'PATCH', { church: ownChurch })).status, 403);
  await pool.query('DELETE FROM crm_scope_assignments WHERE id=$1', [assignmentId]);
  assert.equal((await a(`/api/users/${privateUserId}/profile`)).status, 403, 'revoked scope takes effect');

  const createdSession = await a('/api/sessions', 'POST', { verseReference: 'Boundary fixture', churchUnit: ownChurch });
  assert.equal(createdSession.status, 201); const ownSession = await createdSession.json();
  assert.equal(ownSession.ownerId, ids[0]); assert.equal(ownSession.churchUnit, ownChurch);
  assert.equal((await a('/api/sessions', 'POST', { verseReference: 'Unauthorized church', churchUnit: otherChurch })).status, 403);
  assert.equal((await a('/api/sessions', 'POST', { verseReference: 'Unauthorized owner', ownerId: ids[1] })).status, 403);
  assert.equal((await a(`/api/sessions/${ownSession.id}`, 'PATCH', { status: 'studying' })).status, 200, 'legitimate owner can manage');
  for (const change of [{ churchUnit: otherChurch }, { ownerId: ids[1] }]) {
    assert.equal((await a(`/api/sessions/${ownSession.id}`, 'PATCH', change)).status, 403);
  }
  const foreignSessionId = randomUUID();
  // Even historical ownership cannot bypass a different church boundary.
  await pool.query(`INSERT INTO sessions(id,owner_id,church_unit,verse_reference)
    VALUES($1,$2,$3,'Foreign fixture')`, [foreignSessionId, ids[0], otherChurch]);
  const participantId = randomUUID(), responseId = randomUUID();
  await pool.query(`INSERT INTO participants(id,session_id,name,email,gender)
    VALUES($1,$2,'Boundary participant',$3,'male')`, [participantId, foreignSessionId, `boundary-participant-${randomUUID()}@example.test`]);
  await pool.query(`INSERT INTO study_responses(id,session_id,user_id,observation)
    VALUES($1,$2,$3,'Preserve this response')`, [responseId, foreignSessionId, participantId]);
  const foreignBefore = (await pool.query('SELECT to_jsonb(s) AS row FROM sessions s WHERE id=$1', [foreignSessionId])).rows[0].row;
  const responseBefore = (await pool.query('SELECT to_jsonb(r) AS row FROM study_responses r WHERE id=$1', [responseId])).rows[0].row;
  for (const suffix of ['', `?sessionId=${ownSession.id}`]) {
    assert.equal((await a(`/api/sessions/${foreignSessionId}${suffix}`, 'PATCH', { verseReference: 'Unauthorized' })).status, 403);
    assert.equal((await a(`/api/sessions/${foreignSessionId}${suffix}`, 'DELETE', { sessionId: ownSession.id })).status, 403);
    assert.equal((await a(`/api/study-responses/${responseId}${suffix}`, 'DELETE', { sessionId: ownSession.id })).status, 403);
    assert.equal((await a(`/api/study-responses/${responseId}${suffix}`, 'PATCH', { sessionId: ownSession.id, observation: 'Unauthorized' })).status, 403);
  }
  assert.equal((await a(`/api/sessions/${foreignSessionId}?sessionId=${ownSession.id}`, 'PATCH', { sessionId: ownSession.id, ownerId: ids[0], churchUnit: ownChurch })).status, 403);
  assert.deepEqual((await pool.query('SELECT to_jsonb(s) AS row FROM sessions s WHERE id=$1', [foreignSessionId])).rows[0].row, foreignBefore);
  assert.deepEqual((await pool.query('SELECT to_jsonb(r) AS row FROM study_responses r WHERE id=$1', [responseId])).rows[0].row, responseBefore);
  assert.equal((await a(`/api/sessions/${ownSession.id}`, 'DELETE')).status, 200, 'authorized session deletion succeeds');
  assert.equal((await pool.query('SELECT id FROM sessions WHERE id=$1', [ownSession.id])).rowCount, 0);

  const knownEmail = `boundary-intake-${randomUUID()}@example.test`;
  const knownId = randomUUID();
  await pool.query(`INSERT INTO potential_members(id,email,name,gender,church,status,subscribed,sessions_count)
    VALUES($1,$2,'Preserve name','female',$3,'member',false,7)`, [knownId, ` ${knownEmail.toUpperCase()} `, otherChurch]);
  const intakeBefore = (await pool.query('SELECT to_jsonb(p) AS row FROM potential_members p WHERE id=$1', [knownId])).rows[0].row;
  const duplicate = await guest('/api/potential-members', 'POST', { email: knownEmail, name: 'Overwrite attempt', gender: 'male', church: ownChurch });
  assert.equal(duplicate.status, 201); assert.deepEqual(await duplicate.json(), { success: true });
  assert.equal((await guest('/api/potential-members', 'POST', { email: knownEmail, name: 'Mass assignment', userId: ids[0], status: 'pending' })).status, 400);
  const joinSessionId = randomUUID();
  await pool.query(`INSERT INTO sessions(id,owner_id,church_unit,verse_reference)
    VALUES($1,$2,$3,'Guest intake fixture')`, [joinSessionId, ids[0], ownChurch]);
  assert.equal((await guest(`/api/sessions/${joinSessionId}/participants`, 'POST', { email: knownEmail, name: 'Guest overwrite attempt', gender: 'male' })).status, 201);
  assert.deepEqual((await pool.query('SELECT to_jsonb(p) AS row FROM potential_members p WHERE id=$1', [knownId])).rows[0].row, intakeBefore, 'public intake and guest participation cannot modify existing CRM records');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM potential_members WHERE lower(trim(email))=$1', [knownEmail])).rows[0].n, 1);
  const freshEmail = `boundary-new-${randomUUID()}@example.test`;
  const receipts = await Promise.all([freshEmail, freshEmail.toUpperCase()].map(email => guest('/api/potential-members', 'POST', { email, name: 'New intake' })));
  for (const receipt of receipts) { assert.equal(receipt.status, 201); assert.deepEqual(await receipt.json(), { success: true }); }
  const newRows = await pool.query('SELECT email,status FROM potential_members WHERE lower(trim(email))=$1', [freshEmail]);
  assert.deepEqual(newRows.rows, [{ email: freshEmail, status: 'pending' }], 'concurrent normalized intake inserts once');
  console.log('PASS HTTP profile capability/scope, private directory redaction, self church denial, session/response target spoof denial, known-email and guest-intake preservation');

  await pool.query("UPDATE user_roles SET role='admin' WHERE user_id=$1", [ids[0]]);
  try {
    const adminProfile = await a(`/api/users/${privateUserId}/profile`); assert.equal(adminProfile.status, 200);
    assert.equal((await adminProfile.json()).address, 'Private fixture address');
    assert.equal((await a(`/api/users/${privateUserId}/profile`, 'PATCH', { church: ownChurch })).status, 200);
    assert.equal((await pool.query('SELECT church FROM users WHERE id=$1', [privateUserId])).rows[0].church, ownChurch);
    assert.equal((await a(`/api/sessions/${foreignSessionId}`, 'PATCH', { verseReference: 'Authorized admin update' })).status, 200);
    assert.equal((await pool.query('SELECT verse_reference FROM sessions WHERE id=$1', [foreignSessionId])).rows[0].verse_reference, 'Authorized admin update');
    assert.equal((await a(`/api/study-responses/${responseId}`, 'DELETE')).status, 200);
    assert.equal((await pool.query('SELECT id FROM study_responses WHERE id=$1', [responseId])).rowCount, 0);
    assert.equal((await a(`/api/sessions/${foreignSessionId}`, 'DELETE')).status, 200);
    assert.equal((await pool.query('SELECT id FROM sessions WHERE id=$1', [foreignSessionId])).rowCount, 0);
    assert.equal((await pool.query('SELECT id FROM participants WHERE id=$1', [participantId])).rowCount, 0);
    console.log('PASS HTTP administrator profile/church and cross-church session management; persisted mutations verified');
  } finally {
    await pool.query('UPDATE users SET church=$2,display_name=$3 WHERE id=$1', [ids[0], actorBefore.church, actorBefore.display_name]);
  }
  const malicious = new FormData(); malicious.set('image', new Blob(['<svg onload="alert(1)"/>'], { type: 'image/svg+xml' }), 'attack.html');
  assert.equal((await a('/api/message-cards/upload', 'POST', malicious)).status, 400);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
  const valid = new FormData(); valid.set('image', new Blob([png], { type: 'image/png' }), 'misleading.html');
  const uploaded = await a('/api/message-cards/upload', 'POST', valid); assert.equal(uploaded.status, 200);
  const imagePath = (await uploaded.json()).imagePath; assert.match(imagePath, /^[a-f0-9]+\.png$/);
  try {
    const media = await guest(`/api/message-cards/image/${imagePath}`);
    assert.equal(media.status, 200); assert.match(media.headers.get('content-security-policy') || '', /sandbox/);
    assert.equal((await guest('/api/message-cards/image/old.html')).status, 404);
    assert.equal((await guest('/uploads/avatars/old.svg')).status, 404);
  } finally { assert.equal((await a(`/api/message-cards/image/${imagePath}`, 'DELETE')).status, 200); }
  assert.equal((await guest('/api/webhooks/resend/inbound', 'POST', { from: 'fake@example.test', to: 'test@example.test' })).status, 503);
  console.log('PASS retired prayer boundary, host-bound games, immutable game scope, raster uploads, legacy active-file denial and fail-closed webhook');
}
