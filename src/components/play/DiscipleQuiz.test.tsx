// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DiscipleQuiz from './DiscipleQuiz';
import { PageScrollContext } from '@/contexts/PageScrollContext';
import { QUESTIONS } from '@/lib/discipleQuizData';
import { QUIZ_STORAGE_KEY, QUIZ_VERSION } from '@/lib/discipleQuiz';
const scroll = {to: vi.fn(), y: () => 0, listen: () => () => {}};
function show() { return render(<PageScrollContext.Provider value={scroll}><DiscipleQuiz/></PageScrollContext.Provider>); }
function resultDraft() { sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({version: QUIZ_VERSION, answers: Array(24).fill(0), current: 23, phase: 'result'})); }
beforeEach(() => { sessionStorage.clear(); scroll.to.mockClear(); Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: vi.fn().mockResolvedValue(undefined)}}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('requires an explicit next step, supports revising answers, and focuses the correct question', () => {
  show(); fireEvent.click(screen.getByRole('button', {name: /開始探索/}));
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0'); expect(screen.getByRole('button', {name: '下一題'})).toHaveProperty('disabled', true);
  fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getAllByRole('radio')[1]);
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe(QUESTIONS[0].text);
  fireEvent.click(screen.getByRole('button', {name: '下一題'})); expect(document.activeElement).toBe(screen.getByRole('heading', {level: 1}));
  expect(screen.getByRole('button', {name: '下一題'})).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', {name: '上一題'})); expect(screen.getAllByRole('radio')[1]).toHaveProperty('checked', true);
  expect(JSON.parse(sessionStorage.getItem(QUIZ_STORAGE_KEY)!).answers[0]).toBe(1); expect(scroll.to).toHaveBeenLastCalledWith(0);
});
it('never auto-advances a selected answer or schedules stale question callbacks', () => {
  vi.useFakeTimers(); show(); fireEvent.click(screen.getByRole('button', {name: /開始探索/})); fireEvent.click(screen.getAllByRole('radio')[0]); vi.runAllTimers();
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe(QUESTIONS[0].text);
});
it('resumes the actual saved answer and question after unmount', () => {
  const view = show(); fireEvent.click(screen.getByRole('button', {name: /開始探索/})); fireEvent.click(screen.getAllByRole('radio')[2]); fireEvent.click(screen.getByRole('button', {name: '下一題'})); view.unmount(); show();
  fireEvent.click(screen.getByRole('button', {name: /繼續測驗/})); expect(screen.getByRole('heading', {level: 1}).textContent).toBe(QUESTIONS[1].text);
  fireEvent.click(screen.getByRole('button', {name: '上一題'})); expect(screen.getAllByRole('radio')[2]).toHaveProperty('checked', true);
});
it('completes all 24 answers and shows all tied leaders without a forced primary', () => {
  show(); fireEvent.click(screen.getByRole('button', {name: /開始探索/}));
  for (let i = 0; i < 24; i++) { fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getByRole('button', {name: i === 23 ? /看看同行組合/ : '下一題'})); }
  expect(screen.getByRole('heading', {name: '你呈現了多種同行傾向'})).toBeTruthy(); expect(within(screen.getByRole('group', {name: '並列的同行傾向'})).getAllByRole('button')).toHaveLength(12);
  expect(screen.queryByRole('article')).toBeNull(); fireEvent.click(screen.getByRole('button', {name: /彼得・勇敢開路者/})); expect(screen.getByRole('article', {name: '彼得的同行反思'})).toBeTruthy();
  expect(screen.getByText(/每類有 8 次出現機會/)).toBeTruthy();
});
it('keeps the existing result on restart cancellation and clears it only on confirmation', () => {
  resultDraft(); show(); fireEvent.click(screen.getByRole('button', {name: '查看上次結果'})); fireEvent.click(screen.getByRole('button', {name: /再探索一次/}));
  fireEvent.click(screen.getByRole('button', {name: '保留本次進度'})); expect(screen.getByRole('heading', {name: '你呈現了多種同行傾向'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: /再探索一次/})); fireEvent.click(screen.getByRole('button', {name: '清除並重新開始'})); expect(screen.getByRole('heading', {level: 1}).textContent).toBe(QUESTIONS[0].text); expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0');
});
it('copies only after an explicit click, and provides text when clipboard is unavailable', async () => {
  resultDraft(); vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied')); show(); fireEvent.click(screen.getByRole('button', {name: '查看上次結果'}));
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', {name: /複製結果摘要/}));
  const field = await screen.findByRole('textbox', {name: '可複製的結果摘要'}); expect(field).toHaveProperty('readOnly', true); expect(navigator.clipboard.writeText).toHaveBeenCalledOnce(); expect(field).toHaveProperty('value', expect.stringContaining('這是情境反思遊戲'));
});
it('ignores corrupted drafts and keeps playing when tab storage is unavailable', () => {
  vi.stubGlobal('sessionStorage', {getItem: () => '{', setItem: vi.fn(() => { throw new Error('blocked'); })}); show();
  expect(screen.queryByRole('button', {name: /繼續測驗/})).toBeNull(); fireEvent.click(screen.getByRole('button', {name: /開始探索/})); expect(screen.getByRole('status').textContent).toContain('目前無法暫存');
  fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getByRole('button', {name: '下一題'})); expect(screen.getByRole('heading', {level: 1}).textContent).toBe(QUESTIONS[1].text);
});
