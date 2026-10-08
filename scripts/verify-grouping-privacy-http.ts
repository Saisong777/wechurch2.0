import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;
type Activity = { id: string; shortCode: string; ownerId: string | null; status: string };
type Participant = { id: string; activityId: string; name: string; gender: string; groupNumber: number | null; joinedAt?: string };
type View = { activity: Activity; participants: Participant[]; myParticipantId: string | null; canManage: boolean };

// Real HTTP and signed-session cookies; fixtures may only use the disposable localhost runner database.
export async function verifyGroupingPrivacyHttp(pool: Pool, makeClient: () => Client) {
  const url = new URL(process.env.DATABASE_URL!);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name, /^wechurch_integrity_[a-f0-9]{32}$/);

  const noStore = (response: Response) => {
    const directives = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(value => value.trim());
    assert(directives.includes('private'), 'grouping responses must be private');
    assert(directives.includes('no-store'), 'grouping responses must not be stored');
  };
  const request = async (client: Client, path: string, status = 200, method = 'GET', body?: unknown) => {
    const response = await client(path, method, body);
    assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
    noStore(response);
    return response;
  };
  const register = async (role: 'leader' | 'admin') => {
    const client = makeClient(), email = `grouping-privacy-${randomUUID()}@example.test`;
    const response = await client('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: 'Synthetic grouping manager' });
    assert.equal(response.status, 200, await response.clone().text());
    const id = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id as string;
    assert.equal((await pool.query('SELECT id FROM auth_users WHERE email=$1', [email])).rows[0].id, `local_${id}`, 'manager uses actual local-auth registration');
    await pool.query("UPDATE users SET church='IM 行動教會',church_choice_locked=true,church_choice_none=false WHERE id=$1", [id]);
    await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [id, role]);
    return { id, client };
  };
  const owner = await register('leader'), otherLeader = await register('leader'), admin = await register('admin');
  const create = async () => {
    const response = await request(owner.client, '/api/grouping', 200, 'POST', {
      title: 'Synthetic grouping privacy fixture', groupingMode: 'byCount', groupCount: 2, genderMode: 'mixed',
    });
    const activity = await response.json() as Activity;
    assert.equal(activity.ownerId, owner.id);
    assert.equal(activity.status, 'joining');
    assert.match(activity.shortCode, /^[A-Z2-9]{4}$/);
    return activity;
  };
  const view = async (client: Client, path: string, expectedIds: string[], memberId: string | null, manager = false) => {
    const result = await (await request(client, path)).json() as View;
    assert.deepEqual(result.participants.map(member => member.id).sort(), [...expectedIds].sort(), 'response must contain exactly the authorized roster');
    assert.equal(result.myParticipantId, memberId, 'participant identity comes from the signed session');
    assert.equal(result.canManage, manager);
    if (!manager) {
      assert.equal(result.activity.ownerId, null, 'non-manager metadata hides owner identity');
      assert.equal(result.activity.shortCode, '', 'non-manager metadata does not redisclose the invitation code');
      for (const member of result.participants) assert(!('joinedAt' in member), 'participant view omits join timestamps');
    } else assert.equal(result.activity.ownerId, owner.id);
    return result;
  };
  const activity = await create(), idPath = `/api/grouping/${activity.id}`, codePath = `/api/grouping/code/${activity.shortCode}`;
  const outsider = makeClient(), first = makeClient(), sameName = makeClient(), peer = makeClient(), ungrouped = makeClient(), otherUngrouped = makeClient();
  const sharedName = `Synthetic same name ${randomUUID()}`;
  await view(outsider, codePath, [], null);
  await view(outsider, idPath, [], null);
  await view(outsider, codePath.toLowerCase(), [], null);

  const join = async (client: Client, name: string, gender: 'M' | 'F', extra: Record<string, unknown> = {}) => {
    const response = await request(client, `${idPath}/join`, 200, 'POST', { name, gender, ...extra });
    assert(response.headers.getSetCookie().length > 0, 'anonymous join persists a session cookie before returning');
    const participant = await response.json() as Participant;
    assert.equal(participant.activityId, activity.id);
    assert.equal(participant.name, name);
    assert.equal(participant.gender, gender);
    assert.equal(participant.groupNumber, null);
    return participant;
  };
  const a = await join(first, sharedName, 'M');
  const b = await join(sameName, sharedName, 'F', { participantId: a.id, userId: owner.id, ownerId: owner.id, role: 'admin', groupNumber: 1 });
  assert.notEqual(b.id, a.id, 'another signed session cannot reclaim a same-name participant');
  const c = await join(peer, 'Synthetic same-group peer', 'F');
  const d = await join(ungrouped, 'Synthetic ungrouped participant', 'M');
  const e = await join(otherUngrouped, 'Synthetic other ungrouped participant', 'F');
  const allIds = [a.id, b.id, c.id, d.id, e.id];
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM grouping_participants WHERE activity_id=$1', [activity.id])).rows[0].n, 5);
  const rejoined = await (await request(first, `${idPath}/join`, 200, 'POST', { name: 'Synthetic attempted rename', gender: 'F', participantId: b.id })).json() as Participant;
  assert.equal(rejoined.id, a.id, 'same browser rejoins its own participant');
  assert.equal(rejoined.name, sharedName);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM grouping_participants WHERE activity_id=$1', [activity.id])).rows[0].n, 5, 'refresh/rejoin does not add a duplicate');
  await view(first, idPath, [a.id], a.id);
  await view(first, codePath, [a.id], a.id);
  await view(sameName, idPath, [b.id], b.id);
  await view(peer, idPath, [c.id], c.id);
  await view(ungrouped, idPath, [d.id], d.id);
  await view(otherUngrouped, idPath, [e.id], e.id);

  // Actual Passport session ID rotation must preserve only this browser's grant.
  const guestSession = (await pool.query("SELECT sid FROM auth_sessions WHERE sess->'groupingParticipants'->$1->>'participantId'=$2", [activity.id, b.id])).rows[0].sid;
  await pool.query("UPDATE auth_sessions SET sess=jsonb_set(sess::jsonb,'{lineLogin}','{\"syntheticUnrelatedState\":true}'::jsonb)::json WHERE sid=$1", [guestSession]);
  const joinedEmail = `grouping-login-${randomUUID()}@example.test`, joinedPassword = randomUUID();
  const registered = await sameName('/api/auth/register', 'POST', { email: joinedEmail, password: joinedPassword, displayName: 'Synthetic joined browser' });
  assert.equal(registered.status, 200);
  await view(sameName, idPath, [b.id], b.id);
  const registeredSession = (await pool.query("SELECT sid,sess FROM auth_sessions WHERE sess->'groupingParticipants'->$1->>'participantId'=$2", [activity.id, b.id])).rows[0];
  assert.notEqual(registeredSession.sid, guestSession, 'registration still rotates the signed session ID');
  assert.equal(registeredSession.sess.lineLogin, undefined, 'unrelated OAuth state is not migrated');
  assert.equal((await pool.query('SELECT 1 FROM auth_sessions WHERE sid=$1', [guestSession])).rowCount, 0);
  const loggedIn = await sameName('/api/auth/email-login', 'POST', { email: joinedEmail, password: joinedPassword });
  assert.equal(loggedIn.status, 200);
  await view(sameName, idPath, [b.id], b.id);
  const loginSession = (await pool.query("SELECT sid FROM auth_sessions WHERE sess->'groupingParticipants'->$1->>'participantId'=$2", [activity.id, b.id])).rows[0].sid;
  assert.notEqual(loginSession, registeredSession.sid, 'email login still rotates the signed session ID');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM grouping_participants WHERE activity_id=$1', [activity.id])).rows[0].n, 5);

  const spoof = `?participantId=${a.id}&userId=${owner.id}&ownerId=${owner.id}&role=admin&canManage=true&name=${encodeURIComponent(sharedName)}`;
  await view(outsider, idPath + spoof, [], null);
  await view(outsider, codePath + spoof, [], null);
  await view(outsider, `${idPath}?participantId=${a.id}&participantId=${b.id}&participantId[]=${c.id}&owner=${owner.id}`, [], null);
  await view(sameName, `${idPath}?participantId=${a.id}&ownerId=${owner.id}&role=admin`, [b.id], b.id);
  await view(otherLeader.client, idPath + spoof, [], null);
  await view(otherLeader.client, codePath, [], null);
  const forgedManager = { ownerId: owner.id, userId: owner.id, participantId: a.id, role: 'admin' };
  for (const action of ['execute', 'close']) {
    await request(otherLeader.client, `${idPath}/${action}${spoof}`, 403, 'POST', forgedManager);
    await request(outsider, `${idPath}/${action}${spoof}`, 401, 'POST', forgedManager);
  }
  assert.equal((await pool.query('SELECT status FROM grouping_activities WHERE id=$1', [activity.id])).rows[0].status, 'joining');
  await view(owner.client, idPath, allIds, null, true);
  await view(owner.client, codePath, allIds, null, true);
  await view(admin.client, idPath, allIds, null, true);
  await view(admin.client, codePath, allIds, null, true);
  const ownedActivities = await (await request(owner.client, '/api/grouping/my-activities')).json() as { activities: View[] };
  assert.deepEqual(ownedActivities.activities.find(item => item.activity.id === activity.id)?.participants.map(member => member.id).sort(), [...allIds].sort());
  const otherActivities = await (await request(otherLeader.client, '/api/grouping/my-activities')).json() as { activities: View[] };
  assert(!otherActivities.activities.some(item => item.activity.id === activity.id), 'another leader cannot list the owner roster');
  console.log('PASS grouping privacy: anonymous metadata, durable guest identity, same-name non-takeover, spoofed IDs/roles rejected, owner/admin roster retained');

  const execution = await (await request(owner.client, `${idPath}/execute`, 200, 'POST')).json() as View;
  assert.equal(execution.activity.status, 'finished');
  assert.deepEqual(execution.participants.map(member => member.id).sort(), [...allIds].sort());
  // Deterministic synthetic assignments exercise group visibility independently of random shuffle order.
  await pool.query(`UPDATE grouping_participants SET group_number=CASE
    WHEN id=ANY($2::uuid[]) THEN 1 WHEN id=$3::uuid THEN 2 ELSE NULL END WHERE activity_id=$1`, [activity.id, [a.id, c.id], b.id]);
  const finished = await view(first, idPath, [a.id, c.id], a.id);
  assert.equal(finished.activity.status, 'finished', 'finished activity remains readable through its ID');
  assert(finished.participants.every(member => member.groupNumber === 1));
  await view(peer, idPath, [a.id, c.id], c.id);
  await view(sameName, idPath, [b.id], b.id);
  await view(ungrouped, idPath, [d.id], d.id);
  await view(otherUngrouped, idPath, [e.id], e.id);
  await view(first, `${idPath}?participantId=${b.id}&groupNumber=2&ownerId=${owner.id}&role=admin`, [a.id, c.id], a.id);
  await view(outsider, idPath + spoof, [], null);
  await view(otherLeader.client, idPath + spoof, [], null);
  await view(owner.client, idPath, allIds, null, true);
  await view(admin.client, idPath, allIds, null, true);
  for (const client of [outsider, first, owner.client, admin.client]) await request(client, codePath, 404);
  const finishedRejoin = await (await request(first, `${idPath}/join`, 200, 'POST', { name: sharedName, gender: 'M' })).json() as Participant;
  assert.equal(finishedRejoin.id, a.id, 'bound browser can restore its participant after execution');
  await request(outsider, `${idPath}/join`, 400, 'POST', { name: 'Synthetic late stranger', gender: 'F', participantId: a.id });
  for (const action of ['execute', 'close']) await request(otherLeader.client, `${idPath}/${action}`, 403, 'POST', forgedManager);
  console.log('PASS grouping privacy: finished ID safe views, own-group filtering, distinct null groups, finished code 404, existing-browser rejoin retained');

  assert.deepEqual(await (await request(admin.client, `${idPath}/close`, 200, 'POST')).json(), { success: true });
  for (const client of [outsider, first, owner.client, admin.client]) {
    await request(client, idPath, 404);
    await request(client, codePath, 404);
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM grouping_participants WHERE activity_id=$1', [activity.id])).rows[0].n, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM grouping_activities WHERE id=$1', [activity.id])).rows[0].n, 0);

  // Exercise the converse manager operations through HTTP as well: admin executes, owner closes.
  const second = await create(), secondPath = `/api/grouping/${second.id}`;
  const secondIds: string[] = [];
  for (const [name, gender] of [['Synthetic second male', 'M'], ['Synthetic second female', 'F']]) {
    const participant = await (await request(makeClient(), `${secondPath}/join`, 200, 'POST', { name, gender })).json() as Participant;
    secondIds.push(participant.id);
  }
  const adminExecution = await (await request(admin.client, `${secondPath}/execute`, 200, 'POST')).json() as View;
  assert.equal(adminExecution.activity.status, 'finished');
  assert.deepEqual(adminExecution.participants.map(member => member.id).sort(), [...secondIds].sort());
  await view(owner.client, secondPath, secondIds, null, true);
  await view(admin.client, secondPath, secondIds, null, true);
  assert.deepEqual(await (await request(owner.client, `${secondPath}/close`, 200, 'POST')).json(), { success: true });
  await request(owner.client, secondPath, 404);
  await request(admin.client, secondPath, 404);
  await request(outsider, `/api/grouping/code/${second.shortCode}`, 404);
  console.log('PASS grouping privacy: owner/admin execute and close, deletion revokes every view, private no-store on successes and denials');
}
