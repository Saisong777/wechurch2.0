import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSource, inspectSource, sha256, createSourceRequest } from './im-bible-migration.mjs';
import { readBackupKey, seal, unseal } from './backup-envelope.mjs';

const repo = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));

async function main() {
  const [planFile, sourceCommit, output] = process.argv.slice(2);
  if (!planFile || !output || !path.isAbsolute(output) || !/^[a-f0-9]{40}$/.test(sourceCommit || '')) {
    throw new Error('Usage: node scripts/export-im-bible.mjs PLAN_HTML SOURCE_COMMIT /private/path/capture.enc (short-lived OAuth access token on stdin)');
  }
  const parent = fs.realpathSync(path.dirname(output));
  const relative = path.relative(repo, parent);
  if (!relative.startsWith(`..${path.sep}`) && relative !== '..') throw new Error('Export must be outside the repository');
  const destination = path.join(parent, path.basename(output));
  if (fs.existsSync(destination)) throw new Error('Refusing to overwrite an existing export');
  const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, repo);
  const planSource = fs.readFileSync(planFile, 'utf8');
  if (process.stdin.isTTY) throw new Error('Pipe a short-lived OAuth token on stdin; do not paste it into arguments or chat');
  let token = '';
  for await (const chunk of process.stdin) {
    token += chunk.toString();
    if (token.length > 16384) throw new Error('Invalid token input');
  }
  token = token.trim();
  if (!token || /\s/.test(token)) throw new Error('Invalid token input');
  const request = createSourceRequest(token);
  const snapshot = await captureSource({ request, planSource, sourceCommit });
  const bytes = Buffer.from(JSON.stringify(snapshot));
  const encrypted = seal(bytes, key);
  if (!unseal(encrypted, key).equals(bytes)) throw new Error('Encryption verification failed');
  fs.writeFileSync(destination, encrypted, { flag: 'wx', mode: 0o600 });
  if (!unseal(fs.readFileSync(destination), key).equals(bytes)) throw new Error('Backup readback failed');
  console.log(JSON.stringify({ encrypted: true, ciphertextSha256: sha256(encrypted), ...inspectSource(snapshot) }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
