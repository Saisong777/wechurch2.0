import { afterEach, expect, it, vi } from 'vitest';
import { PublicReferenceCache } from './referenceCache';

afterEach(() => vi.useRealTimers());
it('coalesces identical public requests independent of parameter order', async () => {
  const cache = new PublicReferenceCache('release');
  let resolve!: (value: unknown) => void;
  const loader = vi.fn(() => new Promise(r => { resolve = r; }));
  const first = cache.load('chapter', { book: '1', chapter: '2' }, loader);
  const second = cache.load('chapter', { chapter: '2', book: '1' }, loader);
  await Promise.resolve(); expect(loader).toHaveBeenCalledOnce(); resolve({ verses: ['public'] });
  expect(await first).toEqual(await second);
  expect(await cache.load('chapter', { book: '1', chapter: '2' }, loader)).toEqual({ verses: ['public'] });
  expect(loader).toHaveBeenCalledOnce(); expect(cache.getStats().inflight).toBe(0);
});
it('expires after five minutes and separates actions, parameters and releases', async () => {
  vi.useFakeTimers(); const cache = new PublicReferenceCache('release'); const loader = vi.fn(async () => 1);
  await cache.load('info', {}, loader); vi.advanceTimersByTime(299999); await cache.load('info', {}, loader);
  expect(loader).toHaveBeenCalledTimes(1); vi.advanceTimersByTime(1); await cache.load('info', {}, loader);
  await cache.load('search', { q: 'a' }, loader); await cache.load('search', { q: 'b' }, loader);
  await new PublicReferenceCache('next-release').load('info', {}, loader); expect(loader).toHaveBeenCalledTimes(5);
});
it('never caches errors and refuses private/unknown actions', async () => {
  const cache = new PublicReferenceCache('release'); const fail = vi.fn(async () => { throw new Error('retry'); });
  await expect(cache.load('info', {}, fail)).rejects.toThrow('retry');
  await expect(cache.load('info', {}, fail)).rejects.toThrow('retry'); expect(fail).toHaveBeenCalledTimes(2);
  expect(cache.getStats()).toMatchObject({ size: 0, inflight: 0 });
  const loader = vi.fn(async () => 'private');
  await expect(cache.load('my-notes', {}, loader)).rejects.toMatchObject({ status: 400 }); expect(loader).not.toHaveBeenCalled();
});
it('caps unique inflight requests at 24 but allows identical waiters and cached hits', async () => {
  const cache = new PublicReferenceCache('release'); await cache.load('info', {}, async () => 'cached');
  const releases: Array<(value: unknown) => void> = [];
  const loader = vi.fn(() => new Promise(resolve => releases.push(resolve)));
  const requests = Array.from({ length: 24 }, (_, i) => cache.load('search', { q: String(i) }, loader));
  const same = cache.load('search', { q: '0' }, loader);
  await expect(cache.load('search', { q: 'overflow' }, loader)).rejects.toMatchObject({ status: 429 });
  expect(await cache.load('info', {}, loader)).toBe('cached'); expect(loader).toHaveBeenCalledTimes(24);
  releases.forEach(resolve => resolve('ok')); await Promise.all([...requests, same]); expect(cache.getStats().inflight).toBe(0);
});
it('bounds retained reference payloads and entry count', async () => {
  const cache = new PublicReferenceCache('release', 300, 1); const loader = vi.fn(async () => 'x'.repeat(1000));
  await cache.load('info', {}, loader); await cache.load('info', {}, loader); expect(loader).toHaveBeenCalledTimes(2);
  await cache.load('info', {}, async () => 1); await cache.load('search', { q: 'x' }, async () => 2);
  expect(cache.getStats()).toMatchObject({ size: 1, maxBytes: 300 }); expect(cache.getStats().bytes).toBeLessThanOrEqual(300);
  expect(new PublicReferenceCache('release').getStats()).toMatchObject({ maxBytes: 33554432, maxEntries: 512 });
});
