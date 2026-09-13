import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function audit(page) {
  const origin = 'https://wechurch-staging-staging.up.railway.app';
  const checks = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(origin + '/') && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/learn', '/share', '/walls', '/prayer-wall', '/groups']) {
      await page.goto(origin + route);
      await page.waitForLoadState('networkidle');
      await page.locator('main').first().waitFor({ state: 'visible' });
      if (route === '/learn') {
        const links = await page.locator('main a').evaluateAll(items => items.map(a => a.getAttribute('href')));
        if (JSON.stringify(links) !== JSON.stringify(['/learn/bible', '/learn/church-reading', '/learn/my-notes'])) throw Error('Unexpected learning entries');
      }
      if (route === '/share') {
        await page.waitForURL('**/grace-record');
        await page.getByRole('heading', { name: '從禱告清單到恩典紀錄簿' }).waitFor();
        if (await page.locator('main a[href="/walls"]').count()) throw Error('Public walls still nested under prayer');
      }
      const activeId = route === '/' ? 'home' : route === '/learn' ? 'learn' : route === '/share' ? 'share' : route === '/groups' ? 'groups' : 'walls';
      if (width < 768) {
        await page.getByRole('button', { name: '開啟導覽選單' }).click();
        const menu = page.getByRole('navigation', { name: '行動導覽選單' });
        for (const label of ['今日', '聖經', '禱告', '分享牆', '小組']) {
          if (await menu.getByRole('link', { name: label, exact: true }).count() !== 1) throw Error(`Missing or duplicated navigation: ${label}`);
        }
        if (await page.getByTestId(`mobile-menu-${activeId}`).getAttribute('aria-current') !== 'page') throw Error('Wrong mobile active unit');
        await page.screenshot({ path: `output/playwright/independent-menu-${route.slice(1) || 'home'}-${width}.png` });
        await page.getByRole('button', { name: '關閉導覽選單' }).click();
      } else {
        const activeLink = page.getByTestId(`nav-top-link-${activeId}`);
        const current = await activeLink.getAttribute('aria-current');
        const homepageSelected = route === '/' && (await activeLink.getAttribute('class') || '').includes('bg-primary/10');
        if (current !== 'page' && !homepageSelected) throw Error(`Wrong desktop active unit: ${route}`);
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
      await page.screenshot({ path: `output/playwright/independent-${route.slice(1) || 'home'}-${width}.png` });
      checks.push({ route, width, ...layout });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/learn');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '開啟導覽選單' }).click();
  await page.getByTestId('mobile-menu-walls').click();
  await page.waitForURL('**/devotion-wall');
  await page.getByRole('button', { name: '返回上一頁', exact: true }).click();
  await page.waitForURL('**/learn');
  await page.getByRole('button', { name: '開啟導覽選單' }).click();
  await page.getByRole('navigation', { name: '行動導覽選單' }).getByRole('link', { name: '關懷', exact: true }).click();
  await page.waitForURL('**/care');
  await page.getByRole('button', { name: '開啟導覽選單' }).click();
  await page.getByTestId('mobile-menu-home').click();
  await page.waitForURL(origin + '/');
  await page.waitForLoadState('networkidle');
  if (await page.locator('a[href="/prayer-meeting"]').count()) throw Error('Retired prayer meeting remains on home');
  if (errors.length) throw Error(JSON.stringify(errors));
  return { checks, independentNavigation: true, directPersonalPrayer: true, wallSwitching: true, mobileCare: true, mobileBack: true, mobileHome: true, errors, persistedWrites: false };
}

fs.mkdirSync('output/playwright', { recursive: true });
const output = execFileSync(`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`, [
  '-s=church-review', 'run-code', `async page => (${audit.toString()})(page)`,
], { encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
const result = output.split('### Result\n')[1]?.split('\n###')[0];
if (!result) throw Error(output.slice(-2000));
const evidence = JSON.parse(result);
fs.writeFileSync('output/playwright/independent-walls-results.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
