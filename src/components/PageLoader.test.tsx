// @vitest-environment jsdom
import { Suspense, lazy } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { freshPageUrl, PageLoader } from './PageLoader';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('offers recovery after 15 seconds for a never-settling page import', async () => {
  const Pending = lazy(() => new Promise<never>(() => {}));
  render(<Suspense fallback={<PageLoader />}><Pending /></Suspense>);
  expect(screen.getByRole('status')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('button', { name: '重新載入' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '回首頁' }).getAttribute('href')).toBe('/');
});

it('allows a late import to recover without forcing a reload or clearing user data', async () => {
  let finish!: (value: { default: () => JSX.Element }) => void;
  const Page = lazy(() => new Promise<{ default: () => JSX.Element }>(resolve => { finish = resolve; }));
  render(<Suspense fallback={<PageLoader />}><Page /></Suspense>);
  await act(() => vi.advanceTimersByTimeAsync(15000));
  await act(async () => finish({ default: () => <p>頁面已載入</p> }));
  expect(screen.getByText('頁面已載入')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('cleans up the timer when navigating away', () => {
  const view = render(<PageLoader />);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('bypasses the document cache while keeping the route, query and anchor', () => {
  const url = new URL(freshPageUrl('https://example.test/learn/bible?book=43&_reload=old#v3'));
  expect(url.pathname).toBe('/learn/bible');
  expect(url.searchParams.get('book')).toBe('43');
  expect(url.hash).toBe('#v3');
  expect(url.searchParams.getAll('_reload')).toHaveLength(1);
  expect(url.searchParams.get('_reload')).not.toBe('old');
});
