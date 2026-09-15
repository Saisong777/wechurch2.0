// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScriptureTTS } from './ScriptureTTS';

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) =>
    <select value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));
const synth = { speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() };
class Utterance {
  constructor(public text: string) {}
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('plays, pauses, resumes and stops device speech', () => {
  render(<ScriptureTTS text="測試經文" />);
  fireEvent.click(screen.getByRole('button', { name: '開始朗讀' }));
  expect(synth.speak).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '暫停朗讀' }));
  expect(synth.pause).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '繼續朗讀' }));
  expect(synth.resume).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '停止朗讀' }));
  expect(synth.cancel).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '開始朗讀' })).toBeEnabled();
});
it.each(['stop', 'unmount', 'new passage'])('cancels a delayed speed restart on %s', action => {
  const view = render(<ScriptureTTS text="第一段" />);
  fireEvent.click(screen.getByRole('button', { name: '開始朗讀' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '1.5' } });
  if (action === 'stop') fireEvent.click(screen.getByRole('button', { name: '停止朗讀' }));
  else if (action === 'unmount') view.unmount();
  else view.rerender(<ScriptureTTS text="第二段" />);
  act(() => vi.runAllTimers());
  expect(synth.speak).toHaveBeenCalledOnce();
});
it('ignores an old utterance callback after replacing the voice playback', () => {
  render(<ScriptureTTS text="測試經文" />);
  fireEvent.click(screen.getByRole('button', { name: '開始朗讀' }));
  const oldFinished = synth.speak.mock.calls[0][0].onend;
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '1.25' } });
  act(() => vi.runAllTimers());
  act(() => oldFinished());
  expect(screen.getByRole('button', { name: '暫停朗讀' })).toBeEnabled();
  expect(synth.speak.mock.calls[1][0].rate).toBe(1.25);
});
it('has no API-key input or external synthesis request', () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  render(<ScriptureTTS text="測試經文" compact label="朗讀" />);
  fireEvent.click(screen.getByRole('button', { name: '朗讀' }));
  fireEvent.click(screen.getByRole('button', { name: '開始朗讀' }));
  expect(document.querySelector('input[type=password]')).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
