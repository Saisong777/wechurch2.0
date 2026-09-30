import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCalendar, reviewCalendar } from './im-bible-calendar.mjs';
import { sha256 } from './im-bible-migration.mjs';

const options = { sourceCommit: 'a'.repeat(40), year: 2026 };
const source = (data, meta = '{july:{title:"July plan"},august:{title:"August plan"}}') =>
  `<html><script src="firebase.js"></script><script>const PLAN_META=${meta};\nconst PLAN_DATA=${data};\nthrow new Error('NEVER EXECUTE');</script></html>`;

test('extracts all literal dates without executing source and uses indices, not day numbers', () => {
  const html = source('{july:[{date:"7/4",day:54,passage:"Romans 4"}],august:[{date:"8月1日",passage:"Isaiah 1"}]}');
  const draft = extractCalendar(html, options);
  assert.equal(draft.format, 'wechurch-im-bible-calendar-draft-v1');
  assert.equal(draft.sourceSha256, sha256(html));
  assert.deepEqual(draft.entries, [
    { key: 'july-0', date: '2026-07-04', reference: 'Romans 4', planTitle: 'July plan' },
    { key: 'august-0', date: '2026-08-01', reference: 'Isaiah 1', planTitle: 'August plan' },
  ]);
  assert.equal(draft.reviewedBy, undefined);
});

for (const [name, data] of [
  ['call expression', '{july:dangerous()}'],
  ['spread', '{...outside}'],
  ['computed key', '{[outside]:[]}'],
  ['getter', '{get july(){return []}}'],
  ['shorthand', '{july}'],
  ['duplicate section', '{july:[],july:[]}'],
  ['invalid day', '{july:[{date:"7/32",passage:"Romans"}]}'],
  ['wrong month', '{july:[{date:"8/1",passage:"Romans"}]}'],
  ['duplicate date', '{july:[{date:"7/1",passage:"A"},{date:"7/1",passage:"B"}]}'],
  ['reordered dates', '{july:[{date:"7/2",passage:"A"},{date:"7/1",passage:"B"}]}'],
  ['missing reference', '{july:[{date:"7/1"}]}'],
  ['unknown section', '{future:[]}'],
]) test(`rejects ${name}`, () => assert.throws(() => extractCalendar(source(data), options), /CALENDAR_/));

test('rejects missing year, duplicate declarations and malformed syntax', () => {
  assert.throws(() => extractCalendar(source('{}'), { sourceCommit: options.sourceCommit }), /CALENDAR_SOURCE_REQUIRED/);
  assert.throws(() => extractCalendar(`${source('{}')}<script>const PLAN_DATA={};</script>`, options), /CALENDAR_AMBIGUOUS_DECLARATION/);
  assert.throws(() => extractCalendar('<script>const PLAN_DATA={</script>', options), /CALENDAR_SOURCE_SYNTAX/);
});

test('review requires an independently supplied date and count checklist', () => {
  const draft = extractCalendar(source('{july:[{date:"7/4",passage:"Romans 4"}]}'), options);
  const review = { reviewedBy: 'Synthetic reviewer', reviewedOn: '2026-09-24',
    expectedSections: [{ section: 'july', count: 1, first: '2026-07-04', last: '2026-07-04' }] };
  assert.equal(reviewCalendar(draft, review).format, 'wechurch-im-bible-calendar-v1');
  assert.throws(() => reviewCalendar(draft, { ...review, expectedSections: [] }), /CALENDAR_REVIEW_MISMATCH/);
  assert.throws(() => reviewCalendar(draft, { ...review, reviewedBy: '' }), /CALENDAR_REVIEW_REQUIRED/);
});
