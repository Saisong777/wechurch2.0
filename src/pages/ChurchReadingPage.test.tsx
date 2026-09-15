// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChurchReadingPage from './ChurchReadingPage';
import type { ChurchReadingSummary } from '@/lib/churchReading';

const state = vi.hoisted(() => ({ data: undefined as ChurchReadingSummary | undefined, isLoading: false, isError: false, refetch: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state }));
vi.mock('@/components/layout/Header', () => ({ Header: () => <header>每日靈修</header> }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: () => <p>每日靈修 beta 測試中</p> }));
vi.mock('@/components/scripture/DevotionalNoteDialog', () => ({ DevotionalNoteDialog: ({ open }: { open: boolean }) => open ? <div role="dialog">個人筆記</div> : null }));
beforeEach(() => {
  sessionStorage.clear();
  state.isLoading = false; state.isError = false; state.refetch.mockReset();
  state.data = { id: 'published-day', date: '2026-09-12', planName: '教會課表', dayNumber: 43, scriptureReference: '以賽亞書 43:1-全', devotionalTitle: '今日已發佈標題', devotionalText: '今日已發佈短文', previewVerses: [], sourceStatus: 'church-schedule' };
});
afterEach(cleanup);
const show = () => render(<MemoryRouter><ChurchReadingPage /></MemoryRouter>);

it('renders published daily reading even when the legacy beta gate is closed', () => {
  show();
  expect(screen.getByText('今日已發佈短文')).toBeTruthy();
  expect(screen.queryByText(/beta 測試中/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '寫靈修筆記' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('個人筆記');
});

it('restores expanded scripture when the same history entry is revisited', () => {
  state.data!.previewVerses = Array.from({ length: 28 }, (_, i) => ({ verse: i + 1, text: `經文 ${i + 1}` }));
  const first = show();
  fireEvent.click(screen.getByRole('button', { name: '展開經文' }));
  first.unmount();
  show();
  expect(screen.getByTestId('daily-verse-28')).toBeTruthy();
});
it('keeps unpublished days unavailable instead of exposing a draft or fallback', () => {
  state.data = { ...state.data!, sourceStatus: 'unpublished', devotionalTitle: '這一天的靈修尚未發佈', devotionalText: '', previewVerses: [] };
  show();
  expect(screen.getByRole('heading', { name: '這一天的靈修尚未發佈' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '寫靈修筆記' })).toBeNull();
  expect(screen.queryByText('今日已發佈短文')).toBeNull();
  expect(screen.getByRole('link', { name: '閱讀聖經' })).toHaveAttribute('href', '/learn/bible');
});
it('keeps loading separate from unpublished and hides cached content on errors', () => {
  state.isLoading = true;
  const view = show();
  expect(screen.getByRole('status')).toHaveTextContent('正在載入教會靈修課表');
  expect(screen.queryByText('今日已發佈短文')).toBeNull();
  state.isLoading = false; state.isError = true;
  view.rerender(<MemoryRouter><ChurchReadingPage /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('暫時無法取得教會靈修課表');
  expect(screen.queryByText('今日已發佈短文')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
  expect(state.refetch).toHaveBeenCalledOnce();
});
it('previews two verses and expands or collapses the complete passage', () => {
  state.data!.previewVerses = Array.from({ length: 28 }, (_, index) => ({ verse: index + 1, text: `第 ${index + 1} 節經文` }));
  show();
  expect(screen.queryByTestId('daily-verse-28')).toBeNull();
  expect(screen.getByTestId('daily-verse-2')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: '展開經文' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeTruthy();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: '今日經文' }).querySelectorAll('[data-testid^="daily-verse-"]')).toHaveLength(28);
  expect(screen.getByTestId('daily-verse-28')).toHaveTextContent('第 28 節經文');
  expect(screen.queryByText(/在聖經中閱讀/)).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[0]);
  expect(screen.queryByTestId('daily-verse-28')).toBeNull();
  expect(screen.getByText('今日已發佈短文')).toBeTruthy();
});
it('collapses from the end and returns keyboard focus to the top control', () => {
  state.data!.previewVerses = Array.from({ length: 3 }, (_, index) => ({ verse: index + 1, text: `經文 ${index + 1}` }));
  show();
  const toggle = screen.getByRole('button', { name: '展開經文' });
  toggle.scrollIntoView = vi.fn();
  fireEvent.click(toggle);
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[1]);
  expect(toggle).toHaveFocus();
  expect(toggle.scrollIntoView).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('daily-verse-3')).toBeNull();
});
it('preserves expansion on background refresh but resets it for a different day', () => {
  state.data!.previewVerses = Array.from({ length: 3 }, (_, index) => ({ verse: index + 1, text: `經文 ${index + 1}` }));
  const view = show();
  fireEvent.click(screen.getByRole('button', { name: '展開經文' }));
  state.data = { ...state.data! };
  view.rerender(<MemoryRouter><ChurchReadingPage /></MemoryRouter>);
  expect(screen.getByTestId('daily-verse-3')).toBeTruthy();
  state.data = { ...state.data!, date: '2026-09-13' };
  view.rerender(<MemoryRouter><ChurchReadingPage /></MemoryRouter>);
  expect(screen.queryByTestId('daily-verse-3')).toBeNull();
});
it('does not add a toggle for a short or unavailable passage', () => {
  state.data!.previewVerses = [{ verse: 1, text: '短經文' }];
  const view = show();
  expect(screen.getByTestId('daily-verse-1')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '展開經文' })).toBeNull();
  state.data = { ...state.data!, previewVerses: [], scriptureStatus: 'unavailable' };
  view.rerender(<MemoryRouter><ChurchReadingPage /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: '展開經文' })).toBeNull();
});
it('expands manually supplied scripture without changing its text', () => {
  state.data!.scriptureText = '完整手動經文\n'.repeat(20);
  show();
  const content = screen.getByText(/完整手動經文/);
  expect(content).toHaveClass('line-clamp-4');
  fireEvent.click(screen.getByRole('button', { name: '展開經文' }));
  expect(content).not.toHaveClass('line-clamp-4');
  expect(content.textContent).toBe(state.data!.scriptureText);
});
it('offers scripture retry without hiding the devotional article', () => {
  state.data!.scriptureStatus = 'unavailable';
  show();
  expect(screen.getByText('今日已發佈短文')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '重新載入經文' }));
  expect(state.refetch).toHaveBeenCalledOnce();
});
