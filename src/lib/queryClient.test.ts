import { afterEach, expect, it, vi } from 'vitest';
import { apiRequest, ApiError, getQueryFn, queryClient } from './queryClient';

afterEach(() => { queryClient.clear(); vi.unstubAllGlobals(); });
it.each([false, 0, null])('sends valid falsy JSON payload %s', async value => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  await apiRequest('POST', '/api/test', value);
  expect(fetcher).toHaveBeenCalledWith('/api/test', expect.objectContaining({ body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' } }));
});
it('passes cancellation through to fetch', async () => {
  const controller = new AbortController();
  const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  await getQueryFn({ on401: 'throw' })({ queryKey: ['/api/test'], signal: controller.signal, client: queryClient, meta: undefined });
  expect(fetcher).toHaveBeenCalledWith('/api/test', expect.objectContaining({ signal: controller.signal }));
});
it('classifies retryable failures by status, not the first character of an error message', () => {
  const retry = queryClient.getDefaultOptions().queries!.retry;
  if (typeof retry !== 'function') throw new Error('Missing retry policy');
  expect(retry(0, new ApiError(403, 'forbidden'))).toBe(false);
  expect(retry(0, new ApiError(500, 'unavailable'))).toBe(true);
  expect(retry(0, new Error('4 network connections failed'))).toBe(true);
  expect(retry(0, new DOMException('cancelled', 'AbortError'))).toBe(false);
  expect(retry(2, new Error('offline'))).toBe(false);
});
