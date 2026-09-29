import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const origin = process.argv[2] || target.origin;
const local = new URL(origin).hostname === '127.0.0.1' && new URL(origin).protocol === 'http:';
assert(local || origin === target.origin, 'Only loopback preview or the verified B site is allowed');
const state = local ? null : inspectStaging();
const id = randomUUID(), authId = randomUUID(), sid = `devotion-ui-${randomUUID()}`, email = `devotion-ui-${id}@example.test`;
const output = path.join(root, 'output/playwright/devotion-topics', randomUUID());
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const expires = new Date(Date.now() + 1800000);
const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
const cookie = state ? encodeURIComponent(`s:${sid}.${createHmac('sha256', state.app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '')}`) : null;
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const wrapper = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
const cli = (...args) => execFileSync(wrapper, ['-s=devotion-topics', ...args], { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
let result;
async function journey(page, config) {
  const { origin, local, cookie, code, id, output } = config;
  const errors = [], checks = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  if (!local) {
    const gate = await page.context().request.post(origin + '/__staging/access', { headers: { Origin: origin }, data: { code }, maxRedirects: 0 });
    if (gate.status() !== 303) throw Error('B gate failed');
    await page.context().addCookies([{ name: 'connect.sid', value: cookie, url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const me = await page.context().request.get(origin + '/api/auth/user');
    if (me.status() !== 200 || (await me.json()).legacyUserId !== id) throw Error('Fixture identity mismatch');
  } else {
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(new URL(route.request().url()).pathname === '/api/auth/user' ? { id, legacyUserId: id, role: 'admin', email: 'fixture@example.test', displayName: '測試管理員' } : []) }));
  }
  // The admin UI may read real schedules on B, but this acceptance never changes them.
  await page.route('**/api/admin/church-devotions**', async route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) { writes.push(route.request().method()); return route.abort(); }
    return route.fallback();
  });
  const url = origin + '/admin/church-devotions';
  if (!local) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await page.getByRole('region', { name: '主題課表' }).waitFor();
    if (await page.getByRole('table').count()) throw Error('Live schedule should start collapsed');
    await page.screenshot({ path: output + '/live-collapsed-390.png', fullPage: true });
    await page.getByRole('button', { name: '全部展開', exact: true }).click();
    await page.getByRole('table').first().waitFor();
    await page.screenshot({ path: output + '/live-expanded-390.png' });
    checks.push({ mode: 'live B', collapsedAndExpanded: true });
  }
  const fixture = Array.from({ length: 12 }, (_, n) => ({ id: 'fixture-' + n, date: '2026-09-' + String(n + 1).padStart(2, '0'),
    planName: n < 8 ? '在時局震盪中，解鎖榮耀的未來：66 天的生命校準之旅' : '與耶穌同行：在日常生活中活出愛', dayNumber: n + 1,
    scriptureReference: '約翰福音 3:16–21', scriptureText: '', devotionalTitle: n === 0 ? '今日焦點：在改變中學習信靠與彼此相愛' : '每日默想 ' + n,
    devotionalText: '完整靈修短文保持不變。', prayer: '', loveAction: '', status: n % 3 ? 'published' : 'draft', version: n + 1, updatedAt: '2026-09-01T00:00:00Z' }));
  await page.route('**/api/admin/church-devotions?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await page.getByText('2 個主題 · 12 筆課程', { exact: true }).waitFor();
    if (await page.getByRole('table').count()) throw Error('Collapsed fixture rendered rows');
    await page.screenshot({ path: output + '/collapsed-' + width + '.png', fullPage: true });
    await page.getByRole('checkbox', { name: '選取主題 ' + fixture[0].planName, exact: true }).check();
    await page.getByText('8 筆已選取', { exact: true }).waitFor();
    await page.getByRole('button', { name: '展開主題 ' + fixture[0].planName, exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('table', { name: fixture[0].planName + ' 每日課程', exact: true }).waitFor();
    await page.getByRole('checkbox', { name: '選取 2026-09-01', exact: true }).uncheck();
    if (!await page.getByRole('checkbox', { name: '選取主題 ' + fixture[0].planName, exact: true }).evaluate(el => el.indeterminate)) throw Error('Missing partial selection');
    await page.screenshot({ path: output + '/expanded-' + width + '.png' });
    await page.getByRole('button', { name: '編輯 2026-09-01', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    if (await page.getByLabel('課表名稱', { exact: true }).inputValue() !== fixture[0].planName) throw Error('Wrong editor target');
    // Escape from the text field, not the auto-focused native date control.
    await page.getByLabel('課表名稱', { exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByLabel('搜尋', { exact: true }).fill('今日焦點');
    try { await page.getByText('1 個主題 · 1 筆課程', { exact: true }).waitFor({ timeout: 5000 }); }
    catch { await page.screenshot({ path: output + '/failure-search-' + width + '.png', fullPage: true }); throw Error('Search did not settle at width ' + width + '; input=' + await page.getByLabel('搜尋', { exact: true }).inputValue()); }
    await page.getByRole('table').waitFor();
    await page.getByText('0 筆已選取', { exact: true }).waitFor();
    await page.getByLabel('搜尋', { exact: true }).fill('沒有符合的短文');
    await page.getByText('沒有符合條件的課程。', { exact: true }).waitFor();
    await page.getByLabel('搜尋', { exact: true }).fill('');
    await page.getByRole('button', { name: '全部展開', exact: true }).click();
    if (await page.getByRole('table').count() !== 2) throw Error('Expand-all missed a topic');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Horizontal overflow at ' + width);
    await page.getByRole('button', { name: '全部收合', exact: true }).click();
    await page.evaluate(() => localStorage.setItem('wechurch-theme', 'dark'));
    await page.reload(); await page.getByText('2 個主題 · 12 筆課程', { exact: true }).waitFor();
    await page.screenshot({ path: output + '/dark-' + width + '.png', fullPage: true });
    await page.evaluate(() => localStorage.setItem('wechurch-theme', 'light'));
    checks.push({ width, grouping: true, keyboard: true, selection: true, editor: true, search: true, empty: true, overflow: false });
  }
  if (errors.length || writes.length) throw Error('Unexpected browser error or content write');
  return { checks, errors, contentWrites: writes.length, fixtureDataMocked: true, physicalPhoneTested: false };
}
try {
  if (state) stagingSql(`BEGIN;
    INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(id)},${sql(email)},'!disabled-fixture','課表驗收','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(authId)},${sql(email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(id)},'admin');
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(sid)},${sql(JSON.stringify(session))},${sql(expires.toISOString())}); COMMIT;`);
  cli('open', 'about:blank'); cli('snapshot');
  const config = { origin, local, cookie, code: state?.app.STAGING_ACCESS_CODE, id, output };
  const raw = cli('run-code', `async page => (${journey.toString()})(page,${JSON.stringify(config)})`);
  const serialized = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!serialized) {
    const diagnostic = raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0,1000);
    if (diagnostic && ![cookie, state?.app.STAGING_ACCESS_CODE, state?.app.SESSION_SECRET].filter(Boolean).some(value => diagnostic.includes(value))) console.error(diagnostic);
    throw Error('Missing browser evidence');
  }
  result = JSON.parse(serialized);
} catch (error) {
  if (error instanceof Error && 'stdout' in error) {
    const diagnostic = String(error.stdout || '').split('### Error\n')[1]?.split('\n###')[0]?.slice(0,1000);
    if (diagnostic && ![cookie, state?.app.STAGING_ACCESS_CODE, state?.app.SESSION_SECRET].filter(Boolean).some(value => diagnostic.includes(value))) console.error(diagnostic);
    console.error({ status: error.status, signal: error.signal, code: error.code });
    throw Error('Browser command failed; credential-bearing output withheld');
  }
  throw error;
} finally {
  try { cli('close'); } catch { /* Always remove the isolated fixture. */ }
  if (state) {
    stagingSql(`BEGIN; DELETE FROM auth_sessions WHERE sid=${sql(sid)}; DELETE FROM user_roles WHERE user_id=${sql(id)}; DELETE FROM users WHERE id=${sql(id)} AND email=${sql(email)}; DELETE FROM auth_users WHERE id=${sql(authId)}; COMMIT;`);
    assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id=${sql(id)}`), '0');
  }
}
if (state) assert.equal(inspectStaging().productionDeployment, state.productionDeployment);
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ ...result, fixtureRemoved: true, productionUnchanged: !!state, at: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ output, ...result, fixtureRemoved: true }));
