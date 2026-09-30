// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useUnifiedMembers } from './useUnifiedMembers';

const viewer = vi.hoisted(() => ({ current: { id: 'admin-one', role: 'admin' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: viewer.current }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const clients: QueryClient[] = [];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={clients[clients.length - 1]}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  viewer.current = { id: 'admin-one', role: 'admin' };
  clients.push(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.startsWith('/api/users')
      ? [{ id: 'u1', displayName: '測試帳戶', email: 'fixture@example.invalid', church: 'iM', createdAt: '2026-09-10' }]
      : [],
  })));
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.unstubAllGlobals(); });

describe('shared CRM loading', () => {
  it('loads only three requests for both statistics and list, with no request on filter changes', async () => {
    const { result, rerender } = renderHook(({ tab }: { tab: 'all' | 'potential' }) => useUnifiedMembers({ tab, church: 'iM' }), { wrapper, initialProps: { tab: 'all' } });
    await waitFor(() => expect(result.current.stats?.totalCount).toBe(1));
    expect(fetch).toHaveBeenCalledTimes(3);
    rerender({ tab: 'potential' });
    expect(result.current.data).toHaveLength(0);
    expect(result.current.allMembers).toHaveLength(1);
    expect(result.current.stats?.totalCount).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    await act(() => result.current.forceRefetch());
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it('does not fetch before authorization and church scope are ready', () => {
    renderHook(() => useUnifiedMembers({ tab: 'all', enabled: false }), { wrapper });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never shows old-church rows while the next scope loads', async () => {
    const { result, rerender } = renderHook(({ church }) => useUnifiedMembers({ tab: 'all', church }), { wrapper, initialProps: { church: 'iM' } });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    rerender({ church: 'another' });
    expect(result.current.data).toHaveLength(0);
    expect(result.current.stats).toBeUndefined();
  });
  it('separates cached results by viewer', async () => {
    const { result, rerender } = renderHook(() => useUnifiedMembers({ tab: 'all' }), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    viewer.current = { id: 'another-account', role: 'member' };
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    rerender();
    expect(result.current.data).toHaveLength(0);
  });
  it('surfaces an API failure instead of claiming an empty database', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    const { result } = renderHook(() => useUnifiedMembers({ tab: 'all' }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('沒有權限');
    expect(result.current.stats).toBeUndefined();
  });
});
