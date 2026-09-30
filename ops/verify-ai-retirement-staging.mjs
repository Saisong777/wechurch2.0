import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const { app, productionDeployment } = inspectStaging();
const run = randomUUID(), output = path.join(root, 'output/playwright/ai-retirement', run);
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const people = ['admin', 'member'].map(role => {
  const id = randomUUID(), authId = randomUUID(), sid = 'retired-ai-' + randomUUID(), email = `retired-ai-${id}@example.test`;
  const expires = new Date(Date.now() + 1800000);
  const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
  const signature = createHmac('sha256', app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return { id, authId, sid, email, role, session, expires, cookie: encodeURIComponent(`s:${sid}.${signature}`) };
});
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const ids = people.map(p => sql(p.id)).join(',');
const cli = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
let evidence;
try {
  stagingSql('BEGIN;\n' + people.map(p => `INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(p.id)},${sql(p.email)},'!disabled-fixture','系統紀錄驗收','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(p.authId)},${sql(p.email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(p.id)},${sql(p.role)});
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(p.sid)},${sql(JSON.stringify(p.session))},${sql(p.expires.toISOString())});`).join('\n') + '\nCOMMIT;');
  execFileSync(cli, ['-s=retired-ai', 'open', target.origin], { cwd: root, stdio: 'pipe', timeout: 60000 });
  const script = `async page => {
    const origin=${JSON.stringify(target.origin)}, output=${JSON.stringify(output)}, people=${JSON.stringify(people.map(p => ({ id: p.id, cookie: p.cookie })))};
    const gate=await page.context().request.post(origin+'/__staging/access',{headers:{Origin:origin},data:{code:${JSON.stringify(app.STAGING_ACCESS_CODE)}},maxRedirects:0});
    if(gate.status()!==303) throw Error('B gate failed');
    let modelCalls=0;
    page.on('request', req => { if(/api.openai.com|generativelanguage.googleapis.com/.test(req.url()))modelCalls++; });
    async function login(index,route) {
      await page.context().addCookies([{name:'connect.sid',value:people[index].cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
      await page.goto(origin+route);
      const me=await page.context().request.get(origin+'/api/auth/user');
      if(me.status()!==200||(await me.json()).legacyUserId!==people[index].id) throw Error('Fixture identity mismatch');
    }
    const checks=[];
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:844});
      await login(0,'/admin');
      await page.getByText('系統紀錄',{exact:true}).click();
      const panel=page.getByRole('region',{name:'使用與錯誤紀錄',exact:true});
      await panel.getByText('已記錄的操作次數').waitFor();
      const response=await page.context().request.get(origin+'/api/admin/platform-summary');
      const summary=await response.json();
      if(response.status()!==200||'aiUsage' in summary||'healthScore' in summary)throw Error('Summary contract failed');
      if(await panel.getByText(/健康分數|AI 品質|平台成熟度/).count())throw Error('Retired metrics visible');
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Horizontal overflow');
      await panel.screenshot({path:output+'/'+width+'-records.png',animations:'disabled'});
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','dark'));
      await page.reload(); await page.getByText('系統紀錄',{exact:true}).click();
      await panel.getByText('已記錄的操作次數').waitFor();
      await panel.screenshot({path:output+'/'+width+'-dark.png',animations:'disabled'});
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','light'));
      await login(1,'/learn/reading-plans');
      await page.getByTestId('button-view-create').waitFor();
      if(await page.getByText(/AI 整合分析|AI 品質/).count())throw Error('AI reading entry visible');
      await page.getByTestId('button-view-create').click();
      await page.getByTestId('select-add-book-trigger').waitFor();
      await page.getByTestId('select-add-book-trigger').click();
      await page.getByRole('option').first().click();
      await page.getByTestId('input-plan-name').fill('Temporary unsaved reading plan');
      if(!(await page.getByTestId('button-create-plan').isEnabled()))throw Error('Reading plan form unavailable');
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Reading plan overflow');
      await page.screenshot({path:output+'/'+width+'-reading.png',fullPage:true,animations:'disabled'});
      if((await page.context().request.get(origin+'/api/admin/platform-summary')).status()!==403)throw Error('Member can read admin telemetry');
      for(const endpoint of ['/api/devotional-notes/analyze','/api/devotional-notes/analyze-batch','/api/devotional-notes/analyze-group','/api/sessions/'+people[0].id+'/reports/stream','/api/prayer-meetings/'+people[0].id+'/classify-prayers']) {
        const r=await page.context().request.post(origin+endpoint,{headers:{Origin:origin},data:{}});
        if(r.status()!==410)throw Error('Retired API still active: '+endpoint);
      }
      checks.push({width,records:true,dark:true,readingPlanPreserved:true,aiAbsent:true,memberDenied:true,retiredApis:true});
    }
    if(modelCalls)throw Error('Model provider request observed');
    return {checks,modelCalls,physicalPhoneTested:false,fixtureSession:true};
  }`;
  let raw;
  try { raw = execFileSync(cli, ['-s=retired-ai', 'run-code', script], { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 }); }
  catch { throw new Error('Browser verification failed; credential-bearing output withheld'); }
  const result = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!result) {
    const diagnostic = raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1000);
    if (diagnostic && ![app.SESSION_SECRET, app.STAGING_ACCESS_CODE, ...people.map(p => p.cookie)].some(value => diagnostic.includes(value))) console.error(diagnostic);
    throw new Error('No browser evidence; raw output withheld');
  }
  evidence = JSON.parse(result);
} finally {
  try { execFileSync(cli, ['-s=retired-ai', 'close'], { cwd: root, stdio: 'pipe', timeout: 30000 }); } catch { /* Continue fixture cleanup. */ }
  stagingSql(`BEGIN;
    DELETE FROM auth_sessions WHERE sid IN (${people.map(p => sql(p.sid)).join(',')});
    DELETE FROM user_roles WHERE user_id IN (${ids});
    DELETE FROM users WHERE id IN (${ids});
    DELETE FROM auth_users WHERE id IN (${people.map(p => sql(p.authId)).join(',')}); COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN (${ids})`), '0');
}
assert.equal(inspectStaging().productionDeployment, productionDeployment);
evidence = { ...evidence, fixtureRemoved: true, productionUnchanged: true, at: new Date().toISOString() };
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
