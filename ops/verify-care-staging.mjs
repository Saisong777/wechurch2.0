import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const { app, productionDeployment } = inspectStaging();
const run = randomUUID(), output = path.join(root, 'output/playwright/care-b', run);
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const people = ['member', 'pastor', 'member'].map((role, index) => {
  const id = randomUUID(), authId = randomUUID(), sid = 'care-acceptance-' + randomUUID(), email = `care-${id}@example.test`;
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
  const signature = createHmac('sha256', app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return { id, authId, sid, email, role, name: ['關懷驗收成員', '探訪驗收牧者', '隔離驗收成員'][index], session, expires, cookie: encodeURIComponent(`s:${sid}.${signature}`) };
});
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const ids = people.map(p => sql(p.id)).join(',');
const cli = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
let evidence;
try {
  stagingSql('BEGIN;\n' + people.map(p => `INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(p.id)},${sql(p.email)},'!disabled-fixture',${sql(p.name)},'IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(p.authId)},${sql(p.email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(p.id)},${sql(p.role)});
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(p.sid)},${sql(JSON.stringify(p.session))},${sql(p.expires.toISOString())});`).join('\n') + '\nCOMMIT;');
  execFileSync(cli, ['-s=care-b', 'open', target.origin], { cwd: root, stdio: 'pipe', timeout: 60000 });
  const script = `async page => {
    const origin=${JSON.stringify(target.origin)}, output=${JSON.stringify(output)};
    const people=${JSON.stringify(people.map(p => ({ id: p.id, cookie: p.cookie })))};
    const gate=await page.context().request.post(origin+'/__staging/access',{headers:{Origin:origin},data:{code:${JSON.stringify(app.STAGING_ACCESS_CODE)}},maxRedirects:0});
    if(gate.status()!==303) throw Error('B gate failed');
    async function login(index, route='/care') {
      await page.context().addCookies([{name:'connect.sid',value:people[index].cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
      await page.goto(origin+route);
      const me=await page.context().request.get(origin+'/api/auth/user');
      if(me.status()!==200||(await me.json()).legacyUserId!==people[index].id) throw Error('Fixture identity mismatch');
    }
    async function screenshot(name) {
      await page.locator('[data-sonner-toast]').last().waitFor({state:'hidden',timeout:10000});
      await page.evaluate(()=>window.scrollTo(0,0));
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) throw Error('Horizontal overflow: '+name);
      await page.screenshot({path:output+'/'+name+'.png',fullPage:true,animations:'disabled'});
    }
    const checks=[];
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:844});
      await login(0);
      const name='關懷驗收朋友 '+width;
      await page.getByRole('button',{name:'新增對象',exact:true}).click();
      await page.getByLabel('名字',{exact:true}).fill(name);
      await page.getByLabel('與我的關係').fill('同事');
      await page.getByLabel('目前需要').fill('PRIVATE_NEED_'+width);
      await page.getByLabel('代禱方向').fill('PRIVATE_PRAYER_'+width);
      await page.getByLabel('下次關心日期',{exact:true}).fill('2000-01-01');
      if(await page.getByRole('dialog').count()) throw Error('Contact editor must be inline');
      await screenshot(width+'-new-person');
      await page.getByRole('button',{name:'儲存',exact:true}).click();
      await page.getByRole('region',{name:'新增關懷對象',exact:true}).waitFor({state:'hidden'});
      let contacts=await (await page.context().request.get(origin+'/api/care/contacts')).json();
      const contact=contacts.find(c=>c.name===name); if(!contact) throw Error('Contact was not persisted');
      const row=page.getByTestId('care-contact-'+contact.id);
      await row.getByRole('button',{name:'記錄關心',exact:true}).click();
      await row.getByLabel('這次如何關心').selectOption('call');
      await row.getByLabel('這次近況').fill('PRIVATE_HISTORY_'+width);
      await row.getByLabel('下次關心日期',{exact:true}).fill('2099-01-01');
      await screenshot(width+'-record');
      await row.getByRole('button',{name:'儲存紀錄'}).click();
      await row.waitFor({state:'hidden'});
      await page.getByRole('button',{name:/^全部 /}).click();
      await row.locator('button[aria-expanded]').click();
      await row.getByText('PRIVATE_HISTORY_'+width,{exact:true}).waitFor();
      await row.getByRole('button',{name:'編輯'+name,exact:true}).click();
      await page.getByLabel('下次關心日期',{exact:true}).fill('2000-01-01');
      await page.getByRole('button',{name:'儲存',exact:true}).click();
      await page.getByRole('button',{name:/^待關心 /}).click();
      await row.waitFor();
      await row.getByRole('button',{name:'代禱',exact:true}).click();
      await row.getByRole('button',{name:'代禱 1',exact:true}).waitFor();
      if(await row.locator('button[aria-expanded]').getAttribute('aria-expanded')==='false') await row.locator('button[aria-expanded]').click();
      await row.getByRole('button',{name:'封存'+name,exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:'確認封存'}).click();
      await row.waitFor({state:'hidden'});
      await page.getByRole('button',{name:/^已封存 /}).click();
      await row.locator('button[aria-expanded]').click();
      await row.getByText('PRIVATE_HISTORY_'+width,{exact:true}).waitFor();
      await row.getByRole('button',{name:'恢復關懷'}).click();
      await row.waitFor({state:'hidden'});
      await page.getByRole('button',{name:/^待關心 /}).click();
      if(width===390) { await page.setViewportSize({width:320,height:844}); await screenshot('320-list'); await page.setViewportSize({width,height:844}); }
      await screenshot(width+'-list');
      await row.locator('button[aria-expanded]').click();
      await row.getByRole('button',{name:'請牧者協助探訪'}).click();
      const form=page.getByRole('region',{name:'請牧者協助探訪',exact:true});
      if(await form.getByLabel('希望牧者知道的狀況').inputValue()!=='') throw Error('Private notes copied into request');
      await form.getByLabel('希望牧者知道的狀況').fill('可分享的探訪需求 '+width);
      await form.getByLabel('聯絡方式與方便探訪的時間').fill('驗收用聯絡方式，請先與提出者聯絡');
      await form.getByRole('radio',{name:'請盡快聯絡'}).check();
      await form.getByRole('checkbox').check();
      await screenshot(width+'-visit-preview');
      await form.getByRole('button',{name:'確認送給牧者'}).click();
      await form.waitFor({state:'hidden'});
      const own=await (await page.context().request.get(origin+'/api/care-visits')).json();
      const visit=own.requests.find(r=>r.name===name); if(!visit) throw Error('Visit not saved');
      await login(2);
      if((await page.context().request.get(origin+'/api/care-visits/'+visit.id)).status()!==404) throw Error('Unrelated member read visit');
      if((await page.context().request.get(origin+'/api/care/contacts/'+contact.id+'/actions')).status()!==404) throw Error('Private timeline leaked');
      await login(1,'/');
      await page.getByRole('link',{name:/牧者探訪/}).waitFor();
      await page.getByRole('link',{name:/牧者探訪/}).click();
      const requestRow=page.locator('li').filter({has:page.getByRole('heading',{name,exact:true})});
      await requestRow.getByRole('button',{name:'查看與安排'}).click();
      const detail=page.getByRole('region',{name:'探訪安排與紀錄'});
      await detail.getByLabel('探訪狀態').selectOption('assigned');
      await detail.getByLabel('負責探訪的同工').selectOption(people[1].id);
      await detail.getByLabel('預定探訪日期').fill('2099-01-02');
      await detail.getByLabel('安排或探訪回報（提出者也看得到）').fill('已電話聯絡，安排探訪');
      const inbox=await (await page.context().request.get(origin+'/api/care-visits?mode=inbox')).json();
      if(JSON.stringify(inbox).includes('PRIVATE_')) throw Error('Private care fields leaked to pastors');
      await screenshot(width+'-pastor-arrange');
      await detail.getByRole('button',{name:'儲存探訪安排'}).click();
      await detail.waitFor({state:'hidden'});
      await login(0,'/care?view=visits');
      await requestRow.getByText(/已安排/).first().waitFor();
      await requestRow.getByRole('button',{name:'查看進度'}).click();
      await detail.getByRole('heading',{name:'處理紀錄'}).waitFor();
      await screenshot(width+'-visit-progress');
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','dark'));
      await page.goto(origin+'/care'); await row.waitFor(); await screenshot(width+'-dark');
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','light'));
      checks.push({width,inline:true,history:true,recurringDue:true,archiveRestore:true,prayer:true,explicitVisitConsent:true,privateFieldsExcluded:true,memberDenied:true,pastorReminder:true,assignment:true,senderProgress:true,dark:true});
    }
    return {checks,fixtureSession:true,physicalPhoneTested:false,externalNotificationTested:false};
  }`;
  let raw;
  try { raw = execFileSync(cli, ['-s=care-b', 'run-code', script], { cwd: root, encoding: 'utf8', timeout: 360000, maxBuffer: 4 * 1024 * 1024 }); }
  catch (error) {
    const diagnostic = String(error.stdout || '').split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1200);
    if (diagnostic && ![app.SESSION_SECRET, app.STAGING_ACCESS_CODE, ...people.map(p => p.cookie)].some(value => diagnostic.includes(value))) console.error(diagnostic);
    throw new Error('Care browser failed; credential-bearing output withheld');
  }
  const result = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!result) {
    const diagnostic = raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1200);
    if (diagnostic && ![app.SESSION_SECRET, app.STAGING_ACCESS_CODE, ...people.map(p => p.cookie)].some(value => diagnostic.includes(value))) console.error(diagnostic);
    throw new Error('Care browser did not return evidence; raw output withheld');
  }
  evidence = JSON.parse(result);
} finally {
  try { execFileSync(cli, ['-s=care-b', 'close'], { cwd: root, stdio: 'pipe', timeout: 30000 }); } catch { /* Remove this run's fixtures even on browser failure. */ }
  stagingSql(`BEGIN;
    DELETE FROM auth_sessions WHERE sid IN (${people.map(p => sql(p.sid)).join(',')});
    DELETE FROM care_visit_events WHERE request_id IN (SELECT id FROM care_visit_requests WHERE sender_id IN (${ids}));
    DELETE FROM care_visit_requests WHERE sender_id IN (${ids});
    DELETE FROM care_actions WHERE user_id IN (${ids});
    DELETE FROM care_contacts WHERE user_id IN (${ids});
    DELETE FROM user_roles WHERE user_id IN (${ids});
    DELETE FROM users WHERE id IN (${ids});
    DELETE FROM auth_users WHERE id IN (${people.map(p => sql(p.authId)).join(',')});
    COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN (${ids})`), '0');
}
assert.equal(inspectStaging().productionDeployment, productionDeployment, 'A deployment changed');
evidence = { ...evidence, fixtureRemoved: true, productionUnchanged: true, at: new Date().toISOString() };
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
