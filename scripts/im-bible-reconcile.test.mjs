import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileLegacy } from './im-bible-reconcile.mjs';
import { SOURCE_PROJECT } from './im-bible-migration.mjs';

function fixture() {
  return {
    legacy: { source: `Firebase project ${SOURCE_PROJECT}`, members: [{ uid: 'person', email: 'person@example.test',
      notes: [{ key: 'august-0', date: '8月1日', passage: 'Isaiah 1', text: '  PRIVATE\n原文  ' }],
      readDays: [{ key: 'august-0', date: '8/1', passage: 'Isaiah 1' }] }] },
    bundle: { format: 'wechurch-im-bible-import-v1', projectId: SOURCE_PROJECT,
      members: [{ sourceUid: 'person', email: 'person@example.test' }],
      notes: [{ sourceUid: 'person', dayKey: 'august-0', devotionalDate: '2026-08-01', reference: 'Isaiah 1', body: '  PRIVATE\n原文  ' }],
      readDays: [{ sourceUid: 'person', dayKey: 'august-0', devotionalDate: '2026-08-01', reference: 'Isaiah 1' },
        { sourceUid: 'person', dayKey: 'august-1', devotionalDate: '2026-08-02', reference: 'Isaiah 2' }] },
  };
}
test('all legacy bytes and ownership are compared; additions are counted without leaking PII', () => {
  const { legacy, bundle } = fixture(), result = reconcileLegacy(legacy, bundle, 2026);
  assert.equal(result.matched, true);
  assert.deepEqual(result.counts, { membersCompared: 1, notesCompared: 1, readDaysCompared: 1,
    addedMembers: 0, addedNotes: 0, addedReadDays: 1 });
  assert.doesNotMatch(JSON.stringify(result), /person|PRIVATE|原文/);
});
for (const [name, change, code] of [
  ['changed text', f => { f.bundle.notes[0].body = 'different'; }, 'LEGACY_NOTE_CONTENT_CHANGED'],
  ['wrong owner', f => { f.bundle.notes[0].sourceUid = 'other'; }, 'LEGACY_RECORD_MISSING'],
  ['wrong date', f => { f.bundle.notes[0].devotionalDate = '2026-08-02'; }, 'LEGACY_DATE_OR_REFERENCE_CHANGED'],
  ['wrong reference', f => { f.bundle.notes[0].reference = 'Isaiah 2'; }, 'LEGACY_DATE_OR_REFERENCE_CHANGED'],
  ['missing member', f => { f.bundle.members = []; }, 'LEGACY_MEMBER_MISSING'],
  ['changed email', f => { f.bundle.members[0].email = 'other@example.test'; }, 'LEGACY_EMAIL_CHANGED'],
  ['duplicate record', f => { f.legacy.members[0].notes.push(f.legacy.members[0].notes[0]); }, 'DUPLICATE_LEGACY_RECORD'],
]) test(`flags ${name}`, () => {
  const f = fixture(); change(f);
  const result = reconcileLegacy(f.legacy, f.bundle, 2026);
  assert.equal(result.matched, false);
  assert.ok(result.issues.some(issue => issue.code === code));
});

test('rejects an unrelated project or malformed source', () => {
  const f = fixture(); f.legacy.source = 'other';
  assert.equal(reconcileLegacy(f.legacy, f.bundle, 2026).matched, false);
  assert.equal(reconcileLegacy(null, f.bundle, 2026).matched, false);
});
