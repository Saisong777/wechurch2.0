import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const { app, productionDeployment } = inspectStaging();
const runId = randomUUID();
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const people = ['pastor', 'minister', 'member'].map(role => {
  const id = randomUUID(), authId = randomUUID(), sid = `crm-capability-${randomUUID()}`;
  const email = `crm-capability-${id}@example.test`, expires = new Date(Date.now() + 900000);
  const session = { cookie: { originalMaxAge: 900000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' },
    passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
  const signature = createHmac('sha256', app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return { id, authId, sid, email, role, expires, session, cookie: `connect.sid=${encodeURIComponent(`s:${sid}.${signature}`)}` };
});
const grants = [randomUUID(), randomUUID()];
const checks = [];
let gateCookie = '';
async function call(actor, route, method = 'GET', body) {
  const response = await fetch(target.origin + route, { method, redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { Origin: target.origin, Cookie: [gateCookie, actor?.cookie].filter(Boolean).join('; '), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, data: response.headers.get('content-type')?.includes('json') && text ? JSON.parse(text) : null };
}
try {
  const gate = await fetch(target.origin + '/__staging/access', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { Origin: target.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: app.STAGING_ACCESS_CODE }) });
  assert.equal(gate.status, 303);
  gateCookie = gate.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  await gate.body?.cancel();
  stagingSql('BEGIN;\n' + people.map(p => `
    INSERT INTO users(id,email,password,display_name,church) VALUES(${literal(p.id)},${literal(p.email)},'!disabled-fixture','權限驗收','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${literal(p.authId)},${literal(p.email)});
    INSERT INTO user_roles(user_id,role) VALUES(${literal(p.id)},${literal(p.role)});
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${literal(p.sid)},${literal(JSON.stringify(p.session))},${literal(p.expires.toISOString())});
  `).join('\n') + grants.map((id, i) => `INSERT INTO crm_scope_assignments(id,assignee_user_id,assigned_by_user_id,scope_type,member_user_id,can_view_personal,can_manage_care,can_manage_members)
    VALUES(${literal(id)},${literal(people[i].id)},${literal(people[i].id)},'member',${literal(people[2].id)},false,true,false);`).join('\n') + '\nCOMMIT;');
  const member = people[2];
  for (const [i, actor] of people.slice(0, 2).entries()) {
    assert.equal((await call(actor, '/api/auth/user')).data.legacyUserId, actor.id);
    const users = await call(actor, '/api/users?church=all');
    assert.equal(users.status, 200);
    assert(users.data.every(u => u.id === actor.id || u.id === member.id), 'Scope must only contain this run fixtures');
    assert(users.data.some(u => u.id === member.id && !Object.hasOwn(u, 'email')));
    const profile = `/api/users/${member.id}/profile`;
    assert.equal((await call(actor, profile)).status, 403);
    assert.equal((await call(actor, profile, 'PATCH', { displayName: 'Denied mutation' })).status, 403);
    stagingSql(`UPDATE crm_scope_assignments SET can_view_personal=true WHERE id=${literal(grants[i])} AND assignee_user_id=${literal(actor.id)};`);
    assert.equal((await call(actor, profile)).status, 200);
    const granted = await call(actor, '/api/users?church=all');
    assert.equal(granted.data.find(u => u.id === member.id).email, member.email);
    stagingSql(`UPDATE crm_scope_assignments SET is_active=false WHERE id=${literal(grants[i])} AND assignee_user_id=${literal(actor.id)};`);
    assert.equal((await call(actor, profile)).status, 403);
    assert(!(await call(actor, '/api/users?church=all')).data.some(u => u.id === member.id));
    checks.push({ role: actor.role, identity: true, scopedList: true, personalRedacted: true, profileDenied: true, memberMutationDenied: true, explicitGrant: true, revocation: true });
  }
} finally {
  const ids = people.map(p => literal(p.id)).join(',');
  stagingSql(`BEGIN;
    DELETE FROM crm_scope_assignments WHERE id IN (${grants.map(literal).join(',')});
    DELETE FROM auth_sessions WHERE sid IN (${people.map(p => literal(p.sid)).join(',')});
    DELETE FROM user_roles WHERE user_id IN (${ids});
    DELETE FROM users WHERE id IN (${ids}) AND email IN (${people.map(p => literal(p.email)).join(',')});
    DELETE FROM auth_users WHERE id IN (${people.map(p => literal(p.authId)).join(',')});
    COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN (${ids})`), '0');
  assert.equal(stagingSql(`SELECT count(*) FROM crm_scope_assignments WHERE id IN (${grants.map(literal).join(',')})`), '0');
}
assert.equal(inspectStaging().productionDeployment, productionDeployment);
const directory = path.join(root, 'output/crm-capability', runId);
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const result = { runId, at: new Date().toISOString(), checks, fixtureRemoved: true, productionUnchanged: true };
fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, directory }));
