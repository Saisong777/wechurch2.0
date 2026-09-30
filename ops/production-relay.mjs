import fs from 'node:fs';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import {hash} from '../scripts/backup-envelope.mjs';
import {assertReplacementTarget} from './production-replacement-policy.mjs';

export async function sendReplacementFile(state, kind, bytes, afterReceive) {
  assertReplacementTarget(state, state[kind], kind);
  if (!Buffer.isBuffer(bytes) || bytes.length > 512 * 1024 * 1024) throw new Error('Invalid bounded transfer');
  const token = JSON.parse(fs.readFileSync(`${os.homedir()}/.railway/config.json`)).user?.token;
  const tag = randomUUID().replaceAll('-', '');
  const destination = `/tmp/wechurch-replacement-${tag}`;
  const encoded = bytes.toString('base64');
  const receiver = `set -eu
test "$RAILWAY_ENVIRONMENT_ID" = '${state.environment}'
test "$RAILWAY_SERVICE_ID" = '${state[kind]}'
umask 077
trap 'rm -f ${destination} ${destination}.b64' EXIT
stty -echo -icanon -icrnl
printf 'WC_READY\\n'
head -c ${encoded.length} > ${destination}.b64
base64 -d ${destination}.b64 > ${destination}
test "$(sha256sum ${destination} | cut -d ' ' -f 1)" = '${hash(bytes)}'
${afterReceive(destination)}
printf '\\nWC_DONE\\n'
`;
  await new Promise((resolve, reject) => {
    const socket = new WebSocket('wss://backboard.railway.com/relay', {handshakeTimeout: 30000,
      headers: {Authorization: `Bearer ${token}`, 'X-Railway-Project-Id': state.project,
        'X-Railway-Environment-Id': state.environment, 'X-Railway-Service-Id': state[kind],
        'X-Source': 'WeChurch-Production-Replacement'}});
    let started = false, transfer = false, completed = false, output = '', lastCheck = '';
    const deadline = setTimeout(() => finish(new Error('Replacement transfer timeout; inspect before retrying')), 30 * 60000);
    const ping = setInterval(() => {if (socket.readyState === WebSocket.OPEN) socket.ping();}, 15000);
    const send = (type, payload) => socket.send(JSON.stringify({type, payload}));
    function finish(error) {
      if (completed) return;
      completed = true; clearTimeout(deadline); clearInterval(ping); socket.close();
      error ? reject(error) : resolve();
    }
    async function pump() {
      try {
        for (let offset = 0; offset < encoded.length; offset += 65536) {
          while (socket.bufferedAmount > 4 * 1024 * 1024) {
            if (completed) return;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          if (socket.readyState !== WebSocket.OPEN) throw new Error('Relay disconnected');
          send('session_data', {data: encoded.slice(offset, offset + 65536)});
        }
      } catch {finish(new Error('Replacement file transport failed'));}
    }
    socket.on('error', () => finish(new Error('Railway relay connection failed')));
    socket.on('close', () => {if (!completed) finish(new Error('Relay closed before verified completion'));});
    socket.on('message', raw => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'welcome' && !started) {
          started = true;
          send('exec_command', {command: 'sh', args: ['-c', receiver], env: {}});
        }
        if (message.type === 'error') throw new Error('Relay rejected operation');
        if (message.type === 'session_data') {
          const data = message.payload.data;
          output += typeof data === 'string' ? data : Buffer.from(data.data || []).toString();
          const checks = [...output.matchAll(/WC_CHECK ([a-z_]+)\r?\n/g)];
          if (checks.length) lastCheck = checks.at(-1)[1];
          if (!transfer && /WC_READY\r?\n/.test(output)) {transfer = true; void pump();}
          if (/WC_DONE\r?\n/.test(output)) finish();
          if (/AssertionError|Error:|not found|Permission denied/.test(output)) finish(Object.assign(new Error('Replacement receiver rejected verification; private output is not logged'), {check: lastCheck}));
          if (output.length > 65536) output = output.slice(-32768);
        }
      } catch {finish(new Error('Replacement receiver failed; payload and secrets are not logged'));}
    });
  });
}
