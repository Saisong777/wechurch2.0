import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { inspectStaging, stagingSql, target } from '../scripts/railway-staging.mjs';

// Private, short-lived synthetic members only. Never publish a wall post or touch real notes.
const state = inspectStaging();
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const expiry = new Date(Date.now() + 600000);
const actors = Array.from({ length: 2 }, () => {
  const id = randomUUID(), authId = randomUUID(), sid = `note-delete-${randomUUID()}`;
  const email = `note-delete-${id}@example.test`;
  const session = { cookie: { originalMaxAge: 600000, expires: expiry.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' },
    passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expiry.getTime() / 1000) } } };
  const signed = encodeURIComponent(`s:${sid}.${createHmac('sha256', state.app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '')}`);
  return { id, authId, sid, email, session, signed };
});
const ids = actors.map(a => sql(a.id)).join(',');
let checks = 0;
try {
  stagingSql('BEGIN;' + actors.map(a => `INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(a.id)},${sql(a.email)},'!disabled-fixture','筆記刪除驗收','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(a.authId)},${sql(a.email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(a.id)},'member');
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(a.sid)},${sql(JSON.stringify(a.session))},${sql(expiry.toISOString())});`).join('') + 'COMMIT;');
  const gate = await fetch(target.origin + '/__staging/access', { method: 'POST', redirect: 'manual', headers: { Origin: target.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: state.app.STAGING_ACCESS_CODE }) });
  assert.equal(gate.status, 303);
  const gateCookie = gate.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const call = (actor, route, method = 'GET', body) => fetch(target.origin + route, { method, redirect: 'manual',
    headers: { Origin: target.origin, 'Content-Type': 'application/json', Cookie: `${gateCookie}; connect.sid=${actor.signed}` },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const check = async (actor, route, method, body, status) => { const response = await call(actor, route, method, body); assert.equal(response.status, status, `${method} ${route} status`); checks++; return response; };
  const [owner, other] = actors;
  for (const actor of actors) assert.equal((await (await call(actor, '/api/auth/user')).json()).legacyUserId, actor.id);
  const payload = { verseReference: '驗收經文', verseText: '不含真實會員資料', observation: '一次性私人測試筆記', clientMutationId: randomUUID() };
  const note = await (await check(owner, '/api/devotional-notes', 'POST', payload, 201)).json();
  const route = `/api/devotional-notes/${note.id}`;
  await check(other, route, 'DELETE', { version: 1 }, 404);
  await check(owner, route, 'DELETE', {}, 428);
  await check(owner, route, 'PATCH', { version: 1, observation: '驗收版本保護' }, 200);
  await check(owner, route, 'DELETE', { version: 1 }, 409);
  await check(owner, route, 'GET', undefined, 200);
  await check(owner, route, 'DELETE', { version: 2 }, 200);
  await check(owner, route, 'DELETE', { version: 2 }, 200);
  await check(owner, route, 'GET', undefined, 404);
  await check(owner, '/api/devotional-notes', 'POST', payload, 409);
  await check(other, route, 'DELETE', { version: 2 }, 404);
  assert.equal((await (await call(owner, '/api/devotional-notes')).json()).length, 0);
} finally {
  stagingSql(`BEGIN; DELETE FROM devotional_notes WHERE user_id IN (${ids});
    DELETE FROM devotional_note_deletions WHERE user_id IN (${ids});
    DELETE FROM auth_sessions WHERE sid IN (${actors.map(a => sql(a.sid)).join(',')});
    DELETE FROM user_roles WHERE user_id IN (${ids}); DELETE FROM users WHERE id IN (${ids});
    DELETE FROM auth_users WHERE id IN (${actors.map(a => sql(a.authId)).join(',')}); COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN (${ids})`), '0');
  assert.equal(stagingSql(`SELECT count(*) FROM devotional_notes WHERE user_id IN (${ids})`), '0');
}
assert.equal(inspectStaging().productionDeployment, state.productionDeployment);
console.log(JSON.stringify({ checks, privateNotesOnly: true, fixturesRemoved: true, productionUnchanged: true }));
