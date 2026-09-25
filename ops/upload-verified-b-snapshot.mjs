// Railway CLI v4.31.0 up protocol, with a longer timeout for a verified B snapshot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, root, target, verifyRemoteBibleAssets } from '../scripts/railway-staging.mjs';

const { app } = inspectStaging();
const release = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/railway-staging/release.json'), 'utf8'));
if (JSON.stringify(release.target) !== JSON.stringify(target)) throw new Error('Wrong release target');
const directory = fs.realpathSync(release.directory);
if (!directory.startsWith(path.join(root, 'artifacts/railway-staging/release-'))) throw new Error('Invalid snapshot directory');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'release-manifest.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (manifest.fingerprint !== release.fingerprint || hash(JSON.stringify(manifest.files)) !== manifest.fingerprint) throw new Error('Snapshot fingerprint mismatch');
for (const entry of manifest.files) {
  if (path.isAbsolute(entry.file) || entry.file.split('/').some(p => p === '..' || p === '.') || entry.file.startsWith('-')) throw new Error('Invalid snapshot path');
  const file = path.join(directory, entry.file);
  if (!fs.lstatSync(file).isFile() || hash(fs.readFileSync(file)) !== entry.sha256) throw new Error('Snapshot changed');
}
const assets = JSON.parse(fs.readFileSync(path.join(directory, 'bible-study-asset-manifest.json'), 'utf8'));
if (JSON.stringify(verifyRemoteBibleAssets(app.BIBLE_STUDY_DIR)) !== JSON.stringify(assets)) throw new Error('Reference assets differ');
const bytes = execFileSync('tar', ['-czf', '-', '-C', directory, 'release-manifest.json', 'bible-study-asset-manifest.json', ...manifest.files.map(f => f.file)], { maxBuffer: 32 * 1024 * 1024, env: { ...process.env, COPYFILE_DISABLE: '1' } });
const token = process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'), 'utf8')).user?.token;
if (!token) throw new Error('Railway login required');
const url = new URL(`https://backboard.railway.com/project/${target.project}/environment/${target.environment}/up`);
url.searchParams.set('serviceId', target.app);
url.searchParams.set('message', `B staging ${manifest.fingerprint.slice(0, 16)}`);
console.log(JSON.stringify({ uploadingVerifiedSnapshot: true, bytes: bytes.length, fingerprint: manifest.fingerprint }));
await new Promise((resolve, reject) => {
  const request = https.request(url, { method: 'POST', headers: {
    [process.env.RAILWAY_TOKEN ? 'project-access-token' : 'Authorization']: process.env.RAILWAY_TOKEN ? token : `Bearer ${token}`,
    'Content-Type': 'application/gzip', 'Content-Length': bytes.length,
  } }, response => {
    let body = '';
    response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
    response.on('end', () => {
      clearTimeout(deadline);
      if (response.statusCode !== 200) { reject(new Error(`Railway upload HTTP ${response.statusCode}`)); return; }
      try { const result = JSON.parse(body); console.log(JSON.stringify({ deploymentId: result.deploymentId, logsUrl: result.logsUrl })); resolve(); }
      catch { reject(new Error('Invalid Railway response; inspect deployment before retrying')); }
    });
  });
  const deadline = setTimeout(() => request.destroy(new Error('Upload deadline reached; inspect deployment before retrying')), 180000);
  request.on('error', error => { clearTimeout(deadline); reject(error); });
  request.end(bytes);
});
