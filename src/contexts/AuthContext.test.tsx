// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { queryClient } from '@/lib/queryClient';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
afterEach(() => { cleanup(); queryClient.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('ignores an old session response that arrives after login to another account', async () => {
  const old = deferred<Response>();
  const fetcher = vi.fn().mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({ id: 'new-user', email: 'new@example.test' }));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await act(async () => { expect((await result.current.signIn('new@example.test', 'test')).error).toBeNull(); });
  expect(result.current.user?.id).toBe('new-user');
  await act(async () => old.resolve(response({ id: 'old-user', email: 'old@example.test' })));
  expect(result.current.user?.id).toBe('new-user');
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});

it('ignores stale JSON parsing that completes after the new session', async () => {
  const oldBody = deferred<unknown>();
  const json = vi.fn().mockReturnValue(oldBody.promise);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json })
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({ id: 'new', email: null })));
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(json).toHaveBeenCalled());
  await act(async () => { await result.current.signIn('test@example.test', 'test'); });
  await act(async () => oldBody.resolve({ id: 'old', email: null }));
  expect(result.current.user?.id).toBe('new');
});

it.each(['signIn', 'signUp'] as const)('does not report %s success when the session cannot be confirmed', async method => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({}, 401))
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({}, 503)));
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { expect((await result.current[method]('test@example.test', 'test')).error).toBeInstanceOf(Error); });
  expect(result.current.user).toBeNull();
});

it('aborts session refresh on unmount', () => {
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal('fetch', fetcher);
  const { unmount } = renderHook(useAuth, { wrapper: AuthProvider });
  unmount();
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});

it('clears private query data when switching accounts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ id: 'old', email: null }))
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({ id: 'new', email: null })));
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.user?.id).toBe('old'));
  queryClient.setQueryData(['/api/private'], 'old account data');
  await act(async () => { await result.current.signIn('new@example.test', 'test'); });
  expect(queryClient.getQueryData(['/api/private'])).toBeUndefined();
});
