// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import MyNotesPage from './MyNotesPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'reader', email: 'reader@example.invalid' }, loading: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/scripture/DevotionalNoteDialog', () => ({ DevotionalNoteDialog: () => null }));
vi.mock('@/components/scripture/DevotionWallShareDialog', () => ({ DevotionWallShareDialog: () => null }));
afterEach(cleanup);

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
  fireEvent.click(screen.getByTestId('card-devotional-note-imported'));
  expect(screen.getByText(/我的舊筆記/)).toBeVisible();
  expect(screen.getByText('iM 舊讀經紀錄 · 1 天')).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox',{name:'搜尋筆記'}),{target:{value:'2026-07-01'}});
  expect(screen.getByTestId('card-devotional-note-imported')).toBeVisible();
  client.clear();
});
