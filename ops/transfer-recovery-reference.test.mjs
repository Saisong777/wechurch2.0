import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { splitReference, joinReference } from './transfer-recovery-reference.mjs';

test('ciphertext roundtrip, corruption rejection and no overwrite', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-transfer-'));
  try {
    const bytes = Buffer.from('synthetic ciphertext fixture');
    const name = 'reference.tgz.enc';
    const source = path.join(directory, name);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(source, bytes);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ complete: true, files: [{ name, bytes: bytes.length, sha256 }] }));
    splitReference(directory);
    assert.throws(() => splitReference(directory));
    assert.throws(() => joinReference(directory));
    fs.unlinkSync(source);
    const part = path.join(directory, name + '.part-01');
    fs.writeFileSync(part, Buffer.alloc(bytes.length));
    assert.throws(() => joinReference(directory));
    assert(!fs.existsSync(source));
    fs.writeFileSync(part, bytes);
    assert.equal(joinReference(directory).sha256, sha256);
    assert.deepEqual(fs.readFileSync(source), bytes);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
