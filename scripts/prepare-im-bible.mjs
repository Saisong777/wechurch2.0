import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBackupKey, seal, unseal } from './backup-envelope.mjs';
import { extractCalendar, reviewCalendar } from './im-bible-calendar.mjs';
import { prepareImportBundle } from './im-bible-import-plan.mjs';
import { inspectSource, sha256 } from './im-bible-migration.mjs';

try {
  const [input, reviewFile, output] = process.argv.slice(2);
  if (!input || !reviewFile || !output || process.argv.length !== 5 || !path.isAbsolute(output)) throw new Error('INVALID_ARGUMENTS');
  const repo = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));
  const parent = fs.realpathSync(path.dirname(output));
  const relative = path.relative(repo, parent);
  if (!relative.startsWith(`..${path.sep}`) && relative !== '..') throw new Error('OUTPUT_MUST_BE_OUTSIDE_REPO');
  const destination = path.join(parent, path.basename(output));
  if (fs.existsSync(destination)) throw new Error('OUTPUT_ALREADY_EXISTS');
  const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, repo);
  const source = JSON.parse(unseal(fs.readFileSync(input), key).toString('utf8'));
  const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
  if (source.planSource?.commit !== review.sourceCommit || source.planSource?.sha256 !== review.sourceSha256) throw new Error('REVIEW_SOURCE_MISMATCH');
  const calendar = reviewCalendar(extractCalendar(source.planSource.content, review), review);
  const prepared = prepareImportBundle(source, calendar);
  if (!prepared.ready) {
    console.log(JSON.stringify({ ready: false, importApproved: false, issues: prepared.issues }));
    process.exitCode = 2;
  } else {
    const artifact = { format: 'wechurch-im-bible-prepared-v1', sourceExportedAt: source.exportedAt,
      sourcePlaintextSha256: sha256(JSON.stringify(source)), calendar, bundle: prepared.bundle };
    const plain = Buffer.from(JSON.stringify(artifact));
    const encrypted = seal(plain, key);
    if (!unseal(encrypted, key).equals(plain)) throw new Error('ENCRYPTION_FAILED');
    fs.writeFileSync(destination, encrypted, { flag: 'wx', mode: 0o600 });
    if (!unseal(fs.readFileSync(destination), key).equals(plain)) throw new Error('READBACK_FAILED');
    console.log(JSON.stringify({ prepared: true, importApproved: false, encrypted: true,
      ciphertextSha256: sha256(encrypted), sourceExportedAt: source.exportedAt,
      calendarDays: calendar.entries.length, counts: inspectSource(source).counts }));
  }
} catch {
  // Parser/filesystem errors may include note contents or private paths.
  console.error('Preparation failed; check encrypted source, reviewed calendar, key and unused output path');
  process.exitCode = 1;
}
