import test from 'node:test';
import assert from 'node:assert/strict';
import { tables, selectSql, actionFor, validateBible } from './railway-staging-content.mjs';

test('only five public reference tables are eligible', () => {
  assert.equal(tables.length, 5);
  for (const table of tables) assert.match(selectSql(table, true), /^SELECT/);
  for (const name of ['users', 'personal_prayers', 'devotional_notes', 'user_reading_progress']) assert.throws(() => selectSql({ table: name }), /not public/);
});
test('public plans exclude private templates and member author IDs', () => {
  assert.match(selectSql(tables[3], true), /NULL::uuid AS created_by/);
  assert.match(selectSql(tables[3], true), /WHERE is_public = true/);
  assert.match(selectSql(tables[4], true), /WHERE template_id IN \(SELECT id FROM reading_plan_templates WHERE is_public = true\)/);
  assert.doesNotMatch(selectSql(tables[3]), /WHERE|NULL::uuid/);
});
test('empty destination inserts, identical replay is a no-op, conflicts refuse', () => {
  assert.equal(actionFor([], [{ id: 1 }]), 'insert');
  assert.equal(actionFor([{ id: 1 }], [{ id: 1 }]), 'unchanged');
  assert.equal(actionFor([], []), 'unchanged');
  assert.throws(() => actionFor([{ id: 2 }], [{ id: 1 }]), /refusing/);
  assert.throws(() => actionFor([{ id: 2 }], []), /refusing/);
});
test('empty, incomplete, malformed, and duplicate Bible data is rejected', () => {
  assert.throws(() => validateBible([]), /complete/);
  const row = { verse_id: 1, book_name: 'Genesis', chapter: 1, verse: 1, text: 'Sample' };
  assert.throws(() => validateBible([row]), /complete/);
  assert.throws(() => validateBible([row, row]), /duplicate/);
  assert.throws(() => validateBible([{ ...row, text: ' ' }]), /Invalid/);
  assert.throws(() => validateBible([{ ...row, chapter: 0 }]), /Invalid/);
});
test('complete dataset passes and the single documented blank remains explicit', () => {
  const chapters = Array.from({ length: 1189 }, (_, i) => ({ book_name: i % 66 === 42 ? '\u7d04\u7ff0\u798f\u97f3' : `Book${i % 66}`, chapter: Math.floor(i / 66) + 1 }));
  const rows = Array.from({ length: 31102 }, (_, i) => ({ ...chapters[i % 1189], verse_id: i + 1, verse: Math.floor(i / 1189) + 1, text: 'Fixture' }));
  assert.deepEqual(validateBible(rows), { books: 66, chapters: 1189, verses: 31102, knownEmptyVerses: [] });
  rows[26381] = { verse_id: 26382, book_name: '\u7d04\u7ff0\u798f\u97f3', chapter: 7, verse: 53, text: '' };
  assert.equal(validateBible(rows).knownEmptyVerses.length, 1);
  rows[26381].verse = 54;
  assert.throws(() => validateBible(rows), /Invalid/);
});
