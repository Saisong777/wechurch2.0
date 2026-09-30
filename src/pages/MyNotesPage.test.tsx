// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import MyNotesPage from './MyNotesPage';

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.signedIn ? { id: 'reader', email: 'reader@example.invalid' } : null, loading: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/scripture/DevotionalNoteDialog', () => ({ DevotionalNoteDialog: () => null }));
vi.mock('@/components/scripture/DevotionWallShareDialog', () => ({ DevotionWallShareDialog: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); auth.signedIn = true; });

it('shows a recoverable error rather than claiming the reader has no notes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['/api/im-reading-history', 'reader'], []);
  render(<QueryClientProvider client={client}><MemoryRouter><MyNotesPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('alert', { name: '筆記載入狀態' })).toHaveTextContent('暫時無法取得最新筆記');
  expect(screen.queryByText('還沒有靈修筆記')).toBeNull();
  expect(screen.getByRole('button', { name: '重新載入筆記' })).toBeEnabled();
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
  expect(screen.getByTestId('tab-devotional')).toHaveAttribute('data-state', 'active');
  expect(screen.getByText('今天的領受')).toBeVisible();
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
  const expand = screen.getByRole('button', { name: '展開筆記' });
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(expand);
  expect(expand).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText(/我的舊筆記/)).toBeVisible();
  fireEvent.click(screen.getByText(/我的舊筆記/));
  expect(screen.getByText(/我的舊筆記/)).toBeVisible();
  expect(expand).toHaveAttribute('aria-controls', 'note-content-imported');
  fireEvent.click(screen.getByRole('button', { name: '收合筆記' }));
  expect(screen.queryByText(/我的舊筆記/)).toBeNull();
  expect(screen.getByText('iM 舊讀經紀錄 · 1 天')).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox',{name:'搜尋筆記'}),{target:{value:'2026-07-01'}});
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
