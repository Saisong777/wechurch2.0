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
vi.mock('@/components/scripture/DevotionalNoteDialog', () => ({ DevotionalNoteDialog: ({ open, inline }: { open: boolean; inline?: boolean }) => open ? <section aria-label="個人筆記" data-inline={inline}><h2 tabIndex={-1}>個人筆記</h2></section> : null }));
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
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
  const note = screen.getByRole('region', { name: '個人筆記' });
  expect(note).toHaveAttribute('data-inline', 'true');
  expect(note.closest('main')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('returns to the same inline note without resetting the reading tab', () => {
  show();
  fireEvent.mouseDown(screen.getByRole('tab', { name: '靈修' }), { button: 0, ctrlKey: false });
  fireEvent.click(screen.getByRole('button', { name: '寫下今天的領受' }));
  const note = screen.getByRole('region', { name: '個人筆記' });
  const heading = screen.getByRole('heading', { name: '個人筆記' });
  heading.scrollIntoView = vi.fn();
  fireEvent.click(screen.getByRole('button', { name: '寫靈修筆記' }));
  expect(screen.getByRole('region', { name: '個人筆記' })).toBe(note);
  expect(heading).toHaveFocus();
  expect(heading.scrollIntoView).toHaveBeenCalledOnce();
  expect(screen.getByRole('tab', { name: '靈修' })).toHaveAttribute('aria-selected', 'true');
});

it('restores expanded scripture when the same history entry is revisited', () => {
  state.data!.previewVerses = Array.from({ length: 28 }, (_, i) => ({ verse: i + 1, text: `經文 ${i + 1}` }));
  const first = show();
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[0]);
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
it('opens the complete passage and allows a two-verse preview', () => {
  state.data!.previewVerses = Array.from({ length: 28 }, (_, index) => ({ verse: index + 1, text: `第 ${index + 1} 節經文` }));
  show();
  expect(screen.getByTestId('daily-verse-28')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[0]);
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
  const toggle = screen.getAllByRole('button', { name: '收起經文' })[0];
  toggle.scrollIntoView = vi.fn();
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[1]);
  expect(toggle).toHaveFocus();
  expect(toggle.scrollIntoView).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('daily-verse-3')).toBeNull();
});
it('preserves collapsed reading on refresh but opens a different day', () => {
  state.data!.previewVerses = Array.from({ length: 3 }, (_, index) => ({ verse: index + 1, text: `經文 ${index + 1}` }));
  const view = show();
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[0]);
  state.data = { ...state.data! };
  view.rerender(<MemoryRouter><ChurchReadingPage /></MemoryRouter>);
  expect(screen.queryByTestId('daily-verse-3')).toBeNull();
  state.data = { ...state.data!, date: '2026-09-13' };
  view.rerender(<MemoryRouter><ChurchReadingPage /></MemoryRouter>);
  expect(screen.getByTestId('daily-verse-3')).toBeTruthy();
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
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[0]);
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

it('separates scripture, devotion and prayer without changing their text', () => {
  state.data!.devotionalText = '前言保留\n\n真理導航：閱讀的領受\n\n生活練習：\n【愛神】安靜\n【愛人】關心\n\n今日禱告：禱告原文\n\n今日金句卡：金句原文';
  show();
  expect(screen.getByRole('tab', { name: '經文' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('禱告原文')).not.toBeVisible();
  fireEvent.mouseDown(screen.getByRole('tab', { name: '靈修' }), { button: 0, ctrlKey: false });
  expect(screen.getByText('前言保留')).toBeVisible();
  expect(screen.getByText('閱讀的領受')).toBeVisible();
  expect(screen.getByText('【愛神】安靜 【愛人】關心')).toBeVisible();
  expect(screen.getByText('禱告原文')).not.toBeVisible();
  fireEvent.mouseDown(screen.getByRole('tab', { name: '禱告' }), { button: 0, ctrlKey: false });
  expect(screen.getByText('禱告原文')).toBeVisible();
  expect(screen.getByText('金句原文')).toBeVisible();
  expect(screen.getByText('閱讀的領受')).not.toBeVisible();
});

it('keeps notes and group routes available and omits an empty prayer tab', () => {
  show();
  expect(screen.queryByRole('tab', { name: '禱告' })).toBeNull();
  expect(screen.getByRole('link', { name: '回看筆記' })).toHaveAttribute('href', '/learn/my-notes');
  expect(screen.getByRole('link', { name: '與小組一起讀經' })).toHaveAttribute('href', '/groups');
});

it('remembers the reading font size, resets it, and rejects invalid saved values', () => {
  localStorage.setItem('wechurch-devotion-font-size', '999');
  const first = show();
  const slider = screen.getByRole('slider', { name: '字級' });
  expect(slider).toHaveValue('20');
  fireEvent.change(slider, { target: { value: '26' } });
  expect(localStorage.getItem('wechurch-devotion-font-size')).toBe('26');
  expect(document.querySelector('article')).toHaveStyle('--reader-font-size: 26px');
  first.unmount();
  show();
  expect(screen.getByRole('slider', { name: '字級' })).toHaveValue('26');
  fireEvent.click(screen.getByRole('button', { name: '重設閱讀字級' }));
  expect(screen.getByRole('slider', { name: '字級' })).toHaveValue('20');
});

it('retains scripture expansion when switching reading tabs', () => {
  state.data!.previewVerses = Array.from({ length: 3 }, (_, index) => ({ verse: index + 1, text: `經文 ${index + 1}` }));
  show();
  fireEvent.click(screen.getAllByRole('button', { name: '收起經文' })[0]);
  fireEvent.mouseDown(screen.getByRole('tab', { name: '靈修' }), { button: 0, ctrlKey: false });
  fireEvent.mouseDown(screen.getByRole('tab', { name: '經文' }), { button: 0, ctrlKey: false });
  expect(screen.queryByTestId('daily-verse-3')).toBeNull();
  expect(screen.getByRole('button', { name: '展開經文' })).toHaveAttribute('aria-expanded', 'false');
});
