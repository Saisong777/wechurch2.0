import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const state = inspectStaging(), run = randomUUID();
const output = path.join(root, 'output/playwright/family-directory', run);
fs.mkdirSync(output, {recursive:true,mode:0o700});
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const expires = new Date(Date.now()+3600000);
const actors = ['leader','member','outsider'].map(role => {
  const id=randomUUID(),authId=randomUUID(),sid=`family-ui-${randomUUID()}`,email=`family-ui-${id}@example.test`;
  const session={cookie:{originalMaxAge:3600000,expires:expires.toISOString(),secure:true,httpOnly:true,path:'/',sameSite:'lax'},passport:{user:{claims:{sub:authId,email},sessionUserId:id,sessionVersion:0,expires_at:Math.floor(expires.getTime()/1000)}}};
  const cookie=encodeURIComponent(`s:${sid}.${createHmac('sha256',state.app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/,'')}`);
  return {id,authId,sid,email,session,cookie,role};
});
const redact = value => {
  let text=String(value);
  for(const secret of [state.app.STAGING_ACCESS_CODE,state.app.SESSION_SECRET,...actors.map(a=>a.cookie)]) if(secret) text=text.replaceAll(secret,'[redacted]');
  return text;
};
const cli=(...args)=>{
  try{return execFileSync(path.join(process.env.HOME,'.codex/skills/playwright/scripts/playwright_cli.sh'),['-s=family-directory',...args],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:8*1024*1024});}
  catch(error){ console.error(redact(String(error.stdout||error.stderr||'').split('### Error\n').at(-1).split('### Ran')[0]).slice(0,1200));throw Error('Family browser operation failed; command withheld');}
};
async function journey(page, {origin,code,actors,output,run}) {
  const contexts=[],checks=[],errors=[];
  const expect=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const api=async(ctx,route,method='GET',data)=>{
    const response=await ctx.request.fetch(origin+'/api/life-groups'+route,{method,headers:{Origin:origin},...(data===undefined?{}:{data})});
    return {status:response.status(),data:await response.json()};
  };
  for(const actor of actors){
    const context=await page.context().browser().newContext({viewport:{width:390,height:844}});contexts.push(context);
    const gate=await context.request.post(origin+'/__staging/access',{headers:{Origin:origin},data:{code},maxRedirects:0});
    expect(gate.status()===303,'gate-'+actor.role);
    await context.addCookies([{name:'connect.sid',value:actor.cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
    const me=await context.request.get(origin+'/api/auth/user');
    expect(me.status()===200&&(await me.json()).legacyUserId===actor.id,'identity-'+actor.role);
  }
  const [leader,member,outsider]=contexts;
  const name='同行驗收-'+run.slice(0,6);
  const created=await api(leader,'/management','POST',{name,church:'IM 行動教會',audience:'couples',description:'一起生活，一起成長',meeting:'週五晚上'});
  expect(created.status===201,'authorized-create'); const id=created.data.id;
  const hidden=await api(leader,'/management','POST',{name:'不公開驗收-'+run.slice(0,6),church:'IM 行動教會',listed:false,audience:'women'});
  expect(hidden.status===201,'explicit-private-create');
  expect((await api(member,'/management','POST',{name:'不應建立',church:'IM 行動教會'})).status===403,'member-create-denied');
  const directory=await api(member,'/directory');
  expect(directory.data.groups.some(g=>g.id===id&&g.audience==='couples'),'new-family-visible-to-member');
  expect(!directory.data.groups.some(g=>g.id===hidden.data.id),'private-family-hidden');
  expect(!directory.data.groups.some(g=>'announcement' in g||'leaderId' in g||'requests' in g),'directory-private-fields-absent');
  for(const label of ['123','ABC']) expect(directory.data.groups.some(g=>g.name===label),'existing-family-visible-'+label);
  const memberPage=await member.newPage(),leaderPage=await leader.newPage();
  for(const p of [memberPage,leaderPage]) p.on('pageerror',e=>errors.push(e.message));
  // Keep screenshots scoped to synthetic groups without altering API verification above.
  for(const p of [memberPage,leaderPage]){
    await p.route(url=>url.pathname==='/api/life-groups/directory',async route=>{const response=await route.fetch(),body=await response.json();body.groups=body.groups.filter(g=>g.id===id);await route.fulfill({response,json:body});});
    await p.route(url=>url.pathname==='/api/life-groups/management',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch(),body=await response.json();body.groups=body.groups.filter(g=>g.id===id||g.id===hidden.data.id);body.requests=[];await route.fulfill({response,json:body});});
  }
  const go=async(p,url)=>{await p.goto(origin+url);await p.locator('main').waitFor();};
  const layout=async(p,label)=>{
    const bad=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,error:!!document.querySelector('[data-testid="text-error-title"]'),cardOverflow:[...document.querySelectorAll('main a[href^="/groups/"]')].some(a=>{const r=a.getBoundingClientRect();return [...a.children].some(c=>{const b=c.getBoundingClientRect();return b.left<r.left||b.right>r.right;});})}));
    expect(!bad.overflow&&!bad.error&&!bad.cardOverflow,label);await p.screenshot({path:output+'/'+label+'.png',fullPage:true});
  };
  await go(memberPage,'/groups');
  await memberPage.getByRole('heading',{name,exact:true}).waitFor();
  await memberPage.getByRole('combobox',{name:'小家類型'}).selectOption('women');
  expect(await memberPage.getByRole('heading',{name,exact:true}).count()===0,'category-filter');
  await memberPage.getByRole('combobox',{name:'小家類型'}).selectOption('couples');
  await memberPage.getByRole('button',{name:'申請加入',exact:true}).click();
  await memberPage.getByRole('textbox',{name:'想對小家長說的話（選填）'}).fill('希望先了解聚會方式。');
  await layout(memberPage,'mobile-application');
  await memberPage.getByRole('button',{name:'送出加入申請',exact:true}).click();
  await memberPage.getByText('等待小家長審核',{exact:true}).waitFor();
  expect((await api(member,'/'+id)).status===404,'pending-cannot-read-private-content');
  expect((await api(outsider,'/management/'+id)).status===403,'other-church-cannot-review');
  expect((await api(member,`/management/${id}/requests/${actors[1].id}`,'POST',{approve:true})).status===403,'self-approval-denied');
  await go(leaderPage,'/groups');
  await leaderPage.getByRole('link',{name:name+' · 1 位等待審核'}).click();
  await leaderPage.getByText('希望先了解聚會方式。',{exact:true}).waitFor();
  await layout(leaderPage,'mobile-review');
  await leaderPage.getByRole('button',{name:'婉拒',exact:true}).click();
  await leaderPage.getByText('希望先了解聚會方式。',{exact:true}).waitFor({state:'hidden'});
  expect((await api(member,'/'+id)).status===404,'declined-cannot-read-private-content');
  await memberPage.reload();await memberPage.getByRole('button',{name:'重新申請',exact:true}).click();
  await memberPage.getByRole('button',{name:'送出加入申請',exact:true}).click();
  await memberPage.getByText('等待小家長審核',{exact:true}).waitFor();
  memberPage.once('dialog',dialog=>dialog.accept());await memberPage.getByRole('button',{name:'撤回申請',exact:true}).click();
  await memberPage.getByRole('button',{name:'申請加入',exact:true}).waitFor();
  expect((await api(leader,'/management/'+id)).data.requests.length===0,'withdraw-clears-pending');
  await memberPage.getByRole('button',{name:'申請加入',exact:true}).click();
  await memberPage.getByRole('button',{name:'送出加入申請',exact:true}).click();
  await memberPage.getByText('等待小家長審核',{exact:true}).waitFor();
  await leaderPage.reload();await leaderPage.getByRole('button',{name:'同意加入',exact:true}).click();
  await leaderPage.getByRole('button',{name:'同意加入',exact:true}).waitFor({state:'hidden'});
  expect((await api(member,'/'+id)).status===200,'approval-enables-membership');
  await memberPage.reload();await memberPage.getByRole('link',{name:'進入我的小家',exact:true}).click();
  await memberPage.getByRole('tab',{name:'小家動態'}).waitFor();
  expect((await api(member,'/'+id)).data.requests.length===0,'member-cannot-see-others-requests');
  for(const width of [320,390,1440])for(const size of ['standard','maximum']){
    for(const [p,role,route] of [[memberPage,'directory','/groups'],[leaderPage,'management','/groups?manage=1&family='+id]]){
      await p.setViewportSize({width,height:900});
      await p.evaluate(size=>{localStorage.setItem('wechurch-reading-preferences',JSON.stringify({size,font:'sans'}));localStorage.setItem('wechurch-theme',size==='maximum'?'dark':'light');},size);
      await go(p,route);await p.getByRole('heading',{name,exact:true}).first().waitFor();
      if(role==='directory')await p.locator('article').getByRole('heading',{name,exact:true}).waitFor();
      else await p.getByRole('listitem').filter({hasText:'測試申請人'}).first().waitFor();
      await layout(p,`${role}-${width}-${size}`);
    }
  }
  for(const ctx of contexts)await ctx.close();
  return {checks,errors,physicalPhoneTested:false};
}
let result;
try{
  stagingSql('BEGIN;'+actors.map(a=>`INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(a.id)},${sql(a.email)},'!disabled-fixture',${sql(a.role==='leader'?'測試小家長':'測試申請人')},${sql(a.role==='outsider'?'火樂':'IM 行動教會')}); INSERT INTO auth_users(id,email) VALUES(${sql(a.authId)},${sql(a.email)}); INSERT INTO user_roles(user_id,role) VALUES(${sql(a.id)},${sql(a.role==='member'?'member':'senior_pastor')}); INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(a.sid)},${sql(JSON.stringify(a.session))},${sql(expires.toISOString())});`).join('')+'COMMIT;');
  cli('open','about:blank');cli('snapshot');
  const raw=cli('run-code',`async page => (${journey.toString()})(page,${JSON.stringify({origin:target.origin,code:state.app.STAGING_ACCESS_CODE,actors:actors.map(({id,cookie,role})=>({id,cookie,role})),output,run})})`);
  const body=raw.split('### Result\n')[1]?.split('\n###')[0];
  if(!body){console.error(redact(raw.split('### Error\n')[1]?.split('\n###')[0]||'Missing browser result').slice(0,1600));throw Error('Family acceptance failed');}
  result=JSON.parse(body);
}finally{
  try{cli('close');}catch{/* Remove fixtures even after browser failure. */}
  const ids=actors.map(a=>sql(a.id)).join(','),groups=`SELECT id FROM small_groups WHERE leader_user_id=${sql(actors[0].id)}`;
  stagingSql(`BEGIN; DELETE FROM life_group_requests WHERE group_id IN (${groups}); DELETE FROM family_membership_events WHERE group_id IN (${groups}); DELETE FROM small_group_members WHERE group_id IN (${groups}); DELETE FROM small_groups WHERE leader_user_id=${sql(actors[0].id)}; DELETE FROM auth_sessions WHERE sid IN (${actors.map(a=>sql(a.sid)).join(',')}); DELETE FROM user_roles WHERE user_id IN (${ids}); DELETE FROM users WHERE id IN (${ids}); DELETE FROM auth_users WHERE id IN (${actors.map(a=>sql(a.authId)).join(',')}); COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN (${ids})`),'0');
}
assert.equal(inspectStaging().productionDeployment,state.productionDeployment);
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...result,fixturesRemoved:true,productionUnchanged:true},null,2));
console.log(JSON.stringify({output,...result,fixturesRemoved:true,productionUnchanged:true}));
assert.equal(result.errors.length,0);
