import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function audit(page, outputDirectory) {
  const origin = 'https://wechurch-staging-staging.up.railway.app';
  const routes = ['/', '/learn', '/learn/church-reading', '/learn/bible', '/learn/my-notes', '/grace-record', '/devotion-wall', '/prayer-wall', '/groups', '/care', '/me', '/me/activity', '/me/sharing', '/me/love-journey', '/me/mentoring', '/work', '/work/settings', '/admin', '/admin/crm', '/admin/church-devotions', '/play', '/user', '/user/notebook', '/notebook', '/learn/reading-plans', '/learn/jesus-timeline', '/prayer-meeting', '/card', '/icebreaker', '/grouper', '/play/bible-quiz', '/play/disciple-quiz'];
  const checks = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      try {
        await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
        const metrics = await page.evaluate(() => {
          const visible = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
          const rect = e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
          const headings = [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 12).map(e => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 70), size: getComputedStyle(e).fontSize }));
          const controls = [...document.querySelectorAll('button,a,input,select,textarea,[role=tab]')].filter(visible);
          const smallTargets = controls.filter(e => { const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).map(e => ({ tag: e.tagName, name: (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent).trim().slice(0, 40), ...rect(e) })).slice(0, 15);
          return { headings, smallTargets, scrollHeight: document.documentElement.scrollHeight, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1, visibleControls: controls.length, imageCount: [...document.images].filter(visible).length, brokenImages: [...document.images].filter(e => visible(e) && e.complete && !e.naturalWidth).length, mainCount: [...document.querySelectorAll('main')].filter(visible).length };
        });
        const file = `${outputDirectory}/${route.slice(1).replaceAll('/', '-') || 'home'}-${width}.png`;
        await page.screenshot({ path: file });
        checks.push({ route, reached: await page.evaluate(() => location.pathname), width, file, ...metrics });
      } catch (e) { checks.push({ route, width, failure: e.message.slice(0, 180) }); }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/');
  return { capturedAt: new Date().toISOString(), origin, checks, networkWriteMonitoring: false, submittedForms: false };
}

const directory = process.env.UI_AUDIT_DIRECTORY || 'output/playwright/ux-audit-2026-09-13';
if (!/^output\/playwright\/[a-zA-Z0-9_-]+$/.test(directory)) throw Error('Invalid evidence directory');
fs.mkdirSync(directory, { recursive: true });
const output = execFileSync(`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`, ['-s=church-review', 'run-code', `async page => (${audit.toString()})(page, ${JSON.stringify(directory)})`], { encoding: 'utf8', timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
const result = output.split('### Result\n')[1]?.split('\n###')[0];
if (!result) throw Error(output.slice(-3000));
const evidence = JSON.parse(result);
fs.writeFileSync(`${directory}/results.json`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ captures: evidence.checks.length, failures: evidence.checks.filter(c => c.failure), overflow: evidence.checks.filter(c => c.pageOverflow).map(c => ({ route: c.route, width: c.width })) }));
