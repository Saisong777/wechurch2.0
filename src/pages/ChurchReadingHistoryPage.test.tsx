// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChurchReadingPage from './ChurchReadingPage';
import { taipeiToday, shiftDevotionDate } from '@shared/churchDevotion';
import { saveDevotionalNote } from '@/lib/saveDevotionalNote';

vi.mock('@/components/layout/Header', () => ({ Header: () => <header>每日靈修</header> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'history-owner' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/saveDevotionalNote', () => ({ saveDevotionalNote: vi.fn(), noteSaveMessage: () => '已同步儲存' }));
const clients: QueryClient[] = [];
const today = taipeiToday(), yesterday = shiftDevotionDate(today, -1), older = shiftDevotionDate(today, -2);
const summary = (date: string) => ({ id: date, date, planName: '教會課表', dayNumber: 3, scriptureReference: '詩篇 23', devotionalTitle: `${date} 的領受`, devotionalText: `${date} 的短文`, previewVerses: [], sourceStatus: 'church-schedule' });
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.mocked(saveDevotionalNote).mockReset();
  vi.mocked(saveDevotionalNote).mockImplementation(async (_, note) => ({ note: { ...note, id: 'saved-note' }, status: 'synced' }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.startsWith('/api/church-reading/today') ? summary(new URL(url, 'https://test').searchParams.get('date')!) : null })));
});
afterEach(() => { vi.useRealTimers(); cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.unstubAllGlobals(); });
function show(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const router = createMemoryRouter([{ path: '/church-reading', element: <ChurchReadingPage /> }], { initialEntries: [`/church-reading${search}`] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, client };
}
async function write() {
  fireEvent.click(await screen.findByRole('button', { name: '寫靈修筆記' }));
  fireEvent.change(await screen.findByRole('textbox', { name: '看見' }), { target: { value: '往日的筆記' } });
}
it('defaults to Taipei today, navigates by URL, and disables future navigation', async () => {
  const { router } = show();
  await screen.findByText(`${today} 的短文`);
  expect(screen.getByRole('button', { name: '後一天' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '前一天' }));
  await screen.findByText(`${yesterday} 的短文`);
  expect(router.state.location.search).toBe(`?date=${yesterday}`);
  expect(screen.getByRole('button', { name: '後一天' })).not.toBeDisabled();
  fireEvent.change(screen.getByLabelText('靈修日期'), { target: { value: older } });
  await screen.findByText(`${older} 的短文`);
  fireEvent.click(screen.getByRole('button', { name: '回到今天' }));
  await screen.findByText(`${today} 的短文`);
  expect(router.state.location.search).toBe(`?date=${today}`);
});
it('loads a dated deep link and carries the same day to the group', async () => {
  show(`?date=${older}`);
  await screen.findByText(`${older} 的短文`);
  expect(fetch).toHaveBeenCalledWith(`/api/church-reading/today?date=${older}`, expect.anything());
  expect(screen.getByRole('link', { name: '與小家一起讀經' })).toHaveAttribute('href', `/groups?entry=reading&view=reading&date=${older}`);
  fireEvent.mouseDown(screen.getByRole('tab', { name: '靈修' }), { button: 0, ctrlKey: false });
  expect(screen.getByRole('button', { name: '寫下這一天的領受' })).toBeTruthy();
});
it.each(['2026-02-30', '2200-01-01', shiftDevotionDate(today, 1)])('rejects invalid or future URL %s without fetching today', async date => {
  show(`?date=${date}`);
  expect(screen.getByRole('alert')).toHaveTextContent('請選擇今天或之前的有效日期');
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '回到今天' }));
  await screen.findByText(`${today} 的短文`);
});
it('protects unsaved text on date navigation and resets it after explicit discard, even with repeated scripture', async () => {
  const { router } = show(`?date=${yesterday}`);
  await write();
  fireEvent.click(screen.getByRole('button', { name: '前一天' }));
  fireEvent.click(await screen.findByRole('button', { name: '繼續編輯' }));
  expect(router.state.location.search).toBe(`?date=${yesterday}`);
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('往日的筆記');
  fireEvent.click(screen.getByRole('button', { name: '前一天' }));
  fireEvent.click(await screen.findByRole('button', { name: '放棄修改並離開' }));
  await screen.findByText(`${older} 的短文`);
  expect(screen.queryByRole('textbox', { name: '看見' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '寫靈修筆記' }));
  expect(await screen.findByRole('textbox', { name: '看見' })).toHaveValue('');
  expect(fetch).toHaveBeenCalledWith(`/api/devotional-notes/by-reference?ref=${encodeURIComponent('詩篇 23')}&date=${older}`, expect.anything());
});
it('saves the selected devotional date while keeping the actual writing time', async () => {
  show(`?date=${older}`); await write();
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  await waitFor(() => expect(saveDevotionalNote).toHaveBeenCalledOnce());
  expect(vi.mocked(saveDevotionalNote).mock.calls[0][1]).toMatchObject({ sourceDevotionalDate: older, verseReference: '詩篇 23', observation: '往日的筆記' });
  expect(vi.mocked(saveDevotionalNote).mock.calls[0][1].createdAt.slice(0, 10)).not.toBe(older);
});
it('keeps an unsaved editor and its original reference when a published schedule changes', async () => {
  const { client } = show(`?date=${older}`); await write();
  const key = client.getQueryCache().getAll().find(q => q.queryKey[0] === '/api/church-reading/today')!.queryKey;
  await act(async () => { client.setQueryData(key, { ...summary(older), scriptureReference: '詩篇 24' }); });
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('往日的筆記');
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  await waitFor(() => expect(saveDevotionalNote).toHaveBeenCalledOnce());
  expect(vi.mocked(saveDevotionalNote).mock.calls[0][1]).toMatchObject({ sourceDevotionalDate: older, verseReference: '詩篇 23' });
});
it('ignores a delayed result for an earlier selection after quickly changing dates', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(fetch).mockImplementation(async (url: string) => {
    const date = new URL(url, 'https://test').searchParams.get('date')!;
    if (date === yesterday) return new Promise(r => { resolve = r; }) as Promise<Response>;
    return { ok: true, json: async () => summary(date) } as Response;
  });
  show(`?date=${yesterday}`);
  fireEvent.click(screen.getByRole('button', { name: '前一天' }));
  await screen.findByText(`${older} 的短文`);
  await act(async () => { resolve({ ok: true, json: async () => summary(yesterday) }); });
  expect(screen.getByText(`${older} 的短文`)).toBeTruthy();
  expect(screen.queryByText(`${yesterday} 的短文`)).toBeNull();
});

it('does not replace an unpublished historical day with today content', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ...summary(older), sourceStatus: 'unpublished', devotionalTitle: '這一天的靈修尚未發佈', devotionalText: '' }) } as Response);
  show(`?date=${older}`);
  expect(await screen.findByRole('heading', { name: '這一天的靈修尚未發佈' })).toBeTruthy();
  expect(screen.queryByText(`${today} 的短文`)).toBeNull();
  expect(screen.queryByRole('button', { name: '寫靈修筆記' })).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps unsaved writing available when a background refresh fails', async () => {
  const { client } = show(`?date=${older}`); await write();
  vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
  await act(async () => { await client.refetchQueries({ queryKey: ['/api/church-reading/today'] }); });
  expect(await screen.findByRole('alert')).toHaveTextContent(`暫時無法取得 ${older} 的教會靈修課表`);
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('往日的筆記');
  expect(screen.queryByText(`${older} 的短文`)).toBeNull();
});
it('does not apply a server note from another date to the selected day', async () => {
  vi.mocked(fetch).mockImplementation(async (url: string) => ({ ok: true, json: async () => url.startsWith('/api/church-reading/today') ? summary(older) : { id: 'other-day', userId: 'history-owner', sourceDevotionalDate: yesterday, verseReference: '詩篇 23', observation: '別日筆記' } }) as Response);
  show(`?date=${older}`);
  fireEvent.click(await screen.findByRole('button', { name: '寫靈修筆記' }));
  expect(await screen.findByRole('textbox', { name: '看見' })).toHaveValue('');
  expect(screen.queryByText('別日筆記')).toBeNull();
});


it('refreshes Taipei calendar bounds at midnight without losing an open undated-route note', async () => {
  vi.setSystemTime(new Date('2031-01-31T15:59:00Z'));
  const { router } = show(); await write();
  expect(screen.getByLabelText('靈修日期')).toHaveValue('2031-01-31');
  expect(screen.getByRole('button', { name: '後一天' })).toBeDisabled();
  vi.setSystemTime(new Date('2031-01-31T16:01:00Z'));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(screen.getByLabelText('靈修日期')).toHaveAttribute('max', '2031-02-01');
  expect(screen.getByRole('button', { name: '後一天' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: '回到今天' })).not.toBeDisabled();
  expect(screen.getByText('正在補讀 2031-01-31 的靈修')).toBeTruthy();
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('往日的筆記');
  fireEvent.click(screen.getByRole('button', { name: '回到今天' }));
  fireEvent.click(await screen.findByRole('button', { name: '繼續編輯' }));
  expect(router.state.location.search).toBe('');
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('往日的筆記');
  fireEvent.click(screen.getByRole('button', { name: '回到今天' }));
  fireEvent.click(await screen.findByRole('button', { name: '放棄修改並離開' }));
  expect(await screen.findByText('2031-02-01 的短文')).toBeTruthy();
  expect(router.state.location.search).toBe('?date=2031-02-01');
});
