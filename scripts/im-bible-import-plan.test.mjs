import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareImportBundle, planImport, summarizePlan, isCalendarDate } from './im-bible-import-plan.mjs';
import { SOURCE_PROJECT, sha256 } from './im-bible-migration.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { seal } from './backup-envelope.mjs';
import { fileURLToPath } from 'node:url';

const userId = '10000000-0000-0000-0000-000000000001';
const otherId = '10000000-0000-0000-0000-000000000002';
function fixture() {
  const source = { format: 'wechurch-im-bible-source-v2', projectId: SOURCE_PROJECT,
    scope: { auth: 'all-default-tenant-users', firestore: 'collection-group:data', firestoreReadTime: '2026-09-24T00:00:00Z' },
    planSource: { commit: 'a'.repeat(40), content: 'synthetic plan', sha256: sha256('synthetic plan') },
    members: [{ uid: 'source-person', email: 'member@example.test', name: 'Synthetic', emailVerified: true, disabled: false,
      providerData: [{ providerId: 'google.com', uid: '10001' }] }],
    documents: [{ name: `projects/${SOURCE_PROJECT}/databases/(default)/documents/users/source-person/data/main`,
      updateTime: '2026-09-24T00:00:00Z', fields: {
        notes: { mapValue: { fields: { 'july-0': { stringValue: '  原文\n保留空白  ' }, 'july-1': { stringValue: '' } } } },
        readDays: { arrayValue: { values: [{ stringValue: 'july-0' }] } },
      } }],
  };
  const calendar = { format: 'wechurch-im-bible-calendar-v1', sourceCommit: source.planSource.commit,
    sourceSha256: source.planSource.sha256, reviewedBy: 'Synthetic reviewer', reviewedOn: '2026-09-24',
    entries: [{ key: 'july-0', date: '2026-07-01', reference: '羅馬書 1', planTitle: 'Synthetic plan' },
      { key: 'july-1', date: '2026-07-02', reference: '羅馬書 2', planTitle: 'Synthetic plan' }] };
  const target = { format: 'wechurch-im-bible-target-v1', users: [], authUsers: [], googleLinks: [], sourceAccounts: [], records: [] };
  return { source, calendar, target };
}
function bundleOf(source, calendar) {
  const result = prepareImportBundle(source, calendar);
  assert.equal(result.ready, true);
  return result.bundle;
}
function existingTarget(bundle) {
  return { format: 'wechurch-im-bible-target-v1', users: [{ id: userId, email: 'member@example.test' }],
    authUsers: [{ id: '10001', email: 'member@example.test' }],
    googleLinks: [{ googleSubject: '10001', userId, authUserId: '10001' }],
    sourceAccounts: [{ projectId: SOURCE_PROJECT, sourceUid: 'source-person', userId }],
    records: [...bundle.notes.map(r => ({ ...r, kind: 'note' })), ...bundle.readDays.map(r => ({ ...r, kind: 'read-day' }))]
      .map(r => ({ sourceKey: r.sourceKey, recordSha256: r.recordSha256, kind: r.kind, userId, targetExists: true })),
  };
}
test('preparation preserves exact text and empty notes; no fabricated writing timestamp', () => {
  const { source, calendar } = fixture(), before = JSON.stringify(source);
  const bundle = bundleOf(source, calendar);
  assert.equal(bundle.notes.length, 2);
  assert.equal(bundle.notes.find(n => n.dayKey === 'july-0').body, '  原文\n保留空白  ');
  assert.equal(bundle.notes.find(n => n.dayKey === 'july-1').body, '');
  assert.equal(bundle.notes[0].writtenAt, null);
  assert.equal(bundle.notes[0].devotionalDate.startsWith('2026-07-'), true);
  assert.equal(JSON.stringify(source), before);
});
test('invalid dates are rejected instead of rolling February into March', () => {
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2026-13-01'), false);
  assert.equal(isCalendarDate('7/1'), false);
});
for (const [name, change, code] of [
  ['missing calendar review', f => { delete f.calendar.reviewedBy; }, 'REVIEWED_CALENDAR_REQUIRED'],
  ['wrong source commit', f => { f.calendar.sourceCommit = 'b'.repeat(40); }, 'REVIEWED_CALENDAR_REQUIRED'],
  ['wrong source hash', f => { f.calendar.sourceSha256 = 'b'.repeat(64); }, 'REVIEWED_CALENDAR_REQUIRED'],
  ['unknown source day', f => { f.calendar.entries.pop(); }, 'UNMAPPED_SOURCE_DAY'],
  ['duplicate calendar key', f => { f.calendar.entries.push({ ...f.calendar.entries[0] }); }, 'DUPLICATE_CALENDAR_KEY'],
  ['invalid calendar date', f => { f.calendar.entries[0].date = '2026-02-30'; }, 'INVALID_CALENDAR_ENTRY'],
]) test(`preparation blocks ${name} as a whole batch`, () => {
  const f = fixture(); change(f);
  const result = prepareImportBundle(f.source, f.calendar);
  assert.equal(result.ready, false); assert.equal(result.bundle, null);
  assert.ok(result.issues.some(i => i.code === code));
});
test('empty target plans ordinary account creation and private record inserts only', () => {
  const f = fixture(), result = planImport(bundleOf(f.source, f.calendar), f.target);
  assert.equal(result.ready, true); assert.equal(result.importApproved, false);
  assert.deepEqual(summarizePlan(result).counts, { 'account:create-member': 1, 'note:insert': 2, 'read-day:insert': 1 });
  assert.doesNotMatch(JSON.stringify(summarizePlan(result)), /member@|原文|source-person/);
});
test('repeating the same source plans zero new accounts or records', () => {
  const f = fixture(), bundle = bundleOf(f.source, f.calendar), target = existingTarget(bundle);
  const before = JSON.stringify(target), result = planImport(bundle, target);
  assert.equal(result.ready, true);
  assert.ok(result.actions.every(a => a.action === 'unchanged'));
  assert.equal(JSON.stringify(target), before);
});
test('same Google identity links source without changing an existing account or its email', () => {
  const f = fixture(), bundle = bundleOf(f.source, f.calendar), target = existingTarget(bundle);
  target.sourceAccounts = []; target.records = []; target.users[0].email = 'changed@example.test';
  const result = planImport(bundle, target);
  assert.equal(result.ready, true); assert.equal(result.actions[0].action, 'link-source');
  assert.ok(result.actions.every(a => a.userId === userId));
});
test('same email without a verified subject match never merges accounts', () => {
  const f = fixture(); f.target.users.push({ id: userId, email: 'Member@Example.test' });
  const result = planImport(bundleOf(f.source, f.calendar), f.target);
  assert.equal(result.ready, false); assert.deepEqual(result.actions, []);
  assert.ok(result.issues.some(i => i.code === 'EMAIL_COLLISION_REQUIRES_REVIEW'));
});
test('orphan auth record cannot be mistaken for a new member', () => {
  const f = fixture(); f.target.authUsers.push({ id: 'local-orphan', email: 'member@example.test' });
  const result = planImport(bundleOf(f.source, f.calendar), f.target);
  assert.equal(result.ready, false); assert.deepEqual(result.actions, []);
  assert.ok(result.issues.some(i => i.code === 'EMAIL_COLLISION_REQUIRES_REVIEW'));
});
for (const [name, change, code] of [
  ['reassigned source identity', t => { t.users.push({ id: otherId, email: 'other@example.test' }); t.sourceAccounts[0].userId = otherId; }, 'SOURCE_ACCOUNT_IDENTITY_CONFLICT'],
  ['wrong note owner', t => { t.users.push({ id: otherId, email: 'other@example.test' }); t.records[0].userId = otherId; }, 'RECORD_OWNERSHIP_CONFLICT'],
  ['missing destination note', t => { t.records[0].targetExists = false; }, 'TARGET_RECORD_MISSING_REQUIRES_REVIEW'],
  ['duplicate destination link', t => { t.googleLinks.push({ ...t.googleLinks[0] }); }, 'INVALID_TARGET_GOOGLE_LINK'],
]) test(`dry-run blocks ${name}`, () => {
  const f = fixture(), bundle = bundleOf(f.source, f.calendar), target = existingTarget(bundle); change(target);
  const result = planImport(bundle, target);
  assert.equal(result.ready, false); assert.deepEqual(result.actions, []);
  assert.ok(result.issues.some(i => i.code === code));
});
test('changed source text is flagged for review, never overwrites a new-site edit', () => {
  const f = fixture(), original = bundleOf(f.source, f.calendar), target = existingTarget(original);
  f.source.documents[0].fields.notes.mapValue.fields['july-0'].stringValue = 'updated source';
  const changed = bundleOf(f.source, f.calendar);
  assert.equal(changed.notes.find(n => n.dayKey === 'july-0').sourceKey, original.notes.find(n => n.dayKey === 'july-0').sourceKey);
  const result = planImport(changed, target);
  assert.equal(result.ready, false); assert.deepEqual(result.actions, []);
  assert.ok(result.issues.some(i => i.code === 'SOURCE_CHANGED_REQUIRES_REVIEW'));
});
test('records absent from a newer source are never deleted from the target', () => {
  const f = fixture(), bundle = bundleOf(f.source, f.calendar), target = existingTarget(bundle);
  target.records.push({ ...target.records[0], sourceKey: 'retained-other-history' });
  const result = planImport(bundle, target);
  assert.equal(result.ready, true); assert.ok(result.actions.every(a => a.action === 'unchanged'));
});
test('altered bundle and missing target metadata fail closed', () => {
  const f = fixture(), bundle = bundleOf(f.source, f.calendar);
  assert.equal(planImport(bundle, {}).ready, false);
  bundle.notes[0].body = 'tampered';
  assert.equal(planImport(bundle, f.target).ready, false);
});
test('malformed record cannot pass by recalculating only the outer checksum', () => {
  const f = fixture(), bundle = bundleOf(f.source, f.calendar);
  bundle.notes[0].sourceUid = 'wrong-owner';
  const { bundleSha256, ...content } = bundle;
  bundle.bundleSha256 = sha256(JSON.stringify(content));
  assert.equal(planImport(bundle, f.target).ready, false);
});
test('CLI reads encrypted synthetic input, reports only counts, and writes no files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'im-bible-dry-run-'));
  try {
    const f = fixture(), key = randomBytes(32);
    const files = ['source.enc', 'calendar.json', 'target.json'].map(name => path.join(directory, name));
    const keyFile = path.join(directory, 'backup.key');
    fs.writeFileSync(keyFile, key, { mode: 0o600 });
    fs.writeFileSync(files[0], seal(Buffer.from(JSON.stringify(f.source)), key), { mode: 0o600 });
    fs.writeFileSync(files[1], JSON.stringify(f.calendar), { mode: 0o600 });
    fs.writeFileSync(files[2], JSON.stringify(f.target), { mode: 0o600 });
    const before = fs.readdirSync(directory).sort();
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./dry-run-im-bible.mjs', import.meta.url)), ...files], {
      encoding: 'utf8', timeout: 10000, env: { ...process.env, WECHURCH_BACKUP_KEY_FILE: keyFile },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ready, true);
    assert.doesNotMatch(result.stdout + result.stderr, /原文|example.test|source-person/);
    assert.deepEqual(fs.readdirSync(directory).sort(), before);
    f.calendar.entries = [];
    fs.writeFileSync(files[1], JSON.stringify(f.calendar));
    const invalid = spawnSync(process.execPath, [fileURLToPath(new URL('./dry-run-im-bible.mjs', import.meta.url)), ...files], {
      encoding: 'utf8', timeout: 10000, env: { ...process.env, WECHURCH_BACKUP_KEY_FILE: keyFile },
    });
    assert.equal(invalid.status, 2);
    assert.equal(JSON.parse(invalid.stdout).ready, false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
