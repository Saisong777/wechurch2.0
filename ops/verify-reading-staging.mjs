import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const state = inspectStaging();
const id = randomUUID(), authId = randomUUID(), sid = `reading-ui-${randomUUID()}`, email = `reading-ui-${id}@example.test`;
const output = path.join(root, 'output/playwright/reading', randomUUID());
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const expires = new Date(Date.now() + 3600000);
const session = { cookie: { originalMaxAge: 3600000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
const cookie = encodeURIComponent(`s:${sid}.${createHmac('sha256', state.app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '')}`);
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const cli = (...args) => {
  try { return execFileSync(path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh'), ['-s=reading-acceptance', ...args], { cwd: root, encoding: 'utf8', timeout: 900000, maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) {
    let detail = String(error.stdout || error.stderr || '').split('### Error\n').at(-1).split('### Ran')[0];
    for (const secret of [cookie, state.app.STAGING_ACCESS_CODE, state.app.SESSION_SECRET]) if (secret) detail = detail.replaceAll(secret, '[redacted]');
    console.error({ status: error.status, signal: error.signal, detail: detail.slice(0, 1000) });
    throw Error('Browser operation failed; command withheld');
  }
};
async function journey(page, { origin, code, cookie, id, output }) {
  const checks = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const gate = await page.context().request.post(origin + '/__staging/access', { headers: { Origin: origin }, data: { code }, maxRedirects: 0 });
  if (gate.status() !== 303) throw Error('Gate failed');
  await page.context().addCookies([{ name: 'connect.sid', value: cookie, url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const me = await page.context().request.get(origin + '/api/auth/user');
  if (me.status() !== 200 || (await me.json()).legacyUserId !== id) throw Error('Fixture identity mismatch');
  // UI-only note fixture: never writes private notes or publishes to a wall.
  const note = { id: 'reading-fixture', userId: id, readingPlanId: null, verseReference: '以賽亞書 61:1-全', verseText: '主耶和華的靈在我身上。', observation: '看見身邊有需要的人，願意停下來聆聽。\n這是閱讀字級驗收用筆記。', coreInsightNote: '在每天的生活中，用耐心與溫柔陪伴彼此，也練習接納自己的有限。', actionPlan: '今天主動關心一位朋友。', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await page.route('**/api/devotional-notes', route => route.fulfill({ json: [note] }));
  await page.route('**/api/devotional-notes/reading-fixture', route => route.fulfill({ json: note }));
  await page.route('**/api/access-control', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.users = data.users.filter(u => u.id === id); data.grants = []; data.history = []; data.legacyScopes = []; data.appointments = []; data.groups = [];
    await route.fulfill({ response, json: data });
  });
  const go = async route => {
    await page.goto(origin + route);
    await page.locator('main').first().waitFor();
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  };
  const metrics = () => page.evaluate(() => {
    const visible = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const offenders = [...document.querySelectorAll('main *,header *,[data-testid=mobile-navigation] *')].filter(e => {
      if (!visible(e) || e.closest('[hidden]')) return false;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || (r.left >= -1 && r.right <= innerWidth + 1)) return false;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (['auto','scroll','hidden'].includes(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth + 1) return false;
      }
      return true;
    }).slice(0,8).map(e => ({ tag: e.tagName, cls: typeof e.className === 'string' ? e.className.slice(0,160) : '', test: e.getAttribute('data-testid') }));
    return { rootSize: getComputedStyle(document.documentElement).fontSize, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1, offenders };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/learn/my-notes');
  await page.getByTestId('card-devotional-note-reading-fixture').click();
  const baseline = await page.getByTestId('card-devotional-note-reading-fixture').locator('.reading-copy').first().evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  if (baseline < 20) throw Error('Default note text remains too small');
  await page.getByRole('button', { name: '開啟導覽選單' }).click();
  const menu = page.getByRole('navigation', { name: '行動導覽選單' });
  await menu.getByText('文字大小與字型', { exact: true }).click();
  for (const label of ['精簡','標準','大','特大','最大']) {
    await menu.getByRole('radio', { name: label, exact: true }).check();
    checks.push({ control: label, ...await metrics() });
  }
  await menu.getByRole('radio', { name: '閱讀宋體', exact: true }).check();
  await menu.getByRole('button', { name: '恢復預設文字' }).click();
  await menu.getByRole('radio', { name: '最大', exact: true }).check();
  await menu.getByRole('radio', { name: '閱讀宋體', exact: true }).check();
  await page.screenshot({ path: output + '/mobile-reading-settings.png' });
  await page.getByRole('button', { name: '關閉導覽選單' }).click();
  await page.reload();
  await page.getByTestId('card-devotional-note-reading-fixture').click();
  const enlarged = await page.getByTestId('card-devotional-note-reading-fixture').locator('.reading-copy').first().evaluate(e => ({ size: parseFloat(getComputedStyle(e).fontSize), font: getComputedStyle(e).fontFamily }));
  if (enlarged.size / baseline !== 2 || !enlarged.font.includes('serif')) throw Error('Size/font persistence failed');
  const routes = ['/', '/learn', '/learn/my-notes', '/learn/church-reading', '/learn/bible?book=43&chapter=3', '/share', '/grace-record', '/walls', '/groups', '/care', '/me', '/admin', '/admin/access'];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const size of ['standard','maximum']) {
      await page.evaluate(size => { localStorage.setItem('wechurch-reading-preferences', JSON.stringify({ size, font: size === 'maximum' ? 'serif' : 'sans' })); localStorage.setItem('wechurch-theme', size === 'maximum' ? 'dark' : 'light'); }, size);
      for (const route of routes) {
        await go(route === '/admin/access' ? route + '?member=' + id : route);
        if (route === '/learn/my-notes') await page.getByTestId('card-devotional-note-reading-fixture').click();
        const layout = await metrics();
        checks.push({ route, width, size, ...layout });
        if ((['/learn/my-notes','/me','/learn/church-reading','/learn/bible?book=43&chapter=3'].includes(route) && width !== 768) || layout.offenders.length || layout.pageOverflow) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `${output}/${route.split('?')[0].replaceAll('/','-') || 'home'}-${width}-${size}.png`, fullPage: true });
          if (route === '/learn/my-notes') await page.screenshot({ path: `${output}/notes-viewport-${width}-${size}.png` });
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/learn/my-notes');
  await page.getByTestId('card-devotional-note-reading-fixture').click();
  await page.getByTestId('button-edit-note-reading-fixture').click();
  await page.getByTestId('textarea-observation').waitFor();
  checks.push({ flow: 'open-note-editor', ...await metrics() });
  await page.screenshot({ path: output + '/note-editor-maximum.png' });
  return { baseline, enlarged, checks, errors, preferencesPersist: true, noteFixtureMocked: true, wroteMemberContent: false, physicalPhoneTested: false };
}
let result;
try {
  stagingSql(`BEGIN; INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(id)},${sql(email)},'!disabled-fixture','閱讀驗收','IM 行動教會'); INSERT INTO auth_users(id,email) VALUES(${sql(authId)},${sql(email)}); INSERT INTO user_roles(user_id,role) VALUES(${sql(id)},'admin'); INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(sid)},${sql(JSON.stringify(session))},${sql(expires.toISOString())}); COMMIT;`);
  cli('open', 'about:blank'); cli('snapshot');
  const config = { origin: target.origin, code: state.app.STAGING_ACCESS_CODE, cookie, id, output };
  const raw = cli('run-code', `async page => (${journey.toString()})(page,${JSON.stringify(config)})`);
  const serialized = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!serialized) {
    let detail = raw.split('### Error\n')[1]?.split('\n###')[0] || 'Missing browser result';
    for (const secret of [cookie, state.app.STAGING_ACCESS_CODE, state.app.SESSION_SECRET]) if (secret) detail = detail.replaceAll(secret, '[redacted]');
    console.error(detail.slice(0,1600)); throw Error('Reading acceptance failed');
  }
  result = JSON.parse(serialized);
} finally {
  try { cli('close'); } catch { /* Always remove fixtures. */ }
  stagingSql(`BEGIN; DELETE FROM auth_sessions WHERE sid=${sql(sid)}; DELETE FROM user_roles WHERE user_id=${sql(id)}; DELETE FROM users WHERE id=${sql(id)} AND email=${sql(email)}; DELETE FROM auth_users WHERE id=${sql(authId)}; COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id=${sql(id)}`),'0');
}
assert.equal(inspectStaging().productionDeployment, state.productionDeployment);
fs.writeFileSync(path.join(output,'results.json'), JSON.stringify({ ...result, fixtureRemoved: true, productionUnchanged: true }, null,2));
const failures = result.checks.filter(c => c.pageOverflow || c.offenders.length);
console.log(JSON.stringify({ output, checks: result.checks.length, failures, errors: result.errors, baseline: result.baseline, enlarged: result.enlarged, fixtureRemoved: true, productionUnchanged: true }));
if (failures.length || result.errors.length) process.exitCode = 1;
