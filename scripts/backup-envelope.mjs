import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const magic=Buffer.from('WECHURCH-BACKUP-1\n');
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function seal(bytes,key) {
  if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('Backup key must contain exactly 32 bytes');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(magic);
  const content=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return Buffer.concat([magic,iv,cipher.getAuthTag(),content]);
}
export function unseal(bytes,key) {
  if(!Buffer.isBuffer(key)||key.length!==32||bytes.length<magic.length+28||!bytes.subarray(0,magic.length).equals(magic))throw new Error('Invalid encrypted backup');
  const offset=magic.length,decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(offset,offset+12));
  decipher.setAAD(magic);decipher.setAuthTag(bytes.subarray(offset+12,offset+28));
  return Buffer.concat([decipher.update(bytes.subarray(offset+28)),decipher.final()]);
}
export function readBackupKey(file,repo) {
  if(!file || !path.isAbsolute(file))throw new Error('Set WECHURCH_BACKUP_KEY_FILE to a protected key outside the repository');
  const real=fs.realpathSync(file),relative=path.relative(fs.realpathSync(repo),real),stat=fs.statSync(real);
  if(!relative.startsWith(`..${path.sep}`) && relative!=='..')throw new Error('Backup keys cannot be inside the repository');
  if(!stat.isFile()||(stat.mode&0o077)!==0)throw new Error('Backup key must be a private file (0600 or 0400)');
  const key=fs.readFileSync(real);
  if(key.length!==32)throw new Error('Backup key must be a 32-byte binary file');
  return key;
}
