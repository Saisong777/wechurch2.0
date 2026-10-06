// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useAccessControlAdmin } from './useAccessControlAdmin';

const state = vi.hoisted(() => ({ actor: 'admin-one', scope: 'church-one' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: state.actor } }) }));
vi.mock('@/contexts/ChurchContext', () => ({ useChurchScopeKey: () => state.scope }));
let client: QueryClient;
let names: string[];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  state.actor = 'admin-one'; state.scope = 'church-one';
  names = ['同工', '全職同工'];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ roles: names.map(name => ({ name })) }) })));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });

it('shares one snapshot between both forms and refreshes both after a template edit', async () => {
  const { result } = renderHook(() => ({ memberForm: useAccessControlAdmin(true), accessForm: useAccessControlAdmin(true) }), { wrapper });
  await waitFor(() => expect(result.current.memberForm.data?.roles.map(role => role.name)).toEqual(names));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith('/api/access-control', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
  names = ['同工', '全職同工', '行政同工'];
  await act(() => result.current.accessForm.refetch());
  await waitFor(() => expect(result.current.memberForm.data?.roles.map(role => role.name)).toEqual(names));
  expect(result.current.accessForm.data).toBe(result.current.memberForm.data);
});

it('does not request the restricted snapshot for a non-director', () => {
  renderHook(() => useAccessControlAdmin(false), { wrapper });
  expect(fetch).not.toHaveBeenCalled();
});

it('does not carry another church or account catalog into a new context', async () => {
  const { result, rerender } = renderHook(() => useAccessControlAdmin(true), { wrapper });
  await waitFor(() => expect(result.current.data?.roles).toHaveLength(2));
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  state.scope = 'church-two'; rerender();
  expect(result.current.data).toBeUndefined();
  state.actor = 'admin-two'; rerender();
  expect(result.current.data).toBeUndefined();
});

it('reports snapshot failures instead of treating them as an empty catalog', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: '沒有權限' }) } as Response);
  const { result } = renderHook(() => useAccessControlAdmin(true), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.message).toBe('沒有權限');
});
