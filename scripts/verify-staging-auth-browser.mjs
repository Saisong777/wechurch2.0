import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const origin = 'https://wechurch-staging-staging.up.railway.app';
const account = JSON.parse(fs.readFileSync('artifacts/railway-staging/test-account.json', 'utf8'));
const code = fs.readFileSync('artifacts/railway-staging/access.txt', 'utf8').match(/測試邀請碼：([^\n]+)/)[1];
const cli = `${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`;
const script = `async page => {
  const origin=${JSON.stringify(origin)};
  const gate=await page.request.post(origin+'/__staging/access',{headers:{Origin:origin},form:{code:${JSON.stringify(code)}},maxRedirects:0});
  if(gate.status()!==303) throw new Error('Staging gate failed: '+gate.status());
  const login=await page.request.post(origin+'/api/auth/email-login',{data:${JSON.stringify(account)}});
  if(login.status()!==200) throw new Error('Test login failed: '+login.status());
  await page.goto(origin);await page.waitForLoadState('networkidle');
  return {gate:gate.status(),login:login.status(),url:page.url()};
}`;
try {
  const output = execFileSync(cli, [`-s=${process.env.PLAYWRIGHT_SESSION || 'site-nav'}`, 'run-code', script], { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
  const result = output.split('### Result\n')[1]?.split('\n###')[0];
  if (!result) throw new Error('Browser authentication did not return verification');
  console.log(result);
} catch { throw new Error('Browser authentication verification failed; credentials omitted'); }
