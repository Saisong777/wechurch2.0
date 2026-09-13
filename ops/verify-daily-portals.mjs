import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function audit(page) {
  const origin = 'https://wechurch-staging-staging.up.railway.app';
  const checks = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/learn', '/share', '/walls', '/prayer-wall']) {
      await page.goto(origin + route);
      await page.waitForLoadState('networkidle');
      await page.locator('main').first().waitFor({ state: 'visible' });
      if (route === '/learn') {
        const links = await page.locator('main a').evaluateAll(items => items.map(a => a.getAttribute('href')));
        if (JSON.stringify(links) !== JSON.stringify(['/learn/bible', '/learn/church-reading', '/learn/my-notes'])) throw Error('Unexpected learning entries');
      }
      if (route === '/share') {
        const links = await page.locator('main a').evaluateAll(items => items.map(a => a.getAttribute('href')));
        if (JSON.stringify(links) !== JSON.stringify(['/grace-record', '/walls'])) throw Error('Unexpected prayer entries');
      }
      if (route === '/walls') {
        await page.waitForURL('**/devotion-wall');
        await page.getByRole('navigation', { name: '分享牆', exact: true }).getByRole('link', { name: '代禱', exact: true }).click();
        await page.waitForURL('**/prayer-wall');
        await page.getByRole('navigation', { name: '分享牆', exact: true }).getByRole('link', { name: '今日靈修', exact: true }).click();
        await page.waitForURL('**/devotion-wall');
      }
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        bottomNav: !!document.querySelector('[data-testid=nav-bottom]'),
        mobileHeaders: [...document.querySelectorAll('[data-testid=mobile-navigation]')].filter(e => e.getClientRects().length).length,
      }));
      if (layout.overflow || layout.bottomNav || layout.mobileHeaders > 1) throw Error(JSON.stringify({ route, width, ...layout }));
      await page.screenshot({ path: `output/playwright/portals-${route.slice(1)}-${width}.png` });
      checks.push({ route, width, ...layout });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/share');
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: '分享牆', exact: true }).click();
  await page.waitForURL('**/devotion-wall');
  await page.getByRole('button', { name: '返回上一頁', exact: true }).click();
  await page.waitForURL('**/share');
  await page.getByRole('button', { name: '開啟導覽選單' }).click();
  await page.getByTestId('mobile-menu-home').click();
  await page.waitForURL(origin + '/');
  await page.waitForLoadState('networkidle');
  if (await page.locator('a[href="/prayer-meeting"]').count()) throw Error('Retired prayer meeting remains on home');
  if (errors.length) throw Error(JSON.stringify(errors));
  return { checks, wallSwitching: true, mobileBack: true, mobileHome: true, errors, persistedWrites: false };
}

fs.mkdirSync('output/playwright', { recursive: true });
const output = execFileSync(`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`, [
  '-s=church-review', 'run-code', `async page => (${audit.toString()})(page)`,
], { encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
const result = output.split('### Result\n')[1]?.split('\n###')[0];
if (!result) throw Error(output.slice(-2000));
const evidence = JSON.parse(result);
fs.writeFileSync('output/playwright/daily-portals-results.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
