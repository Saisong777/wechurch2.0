import { Router, type RequestHandler, type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { batchInput, devotionDate, devotionFields, devotionInput, importRowsInput, normalizeDevotionRows } from '../shared/churchDevotion';
import { batchChurchDevotions, churchDevotionHistory, commitDevotionImport, DevotionConflict, listChurchDevotions, previewDevotionImport, restoreChurchDevotion, saveChurchDevotion } from './churchDevotionRepository';
import { devotionWorkbook, MAX_DEVOTION_FILE_BYTES, readDevotionFile, readGoogleDevotionSheet } from './churchDevotionFile';

export function churchDevotionRoutes(requireManager: RequestHandler) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DEVOTION_FILE_BYTES, files: 1, fields: 0 } });
  router.use(requireManager);
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    // Admin uploads use cookies; reject cross-origin form submissions as well as JSON writes.
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      let invalidOrigin = false;
      if (origin) {
        try { invalidOrigin = new URL(origin).host !== req.get('host'); }
        catch { invalidOrigin = true; }
      }
      if (req.get('sec-fetch-site') === 'cross-site' || invalidOrigin) return void res.status(403).json({ error: '不接受跨網站寫入。' });
    }
    res.locals.actor = (req as unknown as { legacyUserId: string }).legacyUserId;
    next();
  });
  router.get('/', async (req, res) => {
    const { from, to } = z.object({ from: devotionDate, to: devotionDate }).parse(req.query);
    if (from > to) return void res.status(400).json({ error: '結束日期須晚於開始日期。' });
    res.json(await listChurchDevotions(from, to));
  });
  router.get('/template.csv', (_req, res) => {
    res.type('text/csv; charset=utf-8').attachment('church-devotion-template.csv').send('\uFEFF' + devotionFields.map(field => field.label).join(',') + '\r\n');
  });
  router.get('/template.xlsx', async (_req, res) => {
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('church-devotion-template.xlsx').send(Buffer.from(await devotionWorkbook()));
  });
  router.get('/export.xlsx', async (req, res) => {
    const { from, to } = z.object({ from: devotionDate, to: devotionDate }).parse(req.query);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('church-devotions.xlsx').send(Buffer.from(await devotionWorkbook(await listChurchDevotions(from, to))));
  });
  router.post('/read', upload.single('file'), async (req, res) => {
    if (!req.file) return void res.status(400).json({ error: '請選擇檔案。' });
    try { res.json({ sheets: await readDevotionFile(req.file.buffer, req.file.originalname) }); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : '無法讀取檔案' }); }
  });
  router.post('/google-sheet', async (req, res) => {
    const { url } = z.object({ url: z.string().url().max(2000) }).parse(req.body);
    try { res.json({ sheets: await readGoogleDevotionSheet(url) }); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : '無法讀取 Google Sheets' }); }
  });
  router.post('/preview', async (req, res) => {
    const { rows, mapping, mode, headerRow, options } = importRowsInput.parse(req.body);
    const { entries, issues } = normalizeDevotionRows(rows, mapping, headerRow, options);
    if (issues.length) return void res.json({ issues, rows: [] });
    res.json(await previewDevotionImport(res.locals.actor, entries, mode));
  });
  router.post('/imports/:id/commit', async (req, res) => {
    res.json(await commitDevotionImport(res.locals.actor, z.string().uuid().parse(req.params.id)));
  });
  router.post('/batch', async (req, res) => {
    const data = batchInput.parse(req.body);
    res.json(await batchChurchDevotions(res.locals.actor, data.items.map(({ id, version }) => ({ id, version })), data.action, data.days));
  });
  router.post('/', async (req, res) => res.status(201).json(await saveChurchDevotion(res.locals.actor, devotionInput.parse(req.body))));
  router.put('/:id', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { version } = z.object({ version: z.number().int().positive() }).parse(req.body);
    res.json(await saveChurchDevotion(res.locals.actor, devotionInput.parse(req.body), id, version));
  });
  router.get('/:id/history', async (req, res) => res.json(await churchDevotionHistory(z.string().uuid().parse(req.params.id))));
  router.post('/:id/restore', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = z.object({ historyId: z.string().uuid(), version: z.number().int().positive() }).strict().parse(req.body);
    res.json(await restoreChurchDevotion(res.locals.actor, id, input.historyId, input.version));
  });
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError) return void res.status(400).json({ error: error.issues.map(issue => `${issue.path.join('.')}：${issue.message}`).join('；') });
    if (error instanceof DevotionConflict) return void res.status(409).json({ error: error.message });
    if (error instanceof multer.MulterError) return void res.status(400).json({ error: '上傳失敗，一次限一個 3 MB 以內的檔案。' });
    console.error('[church-devotions]', error);
    res.status(503).json({ error: '靈修資料庫暫時無法使用，請稍後重試。' });
  };
  router.use(handleError);
  return router;
}
