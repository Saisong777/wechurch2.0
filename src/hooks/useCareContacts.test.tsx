// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useCareContacts } from './useCareContacts';

const auth = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
let client: QueryClient;
const row = { id: 'contact', userId: 'owner', name: 'Test', need: '', nextAction: '', prayer: '', lastCaredAt: null, prayerCount: 0, createdAt: '2026-09-12' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  auth.user = { id: 'owner' }; auth.loading = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => response([row])));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });

it('signed-out users never load sample contacts or fetch private data', () => {
  auth.user = null;
  localStorage.setItem('wechurch_care_contacts_v1', JSON.stringify([row]));
  const { result } = renderHook(useCareContacts, { wrapper });
  expect(result.current.contacts).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
it('a server failure is visible, never replaced by local contacts', async () => {
  localStorage.setItem('wechurch_care_contacts_v1', JSON.stringify([row]));
  vi.mocked(fetch).mockResolvedValue(response({ error: 'Unavailable' }, 503));
  const { result } = renderHook(useCareContacts, { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.contacts).toEqual([]);
  expect(localStorage.getItem('wechurch_care_contacts_v1')).toBe(JSON.stringify([row]));
});
it('malformed responses fail visibly', async () => {
  vi.mocked(fetch).mockResolvedValue(response([{ name: 'Not a saved contact' }]));
  const { result } = renderHook(useCareContacts, { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
});
it('creation errors do not claim success or write a local copy', async () => {
  const { result } = renderHook(useCareContacts, { wrapper });
  await waitFor(() => expect(result.current.contacts).toHaveLength(1));
  vi.mocked(fetch).mockResolvedValue(response({ error: 'Failed' }, 500));
  const onError = vi.fn(), onSuccess = vi.fn();
  act(() => result.current.createContact({ name: 'New' }, { onError, onSuccess }));
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onSuccess).not.toHaveBeenCalled();
  expect(result.current.contacts).toEqual([row]);
  expect(localStorage.length).toBe(0);
});
it('a failed care action does not increment counts or mark a contact cared', async () => {
  const { result } = renderHook(useCareContacts, { wrapper });
  await waitFor(() => expect(result.current.contacts).toHaveLength(1));
  vi.mocked(fetch).mockResolvedValue(response({ error: 'Failed' }, 500));
  const onError = vi.fn();
  act(() => result.current.recordAction({ contactId: row.id, actionType: 'care' }, { onError }));
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(result.current.contacts[0].lastCaredAt).toBeNull();
  expect(result.current.contacts[0].prayerCount).toBe(0);
});
it('keeps account caches separate', async () => {
  const { result, rerender } = renderHook(useCareContacts, { wrapper });
  await waitFor(() => expect(result.current.contacts).toHaveLength(1));
  auth.user = { id: 'other' };
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  rerender();
  expect(result.current.contacts).toEqual([]);
});
it('uses saved server values after a successful action', async () => {
  const { result } = renderHook(useCareContacts, { wrapper });
  await waitFor(() => expect(result.current.contacts).toHaveLength(1));
  vi.mocked(fetch).mockImplementation(async (_url, options) => response(options?.method === 'POST' ? { id: 'action' } : [{ ...row, prayerCount: 3 }]));
  act(() => result.current.recordAction({ contactId: row.id, actionType: 'prayer' }));
  await waitFor(() => expect(result.current.contacts[0].prayerCount).toBe(3));
  expect(localStorage.length).toBe(0);
});
