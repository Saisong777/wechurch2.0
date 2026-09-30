// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReadingScrollRestoration } from './ReadingScrollRestoration';

let y = 0;
let maxY = 10000;
let resize: () => void;
beforeEach(() => {
  vi.useFakeTimers(); y = 0; maxY = 10000;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  vi.stubGlobal('scrollTo', vi.fn((options: ScrollToOptions) => { y = Math.min(maxY, options.top ?? 0); }));
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function flush() { act(() => { vi.advanceTimersByTime(25); }); }
function show() {
  function Controls() { const navigate = useNavigate(); return <><Link to="/share">切換</Link><button onClick={() => navigate(-1)}>返回</button></>; }
  render(<MemoryRouter initialEntries={['/learn/church-reading']}><ReadingScrollRestoration /><Controls /></MemoryRouter>);
  flush();
}

it('opens new routes at the top and returns to the recorded reading position', () => {
  show(); y = 700; fireEvent.scroll(window);
  // A shorter next page can clamp scrollY before effect cleanup runs.
  y = 0;
  fireEvent.click(screen.getByRole('link')); flush();
  expect(y).toBe(0);
  fireEvent.click(screen.getByRole('button')); flush();
  expect(y).toBe(700);
});

it('waits for lazy content to become tall enough, without overriding a user scroll', () => {
  show(); y = 1200; fireEvent.scroll(window);
  fireEvent.click(screen.getByRole('link')); flush();
  maxY = 100;
  fireEvent.click(screen.getByRole('button')); flush();
  expect(y).toBe(100);
  maxY = 2000; resize(); flush();
  expect(y).toBe(1200);
  fireEvent.click(screen.getByRole('link')); flush();
  maxY = 100; fireEvent.click(screen.getByRole('button')); flush();
  fireEvent.touchStart(window); y = 50; fireEvent.scroll(window);
  maxY = 2000; resize(); flush();
  expect(y).toBe(50);
});
