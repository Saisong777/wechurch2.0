// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useDevotionalNotes } from './useDevotionalNotes';
import { upsertLocalDevotionalNote, type LocalDevotionalNote } from '@/lib/localDevotionalNotes';

const note = (id: string, userId = 'reader') => ({ id, userId, verseReference: '約翰福音 1:1', updatedAt: '2026-09-29T00:00:00Z', syncStatus: 'pending' } as LocalDevotionalNote);
const clients: QueryClient[] = [];
function mount(userId = 'reader') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(({ owner }) => useDevotionalNotes(owner), { wrapper, initialProps: { owner: userId } }) };
}
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); localStorage.clear(); vi.unstubAllGlobals(); });

it('retains remote notes on a failed refresh and recovers on retry', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([note('remote')]))).mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify([note('updated')])));
  vi.stubGlobal('fetch', fetcher);
  const { result, client } = mount();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  act(() => upsertLocalDevotionalNote(note('draft'), 'reader'));
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data.map(n => n.id)).toEqual(expect.arrayContaining(['remote', 'draft']));
  expect(client.getQueryData(['/api/devotional-notes', 'reader'])).toEqual([note('remote')]);
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.isError).toBe(false));
  expect(result.current.data.map(n => n.id)).toEqual(expect.arrayContaining(['updated', 'draft']));
});

it.each([401, 503])('does not turn initial %s into successful empty results', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
  upsertLocalDevotionalNote(note('mine'), 'reader');
  upsertLocalDevotionalNote(note('other', 'other'), 'other');
  const { result, rerender } = mount();
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data.map(n => n.id)).toEqual(['mine']);
  rerender({ owner: 'other' });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data.map(n => n.id)).toEqual(['other']);
  rerender({ owner: '' });
  expect(result.current.data).toEqual([]);
});

it('rejects malformed success payloads instead of clearing notes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"unavailable"}')));
  const { result } = mount();
  await waitFor(() => expect(result.current.isError).toBe(true));
});
