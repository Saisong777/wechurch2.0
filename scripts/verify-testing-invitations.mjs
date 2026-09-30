import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { inspectStaging, root, target } from './railway-staging.mjs';

const { app } = inspectStaging();
const dir = path.join(root, 'artifacts/railway-staging');
const admin = JSON.parse(fs.readFileSync(path.join(dir, 'test-account.json'), 'utf8'));
function session() {
  const cookies = new Map();
  return async (url, method = 'GET', body) => {
    const response = await fetch(target.origin + url, { method, redirect: 'manual', headers: { Origin: target.origin, Cookie: [...cookies.values()].join('; '), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const raw of response.headers.getSetCookie()) { const pair = raw.split(';')[0]; cookies.set(pair.split('=')[0], pair); }
    return response;
  };
}
async function json(response, status = 200) { assert.equal(response.status, status, `Unexpected HTTP ${response.status}`); return response.json(); }
const owner = session();
assert.equal((await owner('/__staging/access', 'POST', { code: app.STAGING_ACCESS_CODE })).status, 303);
await json(await owner('/api/auth/email-login', 'POST', admin));
const groups = await json(await owner('/api/life-groups'));
let group = groups.groups.find(g => g.name === '同工測試小組' && g.manager);
if (!group) group = await json(await owner('/api/life-groups', 'POST', { name: '同工測試小組' }), 201);
const invitation = await json(await owner(`/api/life-groups/${group.id}/invite`, 'POST', {}));
assert.ok(invitation.url.startsWith('/__staging/invite#'));
const fragment = new URLSearchParams(invitation.url.split('#')[1]);
const guest = session();
assert.equal((await guest('/api/auth/register', 'POST', {})).status, 401);
const access = await guest('/__staging/access', 'POST', { ticket: fragment.get('ticket'), group: fragment.get('group') });
assert.equal(access.status, 303);
assert.equal(access.headers.get('location'), `/groups#invite=${invitation.token}`);
assert.equal((await guest('/api/life-groups')).status, 401);
const email = `invitation-check-${randomBytes(6).toString('hex')}@example.invalid`;
const password = randomBytes(24).toString('base64url');
const member = { email, password, displayName: '【自動驗收】一般測試成員' };
await json(await guest('/api/auth/register', 'POST', member));
const user = await json(await guest('/api/auth/user'));
assert.ok(user.legacyUserId);
const own = await json(await guest('/api/life-groups'));
assert.equal(own.canCreate, false);
assert.equal((await guest(`/api/life-groups/${group.id}`)).status, 404);
const joined = await json(await guest('/api/life-groups/join', 'POST', { token: invitation.token }));
assert.equal(joined.status, 'pending');
assert.equal((await guest(`/api/life-groups/${group.id}`)).status, 404);
const requests = await json(await owner(`/api/life-groups/${group.id}`));
assert.ok(requests.requests.some(r => r.id === user.legacyUserId));
await json(await owner(`/api/life-groups/${group.id}/requests/${user.legacyUserId}`, 'POST', { approve: true }));
const approved = await json(await guest(`/api/life-groups/${group.id}`));
assert.equal(approved.manager, false);
assert.equal((await guest(`/api/life-groups/${group.id}/invite`, 'POST', {})).status, 404);
await json(await owner(`/api/life-groups/${group.id}/members/${user.legacyUserId}`, 'DELETE'));
assert.equal((await guest(`/api/life-groups/${group.id}`)).status, 404);
const relogin = session();
assert.equal((await relogin('/__staging/access', 'POST', { ticket: fragment.get('ticket') })).status, 303);
await json(await relogin('/api/auth/email-login', 'POST', member));
fs.writeFileSync(path.join(dir, 'invitation-test-account.json'), JSON.stringify(member), { mode: 0o600 });
fs.writeFileSync(path.join(dir, 'coworker-invitation.json'), JSON.stringify({ groupId: group.id, ...invitation }), { mode: 0o600 });
fs.writeFileSync(path.join(dir, 'coworker-invitation.txt'), `WeChurch 同工測試邀請\n\n${target.origin}${invitation.url}\n\n有效至：${invitation.expiresAt}\n點開後接受邀請，建立自己的帳號，再送出小組加入申請。已經有 B 站帳號的人可選「已有帳號」。\n小組長確認後即可一起讀經、分享與代禱。請勿輸入真實的牧養隱私。\n此連結限受邀同工，請勿公開轉貼。\n`, { mode: 0o600 });
console.log({ passed: ['invite access without master code', 'registration and fresh-session login', 'ordinary member has no admin access', 'pending cannot read group', 'approval grants member-only access', 'removal revokes access'], invitationFile: 'artifacts/railway-staging/coworker-invitation.txt', syntheticMemberRemovedFromGroup: true, productionTouched: false });
