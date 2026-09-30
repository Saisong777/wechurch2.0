import fs from 'node:fs';
import path from 'node:path';
import {readBackupKey, seal, unseal, hash} from '../scripts/backup-envelope.mjs';
import {prepareImportBundle} from '../scripts/im-bible-import-plan.mjs';
import {root} from '../scripts/railway-staging.mjs';

process.umask(0o077);
const [sourceFile, acceptedFile, destination] = process.argv.slice(2);
if (!sourceFile || !acceptedFile || !path.isAbsolute(destination) || !path.relative(root, fs.realpathSync(path.dirname(destination))).startsWith('../')) throw new Error('Private preparation paths required');
const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
try {
  const source = JSON.parse(unseal(fs.readFileSync(sourceFile), key));
  const accepted = JSON.parse(unseal(fs.readFileSync(acceptedFile), key));
  const result = prepareImportBundle(source, accepted.calendar);
  if (!result.ready) throw new Error('Source and accepted calendar do not reconcile');
  const artifact = {format: 'wechurch-im-bible-prepared-v1', sourceExportedAt: source.exportedAt,
    sourcePlaintextSha256: hash(JSON.stringify(source)), calendar: accepted.calendar, bundle: result.bundle};
  const plain = Buffer.from(JSON.stringify(artifact));
  fs.writeFileSync(destination, seal(plain, key), {flag: 'wx', mode: 0o600});
  if (!unseal(fs.readFileSync(destination), key).equals(plain)) throw new Error('Preparation readback failed');
  console.log(JSON.stringify({prepared: true, fullSourceDigestVerified: true, sourceExportedAt: source.exportedAt,
    members: result.bundle.members.length, notes: result.bundle.notes.length, days: result.bundle.readDays.length}));
} finally {key.fill(0);}
