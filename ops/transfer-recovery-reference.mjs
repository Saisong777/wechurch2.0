import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const name = 'reference.tgz.enc';
const chunkBytes = 90 * 1024 * 1024;
const maxBytes = 512 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function expected(directory) {
  const manifest = read(path.join(directory, 'manifest.json'));
  assert.equal(manifest.complete, true);
  const entry = manifest.files.find(file => file.name === name);
  assert(entry && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= maxBytes);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  return entry;
}

export function splitReference(directory) {
  const entry = expected(directory);
  const source = path.join(directory, name);
  assert.equal(fs.statSync(source).size, entry.bytes);
  const bytes = fs.readFileSync(source);
  assert.equal(hash(bytes), entry.sha256);
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    const part = bytes.subarray(offset, offset + chunkBytes);
    parts.push({ name: `${name}.part-${String(parts.length + 1).padStart(2, '0')}`, bytes: part.length, sha256: hash(part) });
  }
  const indexPath = path.join(directory, 'reference-transfer.json');
  for (const file of [...parts, { name: 'reference-transfer.json' }]) assert(!fs.existsSync(path.join(directory, file.name)), 'Transfer output already exists');
  for (const [i, part] of parts.entries()) {
    const destination = path.join(directory, part.name);
    fs.writeFileSync(destination, bytes.subarray(i * chunkBytes, i * chunkBytes + part.bytes), { flag: 'wx', mode: 0o600 });
    assert.equal(hash(fs.readFileSync(destination)), part.sha256);
  }
  const transfer = { format: 1, source: entry, parts };
  fs.writeFileSync(indexPath, JSON.stringify(transfer, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return transfer;
}

export function joinReference(directory) {
  const entry = expected(directory);
  const transfer = read(path.join(directory, 'reference-transfer.json'));
  assert.equal(transfer.format, 1);
  assert.deepEqual(transfer.source, entry);
  assert(Array.isArray(transfer.parts) && transfer.parts.length > 0 && transfer.parts.length <= Math.ceil(maxBytes / chunkBytes));
  assert.equal(transfer.parts.reduce((sum, p) => sum + p.bytes, 0), entry.bytes);
  const parts = transfer.parts.map((part, i) => {
    assert.equal(part.name, `${name}.part-${String(i + 1).padStart(2, '0')}`);
    assert(Number.isSafeInteger(part.bytes) && part.bytes > 0 && part.bytes <= chunkBytes);
    assert.match(part.sha256, /^[a-f0-9]{64}$/);
    const source = path.join(directory, part.name);
    assert.equal(fs.statSync(source).size, part.bytes);
    const bytes = fs.readFileSync(source);
    assert.equal(hash(bytes), part.sha256);
    return bytes;
  });
  const bytes = Buffer.concat(parts);
  assert.equal(hash(bytes), entry.sha256);
  const destination = path.join(directory, name);
  fs.writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(hash(fs.readFileSync(destination)), entry.sha256);
  return { reconstructed: true, bytes: bytes.length, sha256: entry.sha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.umask(0o077);
    const [action, input] = process.argv.slice(2);
    assert(process.argv.length === 4 && ['split', 'join'].includes(action));
    const directory = fs.realpathSync(input);
    const checkout = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    assert(path.relative(checkout, directory).startsWith('../'), 'Use a private directory outside checkout');
    console.log(JSON.stringify(action === 'split' ? splitReference(directory) : joinReference(directory)));
  } catch {
    console.error('Encrypted reference transfer failed; originals are preserved.');
    process.exitCode = 1;
  }
}
