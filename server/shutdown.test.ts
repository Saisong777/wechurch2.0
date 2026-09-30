import { expect, it, vi } from 'vitest';
import { drainServer } from './shutdown';

it('keeps the database available until in-flight HTTP requests finish', async () => {
  let finished: (error?: Error) => void = () => {};
  const pool = { end: vi.fn().mockResolvedValue(undefined) };
  const drained = drainServer({ close: callback => { finished = callback; } }, pool);
  expect(pool.end).not.toHaveBeenCalled();
  finished();
  await drained;
  expect(pool.end).toHaveBeenCalledOnce();
});

it('surfaces failures instead of reporting a successful shutdown', async () => {
  const pool = { end: vi.fn() };
  await expect(drainServer({ close: done => done(new Error('close failed')) }, pool)).rejects.toThrow('close failed');
  expect(pool.end).not.toHaveBeenCalled();
});
