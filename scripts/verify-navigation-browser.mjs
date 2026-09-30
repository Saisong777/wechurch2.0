import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const source = ts.createSourceFile('App.tsx', fs.readFileSync('src/App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routes = [];
function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.text === 'path' && node.initializer && ts.isStringLiteral(node.initializer)) routes.push(node.initializer.text);
  ts.forEachChild(node, visit);
}
visit(source);
const paths = routes.filter(route => !route.includes(':')).map(route => route === '*' ? '/navigation-qa-missing-page' : route);
const start = Number(process.argv[2] || 0);
const count = Number(process.argv[3] || 6);
const width = Number(process.argv[4] || 390);
const selected = paths.slice(start, start + count);

async function audit(page, paths, width) {
  const results = [];
  const origin = 'https://wechurch-staging-staging.up.railway.app';
  await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
  for (const route of paths) {
    const errors = [];
    const onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    const started = Date.now();
    try {
      const response = await page.goto(origin + route);
      let settled = true;
      try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch { settled = false; }
      await page.waitForTimeout(150);
      const info = await page.evaluate(() => {
        const visible = el => el.getClientRects().length > 0;
        const links = [...document.querySelectorAll('a[href]')].filter(visible).map(el => ({ text: el.textContent.trim().slice(0, 40), href: el.getAttribute('href') }));
        const body = document.body.innerText;
        const nav = document.querySelector('[data-testid=mobile-navigation]');
        return {
          pathname: location.pathname, heading: document.querySelector('main h1, h1')?.textContent?.slice(0, 80),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          errorPage: /頁面載入失敗|Unexpected Application Error|Something went wrong/.test(body),
          gate: /維護中|beta 測試中|請先登入|沒有權限/.test(body),
          navVisible: !!nav && visible(nav), navHeight: nav?.getBoundingClientRect().height ?? null,
          oldDock: !!document.querySelector('[data-testid=nav-bottom-dock]'),
          footerNav: !!document.querySelector('[data-testid=nav-bottom]'),
          duplicateHeader: !!nav && visible(nav) && [...document.querySelectorAll('[data-testid=page-header], .dashboard-header')].some(visible),
          links, backButtons: [...document.querySelectorAll('button')].filter(el => visible(el) && /返回|回到/.test(el.textContent)).length,
        };
      });
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(100);
      const end = await page.evaluate(() => {
        const nav = document.querySelector('[data-testid=mobile-navigation]');
        const footer = document.querySelector('[data-testid=nav-bottom]');
        return { scrollY, top: nav?.getBoundingClientRect().top ?? null, footerPosition: footer ? getComputedStyle(footer).position : null };
      });
      let menu = null;
      if (info.navVisible) {
        await page.getByRole('button', { name: '開啟導覽選單', exact: true }).click();
        menu = await page.getByRole('navigation', { name: '行動導覽選單' }).evaluate(el => [...el.querySelectorAll('a')].map(a => {
          const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), width: r.width, height: r.height };
        }));
        await page.getByRole('button', { name: '關閉導覽選單', exact: true }).click();
      }
      results.push({ route, status: response.status(), settled, elapsedMs: Date.now() - started, ...info, end, menu, errors });
    } catch (error) { results.push({ route, failure: error.message, errors }); }
    finally { page.off('pageerror', onError); }
  }
  return results;
}

const cli = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
const code = `async(page) => (${audit.toString()})(page, ${JSON.stringify(selected)}, ${width})`;
const output = execFileSync(cli, ['-s=site-nav', 'run-code', code], { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
const resultText = output.split('### Result\n')[1]?.split('\n###')[0];
if (!resultText) throw new Error('Browser audit did not return structured results');
const results = JSON.parse(resultText);
fs.mkdirSync('output/navigation', { recursive: true });
fs.writeFileSync(`output/navigation/routes-${width}-${start}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(({ route, heading, overflow, errorPage, gate, navVisible, duplicateHeader, footerNav, end, failure, errors }) => ({ route, heading, overflow, errorPage, gate, navVisible, duplicateHeader, footerNav, topAtEnd: end?.top, failure, errors })), null, 2));
