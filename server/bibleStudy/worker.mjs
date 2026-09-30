import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import { createReader } from './core.mjs';
import { verifyAssets } from '../../scripts/bible-study-assets.mjs';

verifyAssets(workerData.directory);
const reader = createReader(path.join(workerData.directory, 'data/core.sqlite'));
parentPort.on('message', ({ id, action, query }) => {
  try { parentPort.postMessage({ id, data: reader.query(action, query) }); }
  catch (error) { parentPort.postMessage({ id, status: error.status || 503, error: error.status ? error.message : '研經資料暫時無法讀取，請稍後重試。' }); }
});
