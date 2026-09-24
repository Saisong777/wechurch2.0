import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectSource } from './im-bible-migration.mjs';
import { readBackupKey, unseal } from './backup-envelope.mjs';

try {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) throw new Error('Usage: node scripts/check-im-bible.mjs SOURCE.json-or-encrypted-file');
  const bytes = fs.readFileSync(file);
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const content = bytes.subarray(0, 18).toString().startsWith('WECHURCH-BACKUP-1')
    ? unseal(bytes, readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, repo)) : bytes;
  let source;
  try { source = JSON.parse(content.toString('utf8')); } catch { throw new Error('Invalid source JSON'); }
  const result = inspectSource(source);
  console.log(JSON.stringify(result, null, 2));
  if (!result.structurallyReady) process.exitCode = 2;
} catch (error) {
  // JSON parser errors can contain private snippets, so never print arbitrary input.
  console.error(error.code ? `Source could not be read (${error.code})` : 'Source could not be checked; verify file format, path and backup key');
  process.exitCode = 1;
}
