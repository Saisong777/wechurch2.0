import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const state = inspectStaging(), run = randomUUID();
const output = path.join(root, 'output/playwright/family-comments', run);
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
  try{return execFileSync(path.join(process.env.HOME,'.codex/skills/playwright/scripts/playwright_cli.sh'),['-s=family-comments',...args],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:8*1024*1024});}
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
  const created=await api(leader,'/management','POST',{name:'留言驗收-'+run.slice(0,6),church:'IM 行動教會',listed:true});
  expect(created.status===201,'create-fixture'); const id=created.data.id;
  await api(member,'/directory/'+id+'/join','POST',{});
  expect((await api(leader,'/management/'+id+'/requests/'+actors[1].id,'POST',{approve:true})).status===200,'join-approved');
  const postIds=actors.map(a=>a.id);
  for(const [i,kind] of ['note','prayer','message'].entries()){
    expect((await api(leader,'/'+id+'/shares/'+postIds[i],'PUT',{kind,title:['一起讀經的亮光','本週彼此代禱','週末聚會分享'][i],body:'這是自動驗收的測試內容，不含真實會員資料。',consent:true})).status===200,'create-'+kind);
  }
  const commentPath='/'+id+'/shares/'+postIds[0]+'/comments';
  expect((await api(outsider,commentPath)).status===404,'outsider-cannot-read-comments');
  for(let i=1;i<=32;i++){
    const cid=await page.evaluate(()=>crypto.randomUUID());
    expect((await api(leader,commentPath+'/'+cid,'PUT',{body:'家人的留言 '+i})).status===200,'seed-comment-'+i);
  }
  const m=await member.newPage(),l=await leader.newPage();
  for(const p of [m,l])p.on('pageerror',e=>errors.push(e.message));
  await m.goto(origin+'/groups/'+id);await m.getByText('家人的留言 32',{exact:true}).waitFor();
  expect(await m.getByRole('dialog').count()===0,'comments-visible-without-dialog');
  expect(await m.locator('textarea:focus').count()===0,'no-auto-keyboard');
  const note=m.locator('article').filter({has:m.getByRole('heading',{name:'一起讀經的亮光',exact:true})});
  expect(await note.getByRole('listitem').count()===3,'latest-three-preview');
  await note.getByRole('button',{name:'查看較早留言'}).click();
  expect(await note.getByRole('listitem').count()===30,'expand-first-page');
  await note.getByRole('button',{name:'查看較早留言'}).click();
  await note.getByText('家人的留言 1',{exact:true}).waitFor();
  expect(await note.getByRole('listitem').count()===32,'older-page-appended-above');
  expect((await note.getByRole('listitem').first().innerText()).includes('家人的留言 1'),'oldest-first');
  await note.getByRole('button',{name:'寫下留言',exact:true}).click();
  expect(await m.locator('textarea:focus').count()===0,'opening-inline-composer-no-keyboard');
  await note.getByRole('textbox',{name:'寫下留言'}).fill('收到，謝謝家人的分享。');
  await note.getByRole('button',{name:'送出留言'}).click();
  await note.getByText('收到，謝謝家人的分享。',{exact:true}).waitFor();
  expect(await note.getByRole('listitem').count()===33,'new-comment-keeps-loaded-history');
  expect((await note.getByRole('listitem').last().innerText()).includes('收到，謝謝家人的分享。'),'new-comment-at-bottom');
  expect(await note.getByRole('textbox').inputValue()==='','successful-send-clears-draft');
  expect(await m.locator('textarea:focus').count()===0,'keyboard-released-after-send');
  const own=(await api(member,commentPath)).data.find(c=>c.authorId===actors[1].id);
  const other=(await api(member,commentPath)).data.find(c=>c.authorId===actors[0].id);
  expect((await api(member,commentPath+'/'+other.id,'DELETE')).status===404,'member-cannot-remove-others');
  expect((await api(outsider,commentPath+'/'+own.id,'PUT',{body:'denied'})).status===404,'outsider-cannot-comment');
  expect((await api(member,commentPath+'/'+own.id,'PUT',{body:'收到，謝謝家人的分享。'})).status===200,'retry-idempotent');
  expect((await api(member,commentPath)).data.filter(c=>c.id===own.id).length===1,'no-duplicate-on-retry');
  await l.goto(origin+'/groups/'+id);await l.getByText('收到，謝謝家人的分享。',{exact:true}).waitFor();
  expect(await l.getByRole('dialog').count()===0,'another-member-sees-reply-directly');
  const message=m.locator('article').filter({has:m.getByRole('heading',{name:'週末聚會分享',exact:true})});
  await message.getByRole('button',{name:'寫下留言',exact:true}).click();
  const input=message.getByRole('textbox',{name:'寫下留言'});
  await m.route('**/api/life-groups/*/shares/*/comments/*',async route=>{
    if(route.request().method()==='PUT')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'驗收模擬：暫時無法送出'})});
    return route.continue();
  });
  await input.fill('週末見，很期待一起讀經！'); await message.getByRole('button',{name:'送出留言'}).click();
  await message.getByText('驗收模擬：暫時無法送出',{exact:true}).waitFor();
  expect(await input.inputValue()==='週末見，很期待一起讀經！','failed-send-keeps-draft');
  await m.unroute('**/api/life-groups/*/shares/*/comments/*');
  await message.getByRole('button',{name:'送出留言'}).click();await message.getByText('週末見，很期待一起讀經！',{exact:true}).waitFor();
  await input.fill('我會準時到。'); await message.getByRole('button',{name:'送出留言'}).click();
  await message.getByText('我會準時到。',{exact:true}).waitFor();
  expect(await message.getByRole('listitem').count()===2,'second-comment-stacks-below-first');
  expect(await m.getByRole('dialog').count()===0,'no-dialog-throughout-conversation');
  const prayer=m.locator('article').filter({has:m.getByRole('heading',{name:'本週彼此代禱',exact:true})});
  await prayer.getByRole('button',{name:'寫下留言',exact:true}).click();
  await prayer.getByRole('textbox').fill('一起為你禱告。');
  await prayer.getByRole('button',{name:'送出留言'}).click();await prayer.getByText('一起為你禱告。',{exact:true}).waitFor();
  expect(await prayer.getByRole('listitem').count()===1,'prayer-replies-inline');
  m.once('dialog',dialog=>dialog.accept());await prayer.getByRole('button',{name:'撤回 測試申請人 的留言'}).click();
  await prayer.getByText('一起為你禱告。',{exact:true}).waitFor({state:'hidden'});
  expect((await api(member,'/'+id+'/shares/'+postIds[1]+'/comments')).data.length===0,'own-reply-withdrawn');
  for(const width of [320,390,1440])for(const size of ['standard','maximum']){
    await m.setViewportSize({width,height:900});
    await m.evaluate(size=>{localStorage.setItem('wechurch-reading-preferences',JSON.stringify({size,font:'sans'}));localStorage.setItem('wechurch-theme',size==='maximum'?'dark':'light');},size);
    await m.reload();await m.getByText('我會準時到。',{exact:true}).waitFor();
    const box=m.locator('article').filter({has:m.getByRole('heading',{name:'週末聚會分享',exact:true})});
    await box.getByRole('button',{name:'寫下留言',exact:true}).click();
    await box.scrollIntoViewIfNeeded();
    expect(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no-overflow-'+width+'-'+size);
    expect(await m.getByRole('dialog').count()===0,'inline-'+width+'-'+size);
    await m.screenshot({path:output+'/comments-'+width+'-'+size+'.png',fullPage:true});
    await box.screenshot({path:output+'/thread-'+width+'-'+size+'.png'});
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
  stagingSql(`BEGIN; DELETE FROM life_group_comments WHERE share_id IN (SELECT id FROM life_group_shares WHERE group_id IN (${groups})); DELETE FROM life_group_prayed WHERE share_id IN (SELECT id FROM life_group_shares WHERE group_id IN (${groups})); DELETE FROM life_group_shares WHERE group_id IN (${groups}); DELETE FROM life_group_requests WHERE group_id IN (${groups}); DELETE FROM family_membership_events WHERE group_id IN (${groups}); DELETE FROM small_group_members WHERE group_id IN (${groups}); DELETE FROM small_groups WHERE leader_user_id=${sql(actors[0].id)}; DELETE FROM auth_sessions WHERE sid IN (${actors.map(a=>sql(a.sid)).join(',')}); DELETE FROM user_roles WHERE user_id IN (${ids}); DELETE FROM users WHERE id IN (${ids}); DELETE FROM auth_users WHERE id IN (${actors.map(a=>sql(a.authId)).join(',')}); COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN (${ids})`),'0');
}
assert.equal(inspectStaging().productionDeployment,state.productionDeployment);
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...result,fixturesRemoved:true,productionUnchanged:true},null,2));
console.log(JSON.stringify({output,...result,fixturesRemoved:true,productionUnchanged:true}));
assert.equal(result.errors.length,0);
