import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertRecovery, blockedPaths, edgeRules } from './harden-b-perimeter.mjs';
import { target } from '../scripts/railway-staging.mjs';

test('edge rules only block private probes, never challenge members or cache personal content', () => {
  assert.equal(edgeRules.rules.length, 1);
  assert.equal(edgeRules.rules[0].then.action, 'block');
  const matches = (value, pattern) => new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(value);
  for (const route of ['/api/callback', '/api/auth/user', '/api/bible-study/chapter', '/learn/bible', '/learn/church-reading', '/uploads/photo.png', '/theme-init.js', '/load-error.js', '/assets/app.js', '/__healthcheck', '/.well-known/test']) {
    assert(!blockedPaths.some(pattern => matches(route, pattern)), route);
  }
  for (const route of ['/.env', '/.env.production', '/.git/config', '/server/index.ts', '/bible-study-data/core.sqlite']) assert(blockedPaths.some(pattern => matches(route, pattern)), route);
});

test('database closure requires fresh B restore verification and intact encrypted files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wechurch-perimeter-test-'));
  const now = Date.now();
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const manifest = { environment: target.environment, complete: true, createdAt: new Date(now).toISOString(), files: [] };
  for (const name of ['database.dump.enc', 'uploads.tgz.enc', 'settings.json.enc', 'proof.json.enc', 'reference.tgz.enc']) {
    const bytes = Buffer.from('disposable test fixture');
    fs.writeFileSync(path.join(directory, name), bytes);
    manifest.files.push({ name, bytes: bytes.length, sha256: sha(bytes) });
  }
  const bytes = JSON.stringify(manifest);
  const proof = { manifestSha256: sha(bytes), allTableContentDigestsMatch: true, uploadHashesMatch: true, referenceAssetsMatch: true, settingsIdentityMatch: true, temporaryPlaintextRemoved: true };
  fs.writeFileSync(path.join(directory, 'manifest.json'), bytes);
  fs.writeFileSync(path.join(directory, 'restore-verification.json'), JSON.stringify(proof));
  try {
    assert.doesNotThrow(() => assertRecovery(directory, now));
    assert.throws(() => assertRecovery(directory, now + 3600001));
    assert.throws(() => assertRecovery(directory, now - 1));
    fs.writeFileSync(path.join(directory, 'database.dump.enc'), 'tampered');
    assert.throws(() => assertRecovery(directory, now));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
