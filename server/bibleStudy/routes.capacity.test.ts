import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { expect, it, vi } from 'vitest';
import { bibleStudyRoutes } from './routes';

const state = vi.hoisted(() => ({ messages: [] as Array<{ id: number; action: string; query: Record<string, string> }>, workers: [] as EventEmitter[] }));
vi.mock('node:fs', () => ({ default: { existsSync: () => true } }));
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  return { Worker: class extends EventEmitter {
    constructor() { super(); state.workers.push(this); }
    postMessage(message: typeof state.messages[number]) { state.messages.push(message); }
    ref() {} unref() {} async terminate() { return 0; }
  } };
});
it('preserves the 24-worker-request bound, coalesces callers, and retries errors without caching them', async () => {
  const router = bibleStudyRoutes() as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }> } }> };
  const handle = router.stack.find(layer => layer.route?.path === '/:action')!.route!.stack[0].handle;
  const send = (action: string, query = '') => {
    const res = { code: 200, json: vi.fn(), set: vi.fn(), status: vi.fn() };
    res.set.mockReturnValue(res); res.status.mockImplementation((status: number) => { res.code = status; return res; });
    const promise = handle({ params: { action }, originalUrl: `/api/bible-study/${action}${query}` } as unknown as Request, res as unknown as Response);
    return { res, promise };
  };
  const first = send('info'); const same = send('info');
  const rest = Array.from({ length: 23 }, (_, i) => send('search', `?q=${i}`));
  const overflow = send('chapter', '?book=1'); await overflow.promise;
  expect(overflow.res.code).toBe(429); expect(overflow.res.set).toHaveBeenCalledWith('Retry-After', '1');
  expect(state.workers).toHaveLength(1); expect(state.messages).toHaveLength(24);
  for (const message of state.messages) state.workers[0].emit('message', { id: message.id, data: { action: message.action } });
  await Promise.all([first.promise, same.promise, ...rest.map(item => item.promise)]);
  expect(first.res.json).toHaveBeenCalledWith({ action: 'info' }); expect(same.res.json).toHaveBeenCalledWith({ action: 'info' });
  await send('info').promise; expect(state.messages).toHaveLength(24);
  const bad = send('search', '?q=bad'); await Promise.resolve(); await Promise.resolve();
  state.workers[0].emit('message', { id: state.messages.at(-1)!.id, error: 'invalid', status: 400 });
  await bad.promise; expect(bad.res.code).toBe(400);
  const retry = send('search', '?q=bad'); await Promise.resolve(); await Promise.resolve();
  expect(state.messages).toHaveLength(26);
  state.workers[0].emit('message', { id: state.messages.at(-1)!.id, data: [] }); await retry.promise;
  const invalid = send('info', '?book=1&book=2'); await invalid.promise; expect(invalid.res.code).toBe(400);
  const privateRequest = send('my-notes'); await privateRequest.promise; expect(privateRequest.res.code).toBe(404);
  expect(state.messages).toHaveLength(26);
});
