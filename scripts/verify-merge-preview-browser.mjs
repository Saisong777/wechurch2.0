import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function audit(page) {
  const pattern = '**/api/pastoral/merge-suggestions**';
  const flagsPattern = '**/api/feature-toggles';
  const personsPattern = '**/api/pastoral/persons?*';
  await page.route(flagsPattern, async route => {
    const response = await route.fetch();
    const flags = await response.json();
    await route.fulfill({ json: flags.map(flag => flag.featureKey === 'pastoral_beta' ? { ...flag, isEnabled: true } : flag) });
  });
  await page.route(personsPattern, route => route.fulfill({ json: { schemaReady: true, persons: [] } }));
  const sample = { id: 'preview-only', primaryPersonId: '00000000-0000-4000-8000-000000000001', duplicatePersonId: '00000000-0000-4000-8000-000000000002',
    primaryName: '介面測試主檔', duplicateName: '介面測試來源', primaryEmail: null, duplicateEmail: null, reason: '僅介面測試', confidence: 100 };
  let previewCalls = 0, commitAttempts = 0;
  await page.route(pattern, async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { schemaReady: true, suggestions: [sample] } });
    const body = route.request().postDataJSON();
    if (!body.preview) { commitAttempts++; return route.abort(); }
    previewCalls++;
    return route.fulfill({ json: { ...sample, success: true, previewToken: 'a'.repeat(64), counts: { 'pastoral_tasks.person_id': 2 } } });
  });
  const results = [];
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('https://wechurch-staging-staging.up.railway.app/admin/crm');
      if (width < 640) {
        await page.getByRole('combobox', { name: 'CRM 工作區', exact: true }).click();
        await page.getByRole('option', { name: '個人/門訓', exact: true }).click();
      } else await page.getByRole('tab', { name: '個人/門訓', exact: true }).click();
      await page.getByRole('button', { name: '合併', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', { name: '確認合併對象' }).waitFor();
      if (!(await dialog.innerText()).includes('移轉 2 筆')) throw new Error('Missing preview counts');
      const box = await dialog.boundingBox();
      if (!box || box.x < 0 || box.x + box.width > width || box.y < 0 || box.y + box.height > 844) throw new Error('Preview dialog clipped');
      await page.screenshot({ path: `output/playwright/merge-preview-${width}.png`, animations: 'disabled' });
      await dialog.getByRole('button', { name: '取消', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      results.push({ width, previewVisible: true, cancelWorks: true });
    }
    if (previewCalls !== 2 || commitAttempts) throw new Error('Unexpected merge write attempt');
    return { results, previewCalls, commitAttempts, fixtureResponsesOnly: true, realMemberWrites: false };
  } finally {
    await page.unroute(pattern);
    await page.unroute(flagsPattern);
    await page.unroute(personsPattern);
    await page.goto('https://wechurch-staging-staging.up.railway.app/');
  }
}
const cli = `${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`;
const output = execFileSync(cli, ['-s=site-nav', 'run-code', `async page => (${audit.toString()})(page)`], { encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
const result = output.split('### Result\n')[1]?.split('\n###')[0];
if (!result) throw new Error(output.split('### Ran')[0]);
fs.writeFileSync('output/playwright/merge-preview-results.json', result);
console.log(result);
