// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppearanceProvider } from './AppearanceProvider';
import { AppearanceControl } from './AppearanceControl';

let systemDark = false;
const listeners = new Set<(event: { matches: boolean }) => void>();
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.documentElement.className = '';
  document.head.innerHTML = '<meta name="theme-color" content="#F8FAF9" />';
  systemDark = false;
  listeners.clear();
  vi.stubGlobal('matchMedia', () => ({
    matches: systemDark, media: '(prefers-color-scheme: dark)',
    addListener: (fn: (event: { matches: boolean }) => void) => listeners.add(fn),
    removeListener: (fn: (event: { matches: boolean }) => void) => listeners.delete(fn),
  }));
});
afterEach(() => { act(() => vi.runOnlyPendingTimers()); cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = () => render(<AppearanceProvider><AppearanceControl inline /><AppearanceControl /></AppearanceProvider>);
const select = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));

it('defaults to light and remembers an explicit dark choice across remounts', () => {
  const view = mount();
  expect(document.documentElement).toHaveClass('light');
  select('深色');
  expect(document.documentElement).toHaveClass('dark');
  expect(localStorage.getItem('wechurch-theme')).toBe('dark');
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#151819');
  expect(screen.getByRole('button', { name: '顯示模式：深色' })).toBeVisible();
  view.unmount();
  mount();
  expect(document.documentElement).toHaveClass('dark');
  select('明亮');
  expect(document.documentElement).toHaveClass('light');
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#F8FAF9');
});

it('only follows device changes when system is selected', () => {
  mount();
  select('跟隨系統');
  act(() => { systemDark = true; listeners.forEach(fn => fn({ matches: true })); });
  expect(document.documentElement).toHaveClass('dark');
  expect(localStorage.getItem('wechurch-theme')).toBe('system');
  select('明亮');
  act(() => listeners.forEach(fn => fn({ matches: true })));
  expect(document.documentElement).toHaveClass('light');
});

it('synchronizes the selection from another tab', () => {
  mount();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'wechurch-theme', newValue: 'dark' })));
  expect(document.documentElement).toHaveClass('dark');
  expect(screen.getByRole('radio', { name: '深色' })).toHaveAttribute('aria-checked', 'true');
});

it('still switches in memory when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  mount();
  select('深色');
  expect(document.documentElement).toHaveClass('dark');
});
