import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function audit(page) {
  const origin='https://wechurch-staging-staging.up.railway.app';
  const results=[],errors=[],serverErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=500)serverErrors.push({url:new URL(r.url()).pathname,status:r.status()});});
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:844});
    for(const route of ['/support','/work','/work/settings','/admin/crm','/','/learn/church-reading','/prayer-wall','/groups','/care','/me/activity','/me/sharing']) {
      await page.goto(origin+route);await page.waitForLoadState('networkidle');
      await page.locator('main').first().waitFor({state:'visible'});
      const state=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        bottomNav:!!document.querySelector('[data-testid=nav-bottom]'),
        mobileHeaders:[...document.querySelectorAll('[data-testid=mobile-navigation]')].filter(e=>e.getClientRects().length).length,
        mainText:document.querySelector('main')?.textContent?.trim().length||0,
        errorBoundary:document.body.textContent.includes('這個頁面暫時無法載入'),
      }));
      if(state.overflow||state.bottomNav||state.mobileHeaders>1||state.mainText<10||state.errorBoundary)throw new Error(JSON.stringify({width,route,...state}));
      if(['/support','/work','/admin/crm','/me/activity','/me/sharing'].includes(route))await page.screenshot({path:`output/playwright/integrated-${route.replaceAll('/','-')}-${width}.png`});
      results.push({width,route,...state});
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/support');await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'尋求陪伴',exact:true}).click();
  await page.getByLabel('事項',{exact:true}).fill('僅畫面測試，不送出');
  await page.getByLabel('希望得到的陪伴',{exact:true}).fill('這段內容不會寫入資料庫。');
  if(await page.getByRole('button',{name:'送出',exact:true}).isEnabled())throw new Error('Consent required before sending');
  await page.screenshot({path:'output/playwright/integrated-composer-390.png'});
  if(errors.length||serverErrors.length)throw new Error(JSON.stringify({errors,serverErrors}));
  return {at:new Date().toISOString(),results,composerConsent:true,errors,serverErrors,syntheticAccount:true,persistedWrites:false};
}

fs.mkdirSync('output/playwright',{recursive:true});
const cli=`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`;
const output=execFileSync(cli,[`-s=${process.env.PLAYWRIGHT_SESSION||'church-review'}`,'run-code',`async page => (${audit.toString()})(page)`],{encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024});
const result=output.split('### Result\n')[1]?.split('\n###')[0];
if(!result){fs.writeFileSync('output/playwright/integrated-run.log',output);throw new Error(output.slice(-2500));}
const session=`-s=${process.env.PLAYWRIGHT_SESSION||'church-review'}`;
const cancel=execFileSync(cli,[session,'run-code',"async page => { await page.getByRole('button',{name:'取消',exact:true}).click(); }"],{encoding:'utf8'});
if(!cancel.includes('放棄尚未送出的內容'))throw new Error('Unsaved confirmation did not appear');
execFileSync(cli,[session,'dialog-accept'],{stdio:'pipe'});
const follow=execFileSync(cli,[session,'run-code',`async page => {
  await page.getByRole('heading',{name:'我的求助與陪伴'}).waitFor();
  await page.getByRole('link',{name:'交給我的事項'}).click();await page.waitForURL('**/work');
  await page.getByLabel('篩選事項').selectOption('waiting');await page.waitForLoadState('networkidle');
  if(!page.url().includes('supportFilter=waiting'))throw new Error('Filter not retained');
  return {unsavedCancel:true,workFilter:true};
}`],{encoding:'utf8',timeout:60000});
const followResult=follow.split('### Result\n')[1]?.split('\n###')[0];
if(!followResult)throw new Error('Flow verification failed');
const evidence={...JSON.parse(result),...JSON.parse(followResult)};
fs.writeFileSync('output/playwright/integrated-results.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence));
