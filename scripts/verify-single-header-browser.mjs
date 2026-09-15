import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

async function audit(page) {
  const origin = 'https://wechurch-staging-staging.up.railway.app';
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const clickWithoutScroll = async locator => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const box = await locator.boundingBox();
    if (!box) throw new Error('Expected a visible control');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  const menu = () => page.getByRole('button', { name: '開啟導覽選單', exact: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin);
    await page.waitForLoadState('networkidle');
    const state = await page.evaluate(() => {
      const visible = el => !!el?.getClientRects().length;
      const top = document.querySelector('[data-testid=mobile-navigation]');
      const header = document.querySelector('.dashboard-header');
      return { mobileHeader: visible(top), pageHeader: visible(header), footer: !!document.querySelector('[data-testid=nav-bottom]'), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (state.mobileHeader !== (width < 768) || state.pageHeader !== (width >= 768) || state.footer || state.overflow) throw new Error(`Header layout regression: ${JSON.stringify({ width, ...state })}`);
    await page.screenshot({ path: `output/playwright/single-header-home-${width}.png` });
    results.push({ viewport: width, ...state });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/learn/bible');
  await page.waitForLoadState('networkidle');
  await clickWithoutScroll(menu());
  const actions = page.getByTestId('mobile-page-actions');
  const before = await actions.innerText();
  const increase = actions.getByTestId('button-font-increase');
  const decrease = actions.getByTestId('button-font-decrease');
  const grow = await increase.isEnabled();
  await (grow ? increase : decrease).click();
  if (await actions.innerText() === before) throw new Error('Font control did not update');
  await (grow ? decrease : increase).click();
  await page.screenshot({ path: 'output/playwright/single-header-bible-menu.png' });
  await actions.getByTestId('button-expand-search').click();
  await page.getByTestId('input-bible-search').waitFor({ state: 'visible' });
  await page.getByTestId('button-close-search').click();
  results.push({ bibleActions: 'font size changes and restores; search opens and closes' });

  await page.setViewportSize({ width: 667, height: 375 });
  await page.evaluate(() => scrollTo(0, 0));
  if (await menu().isVisible()) await clickWithoutScroll(menu());
  const shortMenu = page.getByRole('navigation', { name: '行動導覽選單' });
  const geometry = await shortMenu.evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, viewport: innerHeight, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  if (geometry.bottom > geometry.viewport || geometry.scrollHeight <= geometry.clientHeight) throw new Error(`Short menu must fit and scroll: ${JSON.stringify(geometry)}`);
  await shortMenu.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const logout = await shortMenu.getByRole('button', { name: '登出', exact: true }).boundingBox();
  if (!logout || logout.y < 0 || logout.y + logout.height > 375) throw new Error('Last menu action is clipped');
  await page.screenshot({ path: 'output/playwright/single-header-landscape-menu.png' });
  results.push({ landscapeMenu: geometry });
  await page.setViewportSize({ width: 390, height: 844 });

  if (await menu().isVisible()) await clickWithoutScroll(menu());
  const nav = page.getByRole('navigation', { name: '行動導覽選單' });
  if (!await nav.getByRole('link', { name: '管理後台' }).isVisible()) throw new Error('Test admin lost admin entry');
  if (!await nav.getByRole('button', { name: '登出', exact: true }).isVisible()) throw new Error('Account signout unavailable');
  await nav.getByRole('link', { name: '個人設定', exact: true }).click();
  await page.waitForURL('**/me');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '個人設定', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  results.push({ account: 'admin entry and logout present; personal settings dialog opens without editing' });

  await page.goto(origin + '/learn/church-reading');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => scrollTo(0, 900));
  await page.waitForTimeout(200);
  const beforeY = await page.evaluate(() => scrollY);
  await clickWithoutScroll(menu());
  await clickWithoutScroll(page.getByTestId('mobile-menu-care'));
  await page.waitForURL('**/care');
  await page.waitForLoadState('networkidle');
  await clickWithoutScroll(page.getByRole('button', { name: '返回上一頁', exact: true }));
  await page.waitForURL('**/learn/church-reading');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ y: scrollY, top: document.querySelector('[data-testid=mobile-navigation]').getBoundingClientRect().top }));
  if (Math.abs(after.y - beforeY) > 2 || Math.abs(after.top) > 1) throw new Error(`Reading back regression: ${JSON.stringify({ beforeY, ...after })}`);
  await page.screenshot({ path: 'output/playwright/single-header-reading-return.png' });
  results.push({ readingReturn: { beforeY, ...after } });
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  return { results, errors };
}

fs.mkdirSync('output/playwright', { recursive: true });
const cli = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
const output = execFileSync(cli, ['-s=site-nav', 'run-code', `async(page) => (${audit.toString()})(page)`], { encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
const result = output.split('### Result\n')[1]?.split('\n###')[0];
if (!result) throw new Error(output.split('### Ran')[0]);
fs.writeFileSync('output/playwright/single-header-results.json', result);
console.log(result);
