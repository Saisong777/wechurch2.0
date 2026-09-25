// B-only transfer through Railway's authenticated terminal relay. No public URL.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import WebSocket from 'ws';
import { inspectStaging, root, target } from '../scripts/railway-staging.mjs';
import { verifyAssets, releaseId } from '../scripts/bible-study-assets.mjs';

const state = inspectStaging();
const source = path.join(root, 'bible-study-data');
const proof = verifyAssets(source);
const evidence = path.join(root, 'artifacts/railway-staging');
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const archive = path.join(evidence, `${releaseId}.tar.gz`);
if (!fs.existsSync(archive)) execFileSync('tar', ['-czf', archive, '--options', 'gzip:compression-level=1', '-C', source, 'SHA256SUMS', ...proof.files.map(f => f.file)], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
fs.chmodSync(archive, 0o600);
const bytes = fs.readFileSync(archive);
const digest = createHash('sha256').update(bytes).digest('hex');
const destination = `/data/.bible-study/${releaseId}`;
const verifier = fs.readFileSync(path.join(root, 'scripts/bible-study-assets.mjs'), 'utf8');
// The receiver writes only a new versioned reference directory, never member data.
const receiver = `
const fs=require('fs'), crypto=require('crypto'), cp=require('child_process');
if(process.env.RAILWAY_ENVIRONMENT_ID!==${JSON.stringify(target.environment)}||process.env.RAILWAY_SERVICE_ID!==${JSON.stringify(target.app)})throw Error('Wrong Railway target');
const base='/data/.bible-study', dest=${JSON.stringify(destination)}, temp=base+'/.incoming-'+${JSON.stringify(digest)};
fs.mkdirSync(base,{recursive:true,mode:0o700}); fs.chmodSync(base,0o700);
if(fs.existsSync(dest))throw Error('Version already installed; verify existing assets instead');
fs.mkdirSync(temp,{recursive:true,mode:0o700});
const file=temp+'/assets.tar.gz'; let count=fs.existsSync(file)?fs.statSync(file).size:0, line='';
if(count>${bytes.length}||(count!==${bytes.length}&&count%65536!==0))throw Error('Invalid partial transfer');
const fd=fs.openSync(file,fs.existsSync(file)?'r+':'w',0o600), hash=crypto.createHash('sha256');
const previous=Buffer.alloc(1048576);for(let pos=0;pos<count;){const n=fs.readSync(fd,previous,0,Math.min(previous.length,count-pos),pos);if(!n)throw Error('Truncated partial transfer');hash.update(previous.subarray(0,n));pos+=n;}
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{line+=chunk; let i; while((i=line.indexOf('\\n'))>=0){const packet=JSON.parse(line.slice(0,i));line=line.slice(i+1);
if(packet.finish){fs.closeSync(fd);if(count!==${bytes.length}||hash.digest('hex')!==${JSON.stringify(digest)})throw Error('Archive checksum mismatch');
cp.execFileSync('tar',['-xzf',file,'-C',temp]);
fs.writeFileSync(temp+'/verify.mjs',Buffer.from(${JSON.stringify(Buffer.from(verifier).toString('base64'))},'base64'),{mode:0o600});
const checked=JSON.parse(cp.execFileSync('node',[temp+'/verify.mjs','--verify',temp],{encoding:'utf8'}));
fs.unlinkSync(file);fs.unlinkSync(temp+'/verify.mjs');fs.renameSync(temp,dest);
console.log('WC_DONE '+JSON.stringify(checked));process.exit(0);
}
const data=Buffer.from(packet.data,'base64');if(packet.offset!==count||data.length>262144||count+data.length>${bytes.length})throw Error('Invalid transfer chunk');
fs.writeSync(fd,data,0,data.length,count);hash.update(data);count+=data.length;console.log('WC_ACK '+count);
}});console.log('WC_READY '+count);
`;
if (process.env.RAILWAY_ENV && process.env.RAILWAY_ENV !== 'production') throw new Error('Only official Railway API supported');
const token = process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'), 'utf8')).user?.token;
if (!token) throw new Error('Railway login required');
async function transfer() {
const socket = new WebSocket('wss://backboard.railway.com/relay', { handshakeTimeout: 30000, headers: {
  [process.env.RAILWAY_TOKEN ? 'project-access-token' : 'Authorization']: process.env.RAILWAY_TOKEN ? token : `Bearer ${token}`,
  'X-Railway-Project-Id': target.project, 'X-Railway-Environment-Id': target.environment, 'X-Railway-Service-Id': target.app,
  'X-Source': 'WeChurch-B-Asset-Transfer',
} });
const send = (type, payload) => socket.send(JSON.stringify({ type, payload }));
let started = false, output = '', offset = 0, sent = 0, reported = -1;
const chunkSize = 262144;
function next() {
  if (offset === bytes.length) { send('session_data', { data: JSON.stringify({ finish: true }) + '\n' }); return; }
  while (sent < bytes.length && sent - offset < 16 * chunkSize) {
    const chunk = bytes.subarray(sent, sent + chunkSize);
    send('session_data', { data: JSON.stringify({ offset: sent, data: chunk.toString('base64') }) + '\n' });
    sent += chunk.length;
  }
}
console.log(JSON.stringify({ transferring: true, bytes: bytes.length, destination, productionDeployment: state.productionDeployment }));
await new Promise((resolve, reject) => {
  const deadline = setTimeout(() => { socket.terminate(); reject(new Error('Transfer deadline reached; partial assets were not activated')); }, 30 * 60_000);
  const ping = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.ping(); }, 15000);
  const stop = error => { clearTimeout(deadline); clearInterval(ping); socket.close(); error ? reject(error) : resolve(); };
  socket.on('error', () => stop(Object.assign(new Error('Railway transfer connection failed'), { retryable: true })));
  socket.on('close', () => { clearTimeout(deadline); clearInterval(ping); reject(Object.assign(new Error('Transfer closed before verified completion'), { retryable: true })); });
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (process.env.WECHURCH_TRANSFER_DEBUG === '1' && message.type !== 'session_data') console.log('Relay:', message.type, message.payload?.message || '');
      if (message.type === 'welcome' && !started) {
        started = true;
        const code = `eval(Buffer.from('${Buffer.from(receiver).toString('base64')}','base64').toString())`;
        send('exec_command', { command: 'sh', args: ['-c', `stty -echo -icanon; exec node -e "${code}"`], env: {} });
      }
      if (message.type === 'error') throw new Error('Railway relay rejected transfer');
      if (message.type === 'session_data') {
        const data = message.payload.data;
        output += typeof data === 'string' ? data : Buffer.from(data.data || []).toString();
        let index;
        while ((index = output.indexOf('\n')) >= 0) {
          const line = output.slice(0, index).replace(/\r/g, ''); output = output.slice(index + 1);
          if (process.env.WECHURCH_TRANSFER_DEBUG === '1' && !line.startsWith('WC_ACK ')) console.log('Receiver:', line.slice(-200));
          const ready = /WC_READY (\d+)$/.exec(line);
          if (ready) {
            offset = sent = Number(ready[1]);
            if (offset > bytes.length || (offset !== bytes.length && offset % 65536 !== 0)) throw new Error('Invalid resume offset');
            next();
          }
          if (line.startsWith('WC_ACK ')) {
            const acknowledged = Number(line.slice(7));
            if (acknowledged !== Math.min(offset + chunkSize, bytes.length)) throw new Error('Transfer acknowledgement mismatch');
            offset = acknowledged;
            const percent = Math.floor(offset / bytes.length * 10) * 10;
            if (percent !== reported) { reported = percent; console.log(`Reference asset transfer ${percent}%`); }
            next();
          }
          if (line.startsWith('WC_DONE ')) {
            if (JSON.stringify(JSON.parse(line.slice(8))) !== JSON.stringify(proof)) throw new Error('Remote reference assets differ');
            const receipt = { verified: true, destination, environment: target.environment, ...proof };
            fs.writeFileSync(path.join(evidence, 'bible-volume.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
            console.log(JSON.stringify({ verified: true, destination, databaseHash: proof.databaseHash })); stop();
          }
          if (line.includes('Error:')) throw new Error('Receiver error: ' + line.slice(0, 180));
        }
        if (output.length > 100000) throw new Error('Unexpected terminal output');
      }
    } catch (error) { stop(error); }
  });
});
}
for (let attempt = 1; attempt <= 16; attempt++) {
  try { await transfer(); break; }
  catch (error) {
    if (!error.retryable || attempt === 16) throw error;
    console.log(`Relay disconnected; resuming verified partial transfer (attempt ${attempt + 1}/16)`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
