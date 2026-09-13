import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function verify(page) {
  const origin = 'https://wechurch-staging-staging.up.railway.app';
  const results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const clickVisible = async locator => {
    // Let route scroll restoration finish; do not let locator auto-scroll move a sticky target.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const box = await locator.boundingBox();
    assert(box && box.y >= 0, 'Navigation must already be visible');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/');
  await page.locator('main a[href="/learn/church-reading"]').first().click();
  await page.getByRole('button', { name: '展開經文', exact: true }).click();
  await page.evaluate(() => scrollTo(0, 1100));
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => scrollY);
  await clickVisible(page.getByRole('button', { name: '開啟導覽選單' }));
  await page.waitForTimeout(100);
  const opened = await page.evaluate(() => scrollY);
  await clickVisible(page.getByTestId('mobile-menu-share'));
  await page.waitForURL(origin + '/share');
  await clickVisible(page.getByRole('button', { name: '返回上一頁', exact: true }));
  await page.waitForURL(origin + '/learn/church-reading');
  await page.waitForTimeout(600);
  const restored = await page.evaluate(() => scrollY);
  assert(Math.abs(opened - before) < 2 && Math.abs(restored - before) < 2, 'Reading position shifted');
  assert(await page.getByRole('button', { name: '收起經文', exact: true }).count() > 0, 'Scripture collapsed on return');
  results.push({ flow: 'reading-menu-prayer-back', before, opened, restored, expanded: true });

  await page.getByRole('button', { name: '寫靈修筆記', exact: true }).click();
  await page.waitForLoadState('networkidle');
  const input = page.locator('#dn-observation');
  await input.waitFor();
  const original = await input.inputValue();
  await input.fill(original + '\nNAVIGATION_UNSAVED_QA');
  await page.evaluate(() => history.back());
  await page.getByRole('alertdialog').waitFor();
  await page.getByRole('button', { name: '繼續編輯' }).click();
  assert((await input.inputValue()).endsWith('NAVIGATION_UNSAVED_QA'), 'Browser back lost draft');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: '放棄修改並離開' }).click();
  await page.getByRole('button', { name: '寫靈修筆記', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await input.waitFor();
  assert(await input.inputValue() === original, 'Discard changed saved note');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  results.push({ flow: 'note-browser-back-and-discard', passed: true, savedNoteUnchanged: true });

  for (const destination of ['/groups', '/me', '/play']) {
    await clickVisible(page.getByRole('button', { name: '開啟導覽選單' }));
    await clickVisible(page.getByRole('navigation', { name: '行動導覽選單' }).locator(`a[href="${destination}"]`));
    await page.waitForURL(origin + destination);
    await page.waitForTimeout(250);
    assert(!await page.getByRole('navigation', { name: '行動導覽選單' }).isVisible(), 'Menu stayed open after route change');
    results.push({ flow: `menu-to-${destination}`, passed: true });
  }

  await page.goto(origin + '/care');
  await page.getByRole('button', { name: '新增對象', exact: true }).click();
  await page.getByLabel('名字', { exact: true }).fill('NAVIGATION_UNSAVED_QA');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '繼續編輯' }).click();
  assert(await page.getByLabel('名字', { exact: true }).inputValue() === 'NAVIGATION_UNSAVED_QA', 'Care draft lost');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '放棄修改並離開' }).click();
  results.push({ flow: 'care-cancel-and-discard', passed: true, noSave: true });

  await page.goto(origin + '/prayer-wall');
  await page.getByRole('button', { name: '寫下代禱', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('NAVIGATION_UNSAVED_QA');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '繼續編輯' }).click();
  assert(await page.getByRole('dialog').getByRole('textbox').first().inputValue() === 'NAVIGATION_UNSAVED_QA', 'Prayer draft lost');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '放棄修改並離開' }).click();
  results.push({ flow: 'prayer-cancel-and-discard', passed: true, noPublish: true });

  await page.goto(origin + '/learn/bible');
  await page.getByTestId('button-category-摩西五經').click();
  await page.getByTestId('button-book-1').click();
  await page.getByTestId('button-chapter-2').click();
  await page.getByTestId('verse-2-1').waitFor();
  await page.evaluate(() => scrollTo(0, 1000));
  await page.waitForTimeout(200);
  const bibleY = await page.evaluate(() => scrollY);
  await clickVisible(page.getByRole('button', { name: '開啟導覽選單' }));
  await clickVisible(page.getByTestId('mobile-menu-share'));
  await page.waitForURL(origin + '/share');
  await clickVisible(page.getByRole('button', { name: '返回上一頁', exact: true }));
  await page.waitForURL(origin + '/learn/bible');
  await page.getByTestId('verse-2-1').waitFor();
  await page.waitForTimeout(400);
  const bibleRestoredY = await page.evaluate(() => scrollY);
  assert(Math.abs(bibleY - bibleRestoredY) < 2, 'Bible reading scroll reset');
  await page.getByTestId('verse-2-1').click();
  await page.getByTestId('button-toolbar-note').click();
  await page.locator('#dn-observation').waitFor();
  assert(!await page.getByTestId('floating-toolbar').count(), 'Verse toolbar covers note editor');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  results.push({ flow: 'bible-chapter-back-and-note', before: bibleY, restored: bibleRestoredY, chapterPreserved: true, toolbarHiddenInEditor: true });

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 667, height: 375 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + '/learn/church-reading');
    await page.getByRole('button', { name: '寫靈修筆記', exact: true }).waitFor();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    if (viewport.width < 768) await clickVisible(page.getByRole('button', { name: '開啟導覽選單' }));
    await page.waitForTimeout(150);
    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="mobile-navigation"]');
      const menu = document.querySelector('nav[aria-label="行動導覽選單"]');
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, top: nav?.getBoundingClientRect().top, menuBottom: menu?.getBoundingClientRect().bottom, navVisible: !!nav?.getClientRects().length };
    });
    assert(!geometry.overflow, 'Horizontal overflow');
    if (viewport.width < 768) assert(geometry.top === 0 && geometry.menuBottom <= viewport.height, 'Navigation outside viewport');
    else assert(!geometry.navVisible, 'Mobile bar visible on desktop');
    await page.screenshot({ path: `output/navigation/reading-${viewport.width}x${viewport.height}.png` });
    results.push({ flow: 'responsive-reading', viewport, ...geometry });
  }
  return results;
}

fs.mkdirSync('output/navigation', { recursive: true });
let output;
try {
  output = execFileSync(process.env.HOME + '/.codex/skills/playwright/scripts/playwright_cli.sh', ['-s=site-nav', 'run-code', `async(page)=>(${verify.toString()})(page)`], { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
} catch (error) {
  console.error(error.stdout || error.message);
  process.exit(1);
}
const raw = output.split('### Result\n')[1]?.split('\n###')[0];
if (!raw) throw new Error(output.slice(0, 1800));
const results = JSON.parse(raw);
fs.writeFileSync('output/navigation/flows.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
