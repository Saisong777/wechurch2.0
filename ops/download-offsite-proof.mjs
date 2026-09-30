import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {execFileSync} from 'node:child_process';
import {hash} from '../scripts/backup-envelope.mjs';
import {root} from '../scripts/railway-staging.mjs';

process.umask(0o077);
if (process.stdin.isTTY) execFileSync('stty', ['-echo'], {stdio: ['inherit', 'ignore', 'ignore']});
const destination = fs.realpathSync(process.env.WECHURCH_OFFSITE_READBACK_DIR || '');
if (!path.relative(root, destination).startsWith('../') || (fs.statSync(destination).mode & 0o077)) throw new Error('Private download directory required');
const receiptFile = path.join(destination, 'offsite-readback.json');
const receipt = fs.existsSync(receiptFile) ? JSON.parse(fs.readFileSync(receiptFile)).files : [];
if (!Array.isArray(receipt)) throw new Error('Invalid existing download receipt');
for await (const line of readline.createInterface({input: process.stdin})) {
  if (line === 'finish') break;
  try {
    const job = JSON.parse(line), url = new URL(job.url);
    if (!/^[a-z0-9.-]+\.oaiusercontent\.com$/.test(url.hostname) || url.protocol !== 'https:' ||
      !/^[a-z0-9.-]+$/.test(job.name) || !/^[a-f0-9]{64}$/.test(job.sha256) || !Number.isSafeInteger(job.bytes) || job.bytes > 100*1024*1024) throw new Error('Invalid bounded connector download');
    const response = await fetch(url, {signal: AbortSignal.timeout(120000)});
    if (!response.ok) throw new Error('Download unavailable');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== job.bytes || hash(bytes) !== job.sha256) throw new Error('Offsite content differs');
    const file = path.join(destination, job.name);
    fs.writeFileSync(file, bytes, {flag: 'wx', mode: 0o600});
    if (hash(fs.readFileSync(file)) !== job.sha256) throw new Error('Readback differs');
    receipt.push({name: job.name, sha256: job.sha256, bytes: job.bytes, driveId: job.driveId});
    fs.writeFileSync(receiptFile, JSON.stringify({verified: true, files: receipt, at: new Date().toISOString()}, null, 2), {mode: 0o600});
    console.log(JSON.stringify({verified: job.name, bytes: bytes.length}));
  } catch {
    console.error('Offsite readback stopped; download addresses and encrypted contents are not logged.');
    process.exitCode = 1;
    break;
  }
}
