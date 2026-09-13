import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function verify(page) {
  const origin = 'https://wechurch-staging-staging.up.railway.app';
  const checks = [];
  const ensure = (condition, label) => { if (!condition) throw Error(label); };
  const go = async route => {
    await page.goto(origin + route);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.locator('main').first().waitFor();
  };
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/learn', '/grace-record', '/devotion-wall', '/prayer-wall', '/groups', '/me', '/admin', '/admin/crm', '/admin/church-devotions']) {
      await go(route);
      if (width < 768 && await page.getByTestId('mobile-navigation').count()) {
        await page.getByRole('button', { name: '開啟導覽選單' }).click();
        const menu = page.getByRole('navigation', { name: '行動導覽選單' });
        for (const name of ['今日', '聖經', '禱告', '分享牆', '小組'])
          ensure(await menu.getByRole('link', { name, exact: true }).count() === 1, 'Missing or duplicated ' + name);
        await page.getByRole('button', { name: '關閉導覽選單' }).click();
      }
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        bottomNav: !!document.querySelector('[data-testid=nav-bottom]'),
        headerCount: [...document.querySelectorAll('[data-testid=mobile-navigation]')].filter(e => e.getClientRects().length).length,
        logoLoaded: [...document.images].filter(e => e.src.endsWith('/wechurch-together.png') && e.getClientRects().length).every(e => e.complete && e.naturalWidth > 0),
      }));
      ensure(!layout.overflow && !layout.bottomNav && layout.headerCount <= 1 && layout.logoLoaded, JSON.stringify({ route, width, ...layout }));
      checks.push({ route, width, ...layout });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/');
  const preview = page.getByTestId('daily-scripture-preview');
  if (await preview.count()) ensure(!/[\u4e00-\u9fff] [\u4e00-\u9fff]/.test(await preview.innerText()), 'Spaced Chinese still in home Scripture');
  await page.getByRole('link', { name: '新增禱告', exact: true }).click();
  await page.getByRole('textbox', { name: '標題', exact: true }).fill('UI 驗收未儲存草稿');
  await page.getByRole('button', { name: '收起新增', exact: true }).click();
  await page.getByRole('button', { name: '新增禱告', exact: true }).click();
  ensure(await page.getByRole('textbox', { name: '標題', exact: true }).inputValue() === 'UI 驗收未儲存草稿', 'Collapsed prayer draft lost');
  await page.getByRole('textbox', { name: '標題', exact: true }).fill('');
  await page.getByRole('button', { name: '收起新增', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/ux-together-after/prayer-list-390.png' });
  await go('/learn/my-notes');
  ensure(await page.getByTestId('tab-devotional').getAttribute('data-state') === 'active', 'Wrong default note tab');
  await page.getByRole('searchbox', { name: '搜尋筆記' }).fill('UI-NO-MATCH-64839');
  ensure((await page.getByRole('status').innerText()).includes('找到 0 則'), 'Search empty state missing');
  await page.getByRole('searchbox', { name: '搜尋筆記' }).fill('');
  await go('/learn/church-reading');
  const expand = page.getByRole('button', { name: '展開經文', exact: true });
  let scriptureExpanded = false;
  if (await expand.count()) {
    await expand.click();
    ensure(await page.getByRole('button', { name: '收起經文', exact: true }).count() === 2, 'Missing top/end collapse controls');
    await page.getByRole('button', { name: '收起經文', exact: true }).last().click();
    ensure(await expand.getAttribute('aria-expanded') === 'false', 'Scripture did not collapse');
    scriptureExpanded = true;
  }
  await page.getByRole('button', { name: '開啟導覽選單' }).click();
  await page.getByTestId('mobile-menu-walls').click();
  await page.waitForURL('**/devotion-wall');
  await page.getByRole('navigation', { name: '分享牆', exact: true }).getByRole('link', { name: '代禱', exact: true }).click();
  await page.waitForURL('**/prayer-wall');
  await page.getByRole('button', { name: '返回上一頁', exact: true }).click();
  await page.waitForURL('**/devotion-wall');
  await go('/');
  return { checks, directPrayerComposer: true, draftSurvivesCollapse: true, noteSearch: true, scriptureExpanded, wallSwitching: true, backNavigation: true, submittedForms: false, networkWriteMonitoring: false };
}

fs.mkdirSync('output/playwright/ux-together-after', { recursive: true });
const output = execFileSync(`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`, ['-s=church-review', 'run-code', `async page => (${verify.toString()})(page)`], { encoding: 'utf8', timeout: 600000, maxBuffer: 4 * 1024 * 1024 });
const result = output.split('### Result\n')[1]?.split('\n###')[0];
if (!result) throw Error(output.slice(-2500));
const evidence = JSON.parse(result);
fs.writeFileSync('output/playwright/ux-together-after/flows.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
