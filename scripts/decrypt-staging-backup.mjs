import fs from 'node:fs';
import path from 'node:path';
import { root } from './railway-staging.mjs';
import { readBackupKey,unseal } from './backup-envelope.mjs';
const [input,output]=process.argv.slice(2);
if(process.argv.length!==4||!input||!output||!path.isAbsolute(input)||!path.isAbsolute(output))throw new Error('Usage: node scripts/decrypt-staging-backup.mjs /encrypted/file.enc /private/output');
const outputDirectory=fs.realpathSync(path.dirname(output));
const relative=path.relative(fs.realpathSync(root),outputDirectory);
if(!relative || (!relative.startsWith(`..${path.sep}`) && relative!=='..' && !path.isAbsolute(relative)))throw new Error('Plaintext backups must be restored outside the repository.');
if((fs.statSync(outputDirectory).mode & 0o077)!==0)throw new Error('The output directory must be owner-only (0700).');
const key=readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE,root);
try {
  // Authentication finishes before any plaintext file is created; never overwrite.
  const plain=unseal(fs.readFileSync(input),key);
  fs.writeFileSync(output,plain,{flag:'wx',mode:0o600});
  console.log('Decrypted archive written to the requested private location; no database restored.');
} finally { key.fill(0); }
