import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const origin = 'https://wechurch-staging-staging.up.railway.app';
const invitation = JSON.parse(fs.readFileSync('artifacts/railway-staging/coworker-invitation.json', 'utf8'));
const account = JSON.parse(fs.readFileSync('artifacts/railway-staging/invitation-test-account.json', 'utf8'));
const cli = `${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`;
fs.mkdirSync('output/playwright/testing-onboarding', { recursive: true });
const script = `async page => {
  await page.context().clearCookies();
  await page.setViewportSize({width:390,height:844});
  await page.goto(${JSON.stringify(origin + invitation.url)});
  const accept=page.getByRole('button',{name:'接受邀請，開始測試'});
  await accept.waitFor();
  await page.waitForFunction(()=>!document.querySelector('button').disabled);
  if(await page.evaluate(()=>location.hash))throw new Error('Invitation fragment not removed');
  await page.screenshot({path:'output/playwright/testing-onboarding/invitation-390.png'});
  await accept.click();
  await page.getByRole('link',{name:'登入或建立帳號'}).click();
  await page.getByText('建立新帳戶',{exact:true}).waitFor();
  if(await page.getByTestId('input-password').getAttribute('minlength')!=='8')throw new Error('Password rule mismatch');
  const viewports=[];
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw new Error('Horizontal overflow');
    await page.screenshot({path:'output/playwright/testing-onboarding/signup-'+width+'.png'});
    viewports.push({width,overflow});
  }
  await page.getByRole('button',{name:'已有帳號',exact:true}).click();
  await page.getByTestId('input-email').fill(${JSON.stringify(account.email)});
  await page.getByTestId('input-password').fill(${JSON.stringify(account.password)});
  await page.getByTestId('button-submit').click();
  await page.getByRole('button',{name:'送出加入申請'}).waitFor();
  const join=page.getByRole('button',{name:'送出加入申請'});
  if(!await join.isEnabled())throw new Error('Invitation lost through login');
  if(await page.getByRole('textbox',{name:'小組邀請碼'}).inputValue()!==${JSON.stringify(invitation.token)})throw new Error('Wrong group invitation');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/testing-onboarding/group-390.png'});
  return {invitationAccepted:true,signupVisible:true,loginRestoresGroupInvitation:true,viewports,noGroupJoinSubmitted:true};
}`;
try {
  const output = execFileSync(cli, ['-s=invitation-review', 'run-code', script], { encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
  const result = output.split('### Result\n')[1]?.split('\n###')[0];
  if (!result) throw new Error('Missing result');
  fs.writeFileSync('output/playwright/testing-onboarding/result.json', result);
  console.log(result);
} catch { throw new Error('Onboarding browser check failed; credential-bearing tool output omitted.'); }
