import { Router } from 'express';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import { actions } from './core.mjs';
import { releaseId } from '../../scripts/bible-study-assets.mjs';

const directory = path.resolve(process.env.BIBLE_STUDY_DIR || 'bible-study-data');
const available = () => fs.existsSync(path.join(directory, 'data/core.sqlite'));
let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (data: unknown) => void; reject: (error: Error & { status?: number }) => void; timer: ReturnType<typeof setTimeout> }>();
function stop() {
  const previous = worker;
  worker = undefined;
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(Object.assign(new Error('研經資料暫時無法讀取，請稍後重試。'), { status: 503 })); }
  pending.clear();
  void previous?.terminate();
}
function query(action: string, parameters: Record<string, string>): Promise<unknown> {
  if (pending.size >= 24) return Promise.reject(Object.assign(new Error('目前使用人數較多，請稍後重試。'), { status: 429 }));
  if (!worker) {
    const instance = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { directory }, execArgv: [] });
    worker = instance;
    instance.on('message', result => {
      const request = pending.get(result.id); if (!request) return;
      clearTimeout(request.timer); pending.delete(result.id);
      if (result.error) request.reject(Object.assign(new Error(result.error), { status: result.status }));
      else request.resolve(result.data);
      if (!pending.size) instance.unref();
    });
    instance.on('error', () => { if (worker === instance) stop(); });
    instance.on('exit', () => { if (worker === instance) stop(); });
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject, timer: setTimeout(stop, 15000) });
    worker!.ref(); worker!.postMessage({ id, action, query: parameters });
  });
}

export function bibleStudyRoutes() {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!['GET', 'HEAD'].includes(req.method)) { res.set('Allow', 'GET, HEAD').status(405).json({ error: '只接受讀取請求' }); return; }
    if (req.originalUrl.length > 2048) { res.status(414).json({ error: '查詢過長' }); return; }
    next();
  });
  router.get('/status', (_req, res) => res.json({ enabled: available(), releaseId }));
  router.get('/:action', async (req, res) => {
    if (!actions.includes(req.params.action)) { res.status(404).json({ error: '找不到此功能' }); return; }
    if (!available()) { res.status(503).json({ error: '研經資料尚未就緒' }); return; }
    const pairs = new URLSearchParams(req.originalUrl.split('?')[1] || '');
    const parameters: Record<string, string> = Object.create(null);
    const allowed = ['translation', 'book', 'chapter', 'verse', 'source', 'id', 'q', 'term', 'start', 'end'];
    for (const [key, value] of pairs) {
      if (!allowed.includes(key) || Object.hasOwn(parameters, key)) { res.status(400).json({ error: '查詢格式不正確' }); return; }
      parameters[key] = value;
    }
    try { res.json(await query(req.params.action, parameters)); }
    catch (error) { res.status((error as { status?: number }).status || 503).json({ error: (error as Error).message }); }
  });
  router.use((_req, res) => res.status(404).json({ error: '找不到此功能' }));
  return router;
}

export function bibleStudyCreditsRoutes() {
  const router = Router();
  router.get('/', (_req, res) => res.redirect('/learn/bible'));
  router.get(['/licenses', '/licenses.html'], (_req, res) => {
    if (!available()) { res.status(503).send('來源資料尚未就緒'); return; }
    res.type('html').send(fs.readFileSync(path.join(directory, 'web/licenses.html'), 'utf8').replace('href="/open/"', 'href="/learn/bible"'));
  });
  router.get('/style.css', (_req, res) => {
    if (!available()) { res.sendStatus(404); return; }
    res.sendFile(path.join(directory, 'web/style.css'));
  });
  router.use((_req, res) => res.sendStatus(404));
  return router;
}
