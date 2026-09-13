import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { inspectStaging, root, target } from './railway-staging.mjs';

const { app, database } = inspectStaging();
const evidence = path.join(root, 'artifacts/railway-staging');
const credentialsFile = path.join(evidence, 'test-account.json');
const credentials = fs.existsSync(credentialsFile)
  ? JSON.parse(fs.readFileSync(credentialsFile, 'utf8'))
  : { email: `sai-preview-${randomBytes(4).toString('hex')}@example.invalid`, password: randomBytes(12).toString('base64url'), displayName: 'Sai 測試管理員' };
fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
let cookie = '';
async function call(url, method = 'GET', body) {
  const response = await fetch(target.origin + url, { method, redirect: 'manual', headers: { Cookie: cookie, Origin: target.origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const item of response.headers.getSetCookie()) {
    const pair = item.split(';')[0];
    cookie = cookie.split('; ').filter(p => p && !p.startsWith(pair.split('=')[0] + '=')).concat(pair).join('; ');
  }
  return response;
}
async function data(response, status = 200) {
  assert.equal(response.status, status, `Unexpected HTTP ${response.status}`);
  return response.json();
}
const results = [];
assert.equal((await call('/')).status, 401);
assert.equal((await call('/api/auth/register', 'POST', {})).status, 401);
assert.equal((await call('/__healthcheck')).status, 200);
assert.equal((await call('/__staging/access', 'POST', { code: 'not-the-invitation' })).status, 401);
const access = await call('/__staging/access', 'POST', { code: app.STAGING_ACCESS_CODE });
assert.equal(access.status, 303);
assert.ok(access.headers.get('set-cookie').includes('Secure'));
assert.deepEqual(await data(await call('/api/deployment')), { staging: true });
assert.equal((await call('/api/prayers')).status, 401, 'Invitation must not substitute for member login');
for (const url of ['/api/dev-login', '/api/login', '/api/line-login/url', '/api/cron/daily-follow-email', '/api/webhooks/resend']) assert.equal((await call(url)).status, 403);
results.push('Invitation gate, secure cookie, member login required, external integrations blocked');
let login = await call('/api/auth/email-login', 'POST', credentials);
if (login.status === 401) login = await call('/api/auth/register', 'POST', credentials);
await data(login);
const user = await data(await call('/api/auth/user'));
assert.ok(user.legacyUserId);
assert.equal(user.email, credentials.email);
const client = new pg.Client({ connectionString: database.DATABASE_PUBLIC_URL });
await client.connect();
try {
  // This randomly named account was created in B by this verification, never imported from A.
  const existing = await client.query('SELECT id FROM user_roles WHERE user_id=$1', [user.legacyUserId]);
  if (!existing.rowCount) await client.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [user.legacyUserId]);
  for (const endpoint of ['/api/prayers', '/api/devotion-wall', '/api/devotional-notes', '/api/personal-prayers', '/api/life-groups']) await data(await call(endpoint));
  const note = await data(await call('/api/devotional-notes', 'POST', { verseReference: '約翰福音 1:1', verseText: '太初有道，道與神同在，道就是神。', titlePhrase: 'B 站驗收筆記', observation: '僅本人可見的測試觀察', actionPlan: '僅本人可見的測試行動', coreInsightNote: '這是測試分享，並非正式靈修教材。' }), 201);
  const window = await data(await call('/api/devotion-wall/window'));
  const share = await data(await call('/api/devotion-wall', 'POST', { sourceId: note.id, day: window.day, title: 'B 站靈修分享測試', body: '這是一筆驗收資料，確認心得能分享到今日靈修牆。', reference: '約翰福音 1:1', anonymous: true, consent: true }), 201);
  const wall = await data(await call('/api/devotion-wall'));
  assert.ok(wall.posts.some(p => p.id === share.id && p.authorName === '匿名'));
  assert.ok(!JSON.stringify(wall).includes('僅本人可見'));
  await data(await call(`/api/devotion-wall/${share.id}`, 'DELETE'));
  const prayer = await data(await call('/api/prayers', 'POST', { content: 'B 站驗收用代禱，並非真實代禱需求。', isAnonymous: true, isUrgent: true }), 201);
  await data(await call(`/api/prayers/${prayer.id}/reactions/heart`, 'PUT', { selected: true }));
  await data(await call(`/api/prayers/${prayer.id}/comments`, 'POST', { content: 'B 站互動測試', requestId: randomUUID() }), 201);
  await data(await call(`/api/prayers/${prayer.id}`, 'PATCH', { isClosed: true }));
  assert.ok(!(await data(await call('/api/prayers'))).some(p => p.id === prayer.id));
  assert.ok((await data(await call('/api/prayers?view=my'))).some(p => p.id === prayer.id && p.closedAt));
  results.push('Private notes, anonymous public excerpts, withdrawal, prayer reactions/comments, owner archive');
  fs.writeFileSync(path.join(evidence, 'live-verification.json'), JSON.stringify({ at: new Date().toISOString(), origin: target.origin, results, userId: user.legacyUserId, noteId: note.id, prayerId: prayer.id }, null, 2), { mode: 0o600 });
  fs.writeFileSync(path.join(evidence, 'access.txt'), `B 測試站：${target.origin}\n測試邀請碼：${app.STAGING_ACCESS_CODE}\n\n管理員測試帳號：${credentials.email}\n登入密碼：${credentials.password}\n\n僅供 B 測試站，請勿輸入正式會員或牧養隱私。邀請碼輸入一次可保留 30 天。\n`, { mode: 0o600 });
  console.log({ passed: results, credentials: 'artifacts/railway-staging/access.txt' });
} finally { await client.end(); }
