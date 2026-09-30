// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ReadingPreferencesControl, ReadingPreferencesProvider, parseReading, readingKey, textSizes, useReadingPreferences } from './ReadingPreferences';

beforeEach(() => { localStorage.clear(); document.documentElement.style.fontSize = ''; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function mount() {
  const view = render(<ReadingPreferencesProvider><ReadingPreferencesControl inline /></ReadingPreferencesProvider>);
  fireEvent.click(screen.getByText('文字大小與字型'));
  return view;
}
it('uses readable defaults and persists size and font through remount', () => {
  const view = mount();
  expect(document.documentElement.style.fontSize).toBe('112.5%');
  fireEvent.click(screen.getByRole('radio', { name: '特大' }));
  fireEvent.click(screen.getByRole('radio', { name: '閱讀宋體' }));
  expect(document.documentElement.style.fontSize).toBe('150%');
  expect(document.documentElement.dataset.readingFont).toBe('serif');
  view.unmount(); mount();
  expect(screen.getByRole('radio', { name: '特大' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '閱讀宋體' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '恢復預設文字' }));
  expect(JSON.parse(localStorage.getItem(readingKey)!)).toEqual({ size: 'standard', font: 'sans' });
});
it('offers every size including twice the default text size', () => {
  mount();
  for (const size of textSizes) {
    fireEvent.click(screen.getByRole('radio', { name: size.label }));
    expect(document.documentElement.style.fontSize).toBe(`${size.percent}%`);
  }
  expect(textSizes.at(-1)!.percent / textSizes[1].percent).toBe(2);
});
it('updates layout subscribers immediately when the reading size changes', () => {
  function MemberLayout() {
    const { preferences } = useReadingPreferences();
    return <output data-testid="member-layout">{['extra', 'maximum'].includes(preferences.size) ? 'cards' : 'table'}</output>;
  }
  render(<ReadingPreferencesProvider><ReadingPreferencesControl inline /><MemberLayout /></ReadingPreferencesProvider>);
  expect(screen.getByTestId('member-layout')).toHaveTextContent('table');
  fireEvent.click(screen.getByRole('radio', { name: '特大' }));
  expect(screen.getByTestId('member-layout')).toHaveTextContent('cards');
  fireEvent.click(screen.getByRole('button', { name: '恢復預設文字' }));
  expect(screen.getByTestId('member-layout')).toHaveTextContent('table');
});
it('rejects invalid saved settings and still works without storage access', () => {
  expect(parseReading('null')).toEqual({ size: 'standard', font: 'sans' });
  expect(parseReading('{"size":"__proto__","font":"url(https://invalid)"}')).toEqual({ size: 'standard', font: 'sans' });
  expect(parseReading('broken')).toEqual({ size: 'standard', font: 'sans' });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
  mount(); fireEvent.click(screen.getByRole('radio', { name: '大' }));
  expect(document.documentElement.style.fontSize).toBe('125%');
});
it('synchronizes settings and storage clearing across tabs', () => {
  mount();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: readingKey, newValue: JSON.stringify({ size: 'maximum', font: 'serif' }) })));
  expect(screen.getByRole('radio', { name: '最大' })).toBeChecked();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(screen.getByRole('radio', { name: '標準' })).toBeChecked();
});
it('applies the same validated settings before React starts', () => {
  const script = readFileSync('public/theme-init.js', 'utf8');
  for (const saved of [null, 'broken', 'null', '{"size":"constructor"}', ...textSizes.map(s => JSON.stringify({ size: s.value, font: 'serif' }))]) {
    const html = { classList: { add: vi.fn() }, style: {} as Record<string,string>, dataset: {} as Record<string,string> };
    runInNewContext(script, { document: { documentElement: html, querySelector: () => ({ setAttribute: vi.fn() }) }, localStorage: { getItem: (key: string) => key === readingKey ? saved : null }, window: {} });
    const expected = parseReading(saved);
    expect(html.style.fontSize).toBe(`${textSizes.find(s => s.value === expected.size)!.percent}%`);
    expect(html.dataset.readingFont).toBe(expected.font);
  }
});
