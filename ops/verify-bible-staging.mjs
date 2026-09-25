import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspectStaging, root, target, verifyRemoteBibleAssets } from '../scripts/railway-staging.mjs';
import { verifyAssets } from '../scripts/bible-study-assets.mjs';
import { createReader, noteSources } from '../server/bibleStudy/core.mjs';

const { app, productionDeployment } = inspectStaging();
const assets = verifyAssets(path.join(root, 'bible-study-data'));
assert.deepEqual(verifyRemoteBibleAssets(app.BIBLE_STUDY_DIR), assets);
let cookie = '';
async function call(route, method = 'GET', body) {
  const response = await fetch(target.origin + route, { method, redirect: 'manual', signal: AbortSignal.timeout(25000),
    headers: { Cookie: cookie, Origin: target.origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const entry of response.headers.getSetCookie()) {
    const pair = entry.split(';')[0], name = pair.split('=')[0];
    cookie = cookie.split('; ').filter(p => p && !p.startsWith(name + '=')).concat(pair).join('; ');
  }
  return response;
}
assert.equal((await call('/__staging/access', 'POST', { code: app.STAGING_ACCESS_CODE })).status, 303);
assert.equal((await (await call('/api/bible-study/status')).json()).enabled, true);
const reader = createReader(path.join(root, 'bible-study-data/data/core.sqlite'));
const cases = [
  ['info', {}], ['chapter', { book: 1, chapter: 1 }],
  ['chapter', { book: 43, chapter: 3, translation: 'cmncbt' }],
  ['chapter', { book: 43, chapter: 3, translation: 'engwebp' }],
  ['chapter', { book: 66, chapter: 22 }],
  ...noteSources.map(source => ['notes', { book: 43, chapter: 3, verse: 16, source }]),
  ['tokens', { book: 1, chapter: 1, verse: 1 }], ['tokens', { book: 43, chapter: 3, verse: 16 }],
  ['dictionary', { term: 'H430' }], ['dictionary', { term: 'G25' }],
  ['xrefs', { book: 43, chapter: 3, verse: 16 }], ['search', { q: '重生', source: 'cmncbt' }],
];
try {
  const times = [];
  for (const [action, query] of cases) {
    const start = Date.now();
    const response = await call(`/api/bible-study/${action}?${new URLSearchParams(query)}`);
    assert.equal(response.status, 200, action);
    assert.deepEqual(await response.json(), reader.query(action, query), action);
    times.push({ action, milliseconds: Date.now() - start });
  }
  for (const route of ['/uploads/.bible-study/public-20260925-v1/data/core.sqlite', '/uploads/%2ebible-study/public-20260925-v1/NOTICE.md', '/uploads/%2Ebible-study/public-20260925-v1/data/core.sqlite', '/uploads/%252ebible-study/public-20260925-v1/NOTICE.md', '/uploads/missing-file.png', '/open/data/core.sqlite', '/library', '/api/bible-study/private']) assert.equal((await call(route)).status, 404, route);
  assert.equal((await call('/api/bible-study/chapter?book=1&book=2')).status, 400);
  assert.equal((await call('/api/bible-study/chapter', 'POST', {})).status, 405);
  assert.equal((await call('/api/devotional-notes')).status, 401);
  assert.equal((await call('/api/saved-verses')).status, 401);
  const license = await call('/open/licenses'); assert.equal(license.status, 200);
  assert.match(await license.text(), /Biblica/);
  const result = { verifiedAt: new Date().toISOString(), origin: target.origin, cases: times, databaseHash: assets.databaseHash, fileHashesMatch: true, privatePathsBlocked: true, memberLoginRequired: true, productionDeploymentObserved: productionDeployment };
  fs.writeFileSync(path.join(root, 'artifacts/railway-staging/bible-live-verification.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { reader.close(); }
