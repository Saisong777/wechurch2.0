import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const preview=JSON.parse(fs.readFileSync('artifacts/mentoring-preview/access.json','utf8'));
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(preview.origin))throw new Error('Local preview only');
const account=preview.accounts.find(a=>a.kind===(process.argv[2]||'learner'));
if(!account)throw new Error('Unknown synthetic account');
const route=account.kind==='learner'?`/me/mentoring?journey=${preview.journeyId}`:'/work/mentoring';
const script=`async page=>{
  await page.context().clearCookies();
  const response=await page.request.post(${JSON.stringify(preview.origin+'/api/auth/email-login')},{data:${JSON.stringify({email:account.email,password:account.password})}});
  if(response.status()!==200)throw new Error('Login failed');
  await page.goto(${JSON.stringify(preview.origin+route)});await page.waitForLoadState('networkidle');
  return {syntheticLogin:true,kind:${JSON.stringify(account.kind)},url:page.url()};
}`;
try{
  const output=execFileSync(`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`,[`-s=${process.env.PLAYWRIGHT_SESSION||'mentoring-review'}`,'run-code',script],{encoding:'utf8',timeout:60000});
  const result=output.split('### Result\n')[1]?.split('\n###')[0];if(!result)throw new Error();console.log(result);
}catch{throw new Error('Preview login verification failed; credentials omitted');}
