import { afterEach, expect, it, vi } from 'vitest';
import { BoundedCache } from './boundedCache';
import { SimpleCache, SessionCache } from './cache';

afterEach(() => vi.useRealTimers());
it('evicts the least recently used entry at the entry cap', () => {
  const cache = new BoundedCache<string>(1000, 2);
  cache.set('a', 'one', 1000); cache.set('b', 'two', 1000);
  expect(cache.get('a')).toBe('one'); cache.set('c', 'three', 1000);
  expect(cache.get('b')).toBeUndefined(); expect(cache.getStats().size).toBe(2);
});
it('bounds bytes including keys, rejects oversized values, and accounts for replacements', () => {
  const cache = new BoundedCache<string>(200, 10);
  cache.set('a', 'x'.repeat(70), 1000); cache.set('b', 'y'.repeat(70), 1000);
  expect(cache.get('a')).toBeUndefined(); expect(cache.getStats().bytes).toBeLessThanOrEqual(200);
  cache.set('b', 'z'.repeat(300), 1000); expect(cache.getStats().bytes).toBe(0);
  cache.set('k'.repeat(200), 'v', 1000); expect(cache.getStats().size).toBe(0);
  cache.set('a', 'a', 1000); cache.set('a', 'b', 1000);
  expect(cache.getStats().size).toBe(1); cache.clear(); expect(cache.getStats().bytes).toBe(0);
});
it('does not let callers grow or mutate retained entries', () => {
  const cache = new BoundedCache<{ value: string }>(200, 2);
  const value = { value: 'small' }; cache.set('a', value, 1000); value.value = 'x'.repeat(1000);
  const result = cache.get('a')!; result.value = 'changed';
  expect(cache.get('a')).toEqual({ value: 'small' });
});
it('expires exactly at TTL and does not retain unserializable values', () => {
  vi.useFakeTimers(); const cache = new BoundedCache<unknown>(1000, 2);
  cache.set('a', 'a', 1000); vi.advanceTimersByTime(1000);
  expect(cache.get('a')).toBeUndefined(); expect(cache.getStats().bytes).toBe(0);
  cache.set('fn', () => 1, 1000); expect(cache.getStats().size).toBe(0);
});
it('preserves seconds/ms defaults and pattern invalidation APIs', () => {
  vi.useFakeTimers(); const simple = new SimpleCache(5, 1000, 3); const session = new SessionCache(1000, 3);
  simple.set('prayers:one', 1); simple.set('other', 2); session.set('poll:one:actor', { id: 1 });
  vi.advanceTimersByTime(2000); expect(session.get('poll:one:actor')).toBeNull(); expect(simple.has('prayers:one')).toBe(true);
  expect(simple.invalidatePattern('prayers:')).toBe(1); expect(simple.get('other')).toBe(2);
  session.set('poll:two:actor', 1); session.set('another', 2); session.invalidate('poll:');
  expect(session.get('poll:two:actor')).toBeNull(); expect(session.get('another')).toBe(2);
  vi.advanceTimersByTime(3000); expect(simple.get('other')).toBeUndefined();
});
