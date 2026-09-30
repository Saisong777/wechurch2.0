// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MyNotesPage from './MyNotesPage';
import { journalPositionKey } from '@/lib/noteJournal';

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.signedIn ? { id: 'reader', email: 'reader@example.invalid' } : null, loading: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/scripture/DevotionalNoteDialog', () => ({ DevotionalNoteDialog: ({ inline, onOpenChange }: { inline: boolean; onOpenChange: (open: boolean) => void }) => <section aria-label="編輯筆記正文"><span>{inline ? '同頁編輯' : '彈窗編輯'}</span><button onClick={() => onOpenChange(false)}>收起筆記</button></section> }));
vi.mock('@/components/scripture/DevotionWallShareDialog', () => ({ DevotionWallShareDialog: () => null }));
beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); auth.signedIn = true; });

function openDirectory() { fireEvent.click(screen.getByRole('button', { name: '目錄／搜尋' })); }
function openDelete() {
  fireEvent.keyDown(screen.getByRole('button', { name: '筆記選單' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: '刪除筆記' }));
}

function showDeletableNote(id = '00000000-0000-4000-8000-000000000001') {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } } });
  client.setQueryData(['/api/devotional-notes', 'reader'], [{ id, userId: 'reader', version: 3, verseReference: '測試經文', readingPlanId: null, observation: '保留到確認', updatedAt: '2026-09-30T00:00:00Z' }]);
  client.setQueryData(['/api/im-reading-history', 'reader'], []);
  render(<QueryClientProvider client={client}><MemoryRouter><MyNotesPage /></MemoryRouter></QueryClientProvider>);
  return { client, id };
}

it('offers deletion without expanding and cancel never writes', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const { client } = showDeletableNote();
  openDelete();
  expect(screen.getByRole('alertdialog')).toHaveTextContent('讀經打卡不受影響');
  expect(screen.getByRole('alertdialog')).toHaveTextContent('相關分享也會撤回');
  fireEvent.click(screen.getByRole('button', { name: '保留筆記' }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText('測試經文')).toBeVisible();
  client.clear();
});

it('deletes only after confirmation with the current version and updates the list', async () => {
  const fetch = vi.fn().mockImplementation(async (_url, init) => new Response(JSON.stringify(init?.method === 'DELETE' ? { ok: true } : []), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  const { client, id } = showDeletableNote();
  openDelete();
  fireEvent.click(screen.getByRole('button', { name: '確定刪除' }));
  await waitFor(() => expect(screen.queryByTestId(`card-devotional-note-${id}`)).toBeNull());
  expect(fetch).toHaveBeenCalledWith(`/api/devotional-notes/${id}`, expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ version: 3 }), credentials: 'include' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  client.clear();
});

it.each([503, 409])('keeps the note and confirmation visible when deletion returns %s', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
  const { client, id } = showDeletableNote();
  openDelete();
  fireEvent.click(screen.getByRole('button', { name: '確定刪除' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(status === 409 ? '筆記已更新' : '未能完成操作');
  expect(screen.getByTestId(`card-devotional-note-${id}`)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保留筆記' })).toBeEnabled();
  client.clear();
});

it('removes a device-only draft without sending a server deletion', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  const id = 'local-devotional-test';
  localStorage.setItem('wechurch_devotional_notes_v2:reader', JSON.stringify([{ id, userId: 'reader', verseReference: '測試經文', readingPlanId: null, updatedAt: '2026-09-30T00:00:00Z', syncStatus: 'pending' }]));
  const { client } = showDeletableNote(id);
  openDelete();
  expect(screen.getByRole('alertdialog')).toHaveTextContent('已同步到雲端的筆記不受影響');
  fireEvent.click(screen.getByRole('button', { name: '確定刪除' }));
  await waitFor(() => expect(screen.queryByTestId(`card-devotional-note-${id}`)).toBeNull());
  expect(JSON.parse(localStorage.getItem('wechurch_devotional_notes_v2:reader') || '[]')).toEqual([]);
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  client.clear();
});

it('shows a recoverable error rather than claiming the reader has no notes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['/api/im-reading-history', 'reader'], []);
  render(<QueryClientProvider client={client}><MemoryRouter><MyNotesPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('alert', { name: '筆記載入狀態' })).toHaveTextContent('暫時無法取得最新筆記');
  expect(screen.queryByText('還沒有靈修筆記')).toBeNull();
  expect(screen.getByRole('button', { name: '重新載入筆記' })).toBeEnabled();
  openDirectory();
  expect(screen.getByTestId('button-export-notes')).toHaveTextContent('匯出目前可用筆記');
  client.clear();
});

it('starts with daily notes and filters display without losing the source notes', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const notes = [
    { id: 'first', userId: 'reader', verseReference: '約翰福音 1:1', readingPlanId: null, titlePhrase: '今天的領受', observation: '平安', updatedAt: '2026-09-13T00:00:00Z' },
    { id: 'second', userId: 'reader', verseReference: '詩篇 23:1', readingPlanId: null, titlePhrase: '安靜等候', observation: '等候', updatedAt: '2026-09-12T00:00:00Z' },
  ];
  client.setQueryData(['/api/devotional-notes', 'reader'], notes);
  client.setQueryData(['/api/notebook', 'reader@example.invalid'], []);
  client.setQueryData(['/api/im-reading-history', 'reader'], []);
  render(<QueryClientProvider client={client}><MemoryRouter><MyNotesPage /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText('今天的領受')).toBeVisible();
  expect(screen.getByText('平安')).toBeVisible();
  expect(screen.queryByText('安靜等候')).toBeNull();
  openDirectory();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜尋筆記' }), { target: { value: '等候' } });
  expect(screen.queryByText('今天的領受')).toBeNull();
  expect(screen.getByText('安靜等候')).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜尋筆記' }), { target: { value: '沒有符合' } });
  expect(screen.getByRole('status')).toHaveTextContent('找到 0 則');
  expect(client.getQueryData(['/api/devotional-notes', 'reader'])).toEqual(notes);
  client.clear();
});

it('shows imported reading dates, original notes and private reading history', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['/api/devotional-notes', 'reader'], [{
    id:'imported', userId:'reader', verseReference:'約翰福音 1', readingPlanId:null,
    observation:'  我的舊筆記\n保留原文  ', updatedAt:'2026-09-25T00:00:00Z',
    sourceDevotionalDate:'2026-07-01', sourceLabel:'iM 讀經 App',
  }]);
  client.setQueryData(['/api/notebook', 'reader@example.invalid'], []);
  client.setQueryData(['/api/im-reading-history', 'reader'], [{id:'day',date:'2026-07-01',reference:'約翰福音 1',completed:true}]);
  render(<QueryClientProvider client={client}><MemoryRouter><MyNotesPage /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText('iM 讀經 App · 讀經日期')).toBeVisible();
  expect(screen.getByText('2026年7月1日')).toBeVisible();
  expect(screen.queryByText('2026年9月25日')).toBeNull();
  expect(screen.queryByRole('button', { name: '展開筆記' })).toBeNull();
  expect(screen.getByText(/我的舊筆記/)).toBeVisible();
  fireEvent.click(screen.getByText(/我的舊筆記/));
  expect(screen.getByText(/我的舊筆記/)).toBeVisible();
  expect(screen.getByText(/我的舊筆記/).textContent).toBe('  我的舊筆記\n保留原文  ');
  openDirectory();
  expect(screen.getByText('iM 舊讀經紀錄 · 1 天')).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox',{name:'搜尋筆記'}),{target:{value:'2026-07-01'}});
  fireEvent.click(screen.getByRole('button', { name: /2026年7月1日 約翰福音 1/ }));
  expect(screen.getByTestId('card-devotional-note-imported')).toBeVisible();
  client.clear();
});

it('provides a direct start action when the reader has no notes', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(['/api/devotional-notes', 'reader'], []);
  client.setQueryData(['/api/im-reading-history', 'reader'], []);
  render(<QueryClientProvider client={client}><MemoryRouter><MyNotesPage /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText('還沒有靈修筆記')).toBeVisible();
  expect(screen.getByRole('link', { name: '開始今日靈修' })).toHaveAttribute('href', '/learn/church-reading');
  expect(screen.getByRole('link', { name: '小家靈修分享' })).toHaveAttribute('href', '/groups?view=note');
  client.clear();
});

it('returns to notes after login instead of losing the destination', async () => {
  auth.signedIn = false;
  const Location = () => { const location = useLocation(); return <output>{location.pathname + location.search}</output>; };
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/learn/my-notes']}><MyNotesPage /><Location /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('/login?returnTo=%2Flearn%2Fmy-notes')).toBeInTheDocument();
  client.clear();
});

function showJournal() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['/api/devotional-notes', 'reader'], [
    { id: 'empty', userId: 'reader', verseReference: '空白打卡', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'new', userId: 'reader', verseReference: '詩篇 23:1', observation: '  今天的看見\n第二段  ', coreInsightNote: '{"GOD_ATTRIBUTE":"恩典","PROMISE":"同行"}', actionPlan: '關心身旁的人', updatedAt: '2026-09-30T00:00:00Z' },
    { id: 'plan', userId: 'reader', verseReference: '約翰福音 3:16', observation: '昨天讀經計畫', readingPlanId: 'plan-one', updatedAt: '2026-09-29T00:00:00Z' },
    { id: 'imported-old', userId: 'reader', verseReference: '創世記 1:1', observation: '舊 App 的領受', sourceDevotionalDate: '2026-07-01', updatedAt: '2026-09-30T10:00:00Z' },
  ]);
  client.setQueryData(['/api/im-reading-history', 'reader'], []);
  const view = render(<QueryClientProvider client={client}><MemoryRouter><MyNotesPage /></MemoryRouter></QueryClientProvider>);
  return { client, ...view };
}

it('reads the latest nonempty note in full, with quiet headings and no completion badges', () => {
  const { client } = showJournal();
  expect(screen.getByRole('heading', { name: '看見' })).toBeVisible();
  expect(screen.getByText(/今天的看見/).textContent).toBe('  今天的看見\n第二段  ');
  expect(screen.getByText(/恩典/).textContent).toBe('恩典\n同行');
  expect(screen.queryByText('空白打卡')).toBeNull();
  expect(screen.queryByText('3/3')).toBeNull();
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(screen.queryByText('昨天讀經計畫')).toBeNull();
  client.clear();
});

it('reads both note sources consecutively and keeps month/search filters when returning to the directory', () => {
  const { client } = showJournal();
  fireEvent.click(screen.getByRole('button', { name: /上一篇/ }));
  expect(screen.getByText('昨天讀經計畫')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /下一篇/ }));
  expect(screen.getByText(/今天的看見/)).toBeVisible();
  openDirectory();
  fireEvent.change(screen.getByRole('combobox', { name: '月份' }), { target: { value: '2026-07' } });
  fireEvent.change(screen.getByRole('searchbox', { name: '搜尋筆記' }), { target: { value: '舊 App' } });
  fireEvent.click(screen.getByRole('button', { name: /2026年7月1日 創世記 1:1/ }));
  expect(screen.getByText('舊 App 的領受')).toBeVisible();
  openDirectory();
  expect(screen.getByRole('combobox', { name: '月份' })).toHaveValue('2026-07');
  expect(screen.getByRole('searchbox')).toHaveValue('舊 App');
  client.clear();
});

it('resumes this member chapter and scroll position but ignores another member position', async () => {
  localStorage.setItem(journalPositionKey('other'), JSON.stringify({ noteId: 'new', y: 999 }));
  localStorage.setItem(journalPositionKey('reader'), JSON.stringify({ noteId: 'plan', y: 321 }));
  const { client } = showJournal();
  expect(screen.getByText('昨天讀經計畫')).toBeVisible();
  await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 321, behavior: 'instant' }));
  fireEvent(window, new Event('pagehide'));
  expect(JSON.parse(localStorage.getItem(journalPositionKey('reader'))!)).toEqual({ noteId: 'plan', y: 321 });
  client.clear();
});

it('keeps empty records manageable in the directory without treating them as reading chapters', () => {
  const { client } = showJournal();
  openDirectory();
  fireEvent.click(screen.getByRole('button', { name: /空白打卡/ }));
  expect(screen.getByText('這篇尚未寫下心得。')).toBeVisible();
  expect(screen.getByRole('button', { name: '編輯筆記' })).toBeEnabled();
  openDelete();
  expect(screen.getByRole('alertdialog')).toBeVisible();
  client.clear();
});

it('uses the same page editor and prevents chapter switches while editing', () => {
  const { client } = showJournal();
  fireEvent.click(screen.getByRole('button', { name: '編輯筆記' }));
  expect(screen.getByText('同頁編輯')).toBeVisible();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: '目錄／搜尋' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /上一篇/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '收起筆記' }));
  expect(screen.getByRole('button', { name: /上一篇/ })).toBeEnabled();
  client.clear();
});
