import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareImportBundle, planImport, summarizePlan } from './im-bible-import-plan.mjs';
import { readBackupKey, unseal } from './backup-envelope.mjs';

try {
  const [sourceFile, calendarFile, targetFile] = process.argv.slice(2);
  if (!sourceFile || !calendarFile || !targetFile || process.argv.length !== 5) throw new Error('Arguments required');
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const read = file => {
    const bytes = fs.readFileSync(file);
    const body = bytes.subarray(0, 18).toString().startsWith('WECHURCH-BACKUP-1')
      ? unseal(bytes, readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, repo)) : bytes;
    return JSON.parse(body.toString('utf8'));
  };
  const prepared = prepareImportBundle(read(sourceFile), read(calendarFile));
  const report = prepared.ready ? summarizePlan(planImport(prepared.bundle, read(targetFile)))
    : { ready: false, importApproved: false, counts: {}, issues: prepared.issues };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) process.exitCode = 2;
} catch {
  console.error('Dry-run failed. Provide SOURCE, REVIEWED_CALENDAR, TARGET_SNAPSHOT files; check format and backup key. No data was written.');
  process.exitCode = 1;
}
