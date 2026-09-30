// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ReadingNavigation } from './ReadingNavigation';

const state = vi.hoisted(() => ({ disabled: [] as string[], loading: false, error: null as string | null }));
vi.mock('@/hooks/useFeatureToggles', () => ({ useFeatureToggles: () => ({
  ...state, isFeatureEnabled: (key: string) => !state.disabled.includes(key),
}) }));
afterEach(() => { cleanup(); state.disabled = []; state.loading = false; state.error = null; });

it.each([
  ['/learn/bible?book=43&chapter=3#v16', '讀聖經'],
  ['/bible?book=1', '讀聖經'],
  ['/learn/church-reading', '每日靈修'],
  ['/learn/my-notes', '我的筆記'],
])('marks the current reading surface without resetting %s', (route, label) => {
  render(<MemoryRouter initialEntries={[route]}><ReadingNavigation /></MemoryRouter>);
  expect(screen.getAllByRole('link')).toHaveLength(3);
  expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', route);
});

it('switches directly between reading, devotion and notes', () => {
  render(<MemoryRouter initialEntries={['/learn/bible']}><ReadingNavigation /></MemoryRouter>);
  for (const label of ['每日靈修', '我的筆記', '讀聖經']) {
    fireEvent.click(screen.getByRole('link', { name: label }));
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
  expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === '/learn')).toBe(false);
});

it('hides the disabled Bible entry', () => {
  state.disabled = ['bible_reading'];
  render(<MemoryRouter><ReadingNavigation /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: '讀聖經' })).toBeNull();
  expect(screen.getAllByRole('link')).toHaveLength(2);
});

it.each(['loading', 'error', 'disabled'])('does not expose reading navigation in %s state', mode => {
  if (mode === 'loading') state.loading = true;
  if (mode === 'error') state.error = 'network';
  if (mode === 'disabled') state.disabled = ['we_learn'];
  render(<MemoryRouter><ReadingNavigation /></MemoryRouter>);
  expect(screen.queryByRole('navigation')).toBeNull();
});
