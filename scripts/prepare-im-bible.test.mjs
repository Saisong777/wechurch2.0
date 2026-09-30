import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { seal, unseal } from './backup-envelope.mjs';
import { sha256, SOURCE_PROJECT } from './im-bible-migration.mjs';

test('preparation CLI produces verified encrypted data, preserves originals and refuses overwrite', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'im-bible-prepare-test-'));
  try {
    const plan = '<script>const PLAN_META={july:{title:"Plan"}};const PLAN_DATA={july:[{date:"7/1",passage:"Romans 1"}]};</script>';
    const source = { format: 'wechurch-im-bible-source-v2', projectId: SOURCE_PROJECT,
      exportedAt: '2026-09-24T00:00:00Z',
      scope: { auth: 'all-default-tenant-users', firestore: 'collection-group:data', firestoreReadTime: '2026-09-24T00:00:00Z' },
      planSource: { commit: 'a'.repeat(40), sha256: sha256(plan), content: plan },
      members: [{ uid: 'synthetic-member', email: 'test@example.test', emailVerified: true, disabled: false,
        providerData: [{ providerId: 'google.com', uid: '12345' }] }],
      documents: [{ name: `projects/${SOURCE_PROJECT}/databases/(default)/documents/users/synthetic-member/data/main`,
        fields: { notes: { mapValue: { fields: { 'july-0': { stringValue: '  PRIVATE\n原文  ' } } } },
          readDays: { arrayValue: { values: [{ stringValue: 'july-0' }] } } } }],
    };
    const review = { sourceCommit: source.planSource.commit, sourceSha256: source.planSource.sha256,
      year: 2026, reviewedBy: 'Synthetic reviewer', reviewedOn: '2026-09-24',
      expectedSections: [{ section: 'july', count: 1, first: '2026-07-01', last: '2026-07-01' }] };
    const key = randomBytes(32), keyFile = path.join(directory, 'backup.key');
    const input = path.join(directory, 'source.enc'), reviewFile = path.join(directory, 'review.json');
    const output = path.join(directory, 'prepared.enc');
    fs.writeFileSync(keyFile, key, { mode: 0o600 });
    fs.writeFileSync(input, seal(Buffer.from(JSON.stringify(source)), key), { mode: 0o600 });
    fs.writeFileSync(reviewFile, JSON.stringify(review));
    const before = fs.readFileSync(input);
    const run = destination => spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-im-bible.mjs', import.meta.url)), input, reviewFile, destination],
      { encoding: 'utf8', timeout: 15000, env: { ...process.env, WECHURCH_BACKUP_KEY_FILE: keyFile } });
    const result = run(output);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).importApproved, false);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE|原文|example.test|synthetic-member/);
    const encrypted = fs.readFileSync(output), artifact = JSON.parse(unseal(encrypted, key));
    assert.equal(artifact.bundle.notes[0].body, '  PRIVATE\n原文  ');
    assert.equal(artifact.bundle.notes[0].devotionalDate, '2026-07-01');
    assert.equal(fs.statSync(output).mode & 0o077, 0);
    assert.deepEqual(fs.readFileSync(input), before);
    assert.equal(run(output).status, 1);
    assert.deepEqual(fs.readFileSync(output), encrypted);
    review.sourceSha256 = 'b'.repeat(64);
    fs.writeFileSync(reviewFile, JSON.stringify(review));
    const rejected = path.join(directory, 'rejected.enc');
    assert.equal(run(rejected).status, 1);
    assert.equal(fs.existsSync(rejected), false);
    const repoOutput = fileURLToPath(new URL('./rejected-sensitive-test.enc', import.meta.url));
    assert.equal(run(repoOutput).status, 1);
    assert.equal(fs.existsSync(repoOutput), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
