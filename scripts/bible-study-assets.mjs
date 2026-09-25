import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const releaseId = 'public-20260926-v2';
export const databaseHash = 'eade3bb78bae619e8e14f8d89cd045f935e569e85add871b01b4b72ecf436f92';
const inventoryHash = '1beb864453f46862cdd846f5343fa6004139aedc5ba9328c60107979a80f5f95';
const hash = file => {
  const digest = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(file, 'r');
  try { let count; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, count)); }
  finally { fs.closeSync(fd); }
  return digest.digest('hex');
};
export function verifyAssets(directory) {
  const inventory = path.join(directory, 'SHA256SUMS');
  if (hash(inventory) !== inventoryHash) throw new Error('Bible asset inventory mismatch');
  const files = fs.readFileSync(inventory, 'utf8').trim().split('\n').map(line => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || path.isAbsolute(match[2]) || match[2].split('/').some(p => p === '..' || p === '.')) throw new Error('Invalid Bible asset path');
    return { file: match[2], sha256: match[1] };
  }).filter(({ file }) => /^(data\/|licenses\/)/.test(file) || ['NOTICE.md', 'web/licenses.html', 'web/style.css', 'VALIDATION.json'].includes(file));
  for (const item of files) {
    const file = path.join(directory, item.file);
    if (fs.lstatSync(file).isSymbolicLink() || !fs.realpathSync(file).startsWith(fs.realpathSync(directory) + path.sep) || hash(file) !== item.sha256) throw new Error('Bible asset verification failed: ' + item.file);
  }
  if (files.find(f => f.file === 'data/core.sqlite')?.sha256 !== databaseHash) throw new Error('Wrong Bible database');
  return { releaseId, databaseHash, inventoryHash, files };
}
export function copyAssets(source, destination) {
  const proof = verifyAssets(source);
  for (const file of ['SHA256SUMS', ...proof.files.map(f => f.file)]) {
    const to = path.join(destination, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(source, file), to);
  }
  verifyAssets(destination);
  return proof;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Usage: node scripts/bible-study-assets.mjs PACKAGE OUTPUT');
  console.log(JSON.stringify(source === '--verify' ? verifyAssets(path.resolve(destination)) : copyAssets(path.resolve(source), path.resolve(destination))));
}
