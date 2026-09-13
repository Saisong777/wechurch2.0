import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, target } from './railway-staging.mjs';

const dir = path.join(root, 'artifacts/railway-staging');
const code = fs.readFileSync(path.join(dir, 'access.txt'), 'utf8').match(/\u6e2c\u8a66\u9080\u8acb\u78bc\uff1a([^\n]+)/)?.[1];
assert.ok(code, 'Missing staging invitation');
const gate = await fetch(target.origin + '/__staging/access', { method: 'POST', redirect: 'manual', headers: { Origin: target.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(15000) });
assert.equal(gate.status, 303);
const cookie = gate.headers.getSetCookie().map(item => item.split(';')[0]).join('; ');
async function get(endpoint) {
  const response = await fetch(target.origin + endpoint, { headers: { Cookie: cookie, 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, endpoint);
  return response.json();
}
const books = await get('/api/bible/books');
assert.equal(books.length, 66);
assert.equal(books.reduce((sum, book) => sum + book.chapterCount, 0), 1189);
const samples = [];
for (const book of [books[0], books[18], books[42], books[65]]) {
  const chapters = await get('/api/bible/chapters/' + encodeURIComponent(book.bookName));
  assert.equal(chapters.length, book.chapterCount);
  for (const chapter of [chapters[0], chapters.at(-1)]) {
    const verses = await get(`/api/bible/verses/${encodeURIComponent(book.bookName)}/${chapter.chapter}`);
    assert.equal(verses.length, chapter.verseCount);
    assert.ok(verses.length > 0 && verses.every(row => row.text?.trim()));
    samples.push({ book: book.bookName, chapter: chapter.chapter, verses: verses.length });
  }
}
const search = await get('/api/bible/search?q=' + encodeURIComponent('\u8d77\u521d'));
assert.ok(search.length > 0);
assert.ok(search.every(row => row.text.replace(/\s/g, '').includes('\u8d77\u521d')));
const blessings = await get('/api/bible/blessing');
assert.equal(blessings.length, 675);
assert.equal((await get('/api/jesus/timeline')).length, 208);
const plans = await get('/api/reading-plans');
assert.equal(plans.length, 12);
assert.ok(plans.every(plan => plan.isPublic && plan.createdBy === null));
let items = 0;
for (const plan of plans) items += (await get(`/api/reading-plans/${plan.id}/items`)).length;
assert.equal(items, 312);
assert.equal((await fetch('https://www.wechurch.online/__healthcheck', { signal: AbortSignal.timeout(15000) })).status, 200);
const report = { at: new Date().toISOString(), origin: target.origin, books: books.length, chapters: 1189, samples, searchResults: search.length, blessings: blessings.length, timeline: 208, publicPlans: plans.length, publicPlanItems: items, productionHealth: 200 };
fs.writeFileSync(path.join(dir, 'public-content-api-verification.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
