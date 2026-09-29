// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DevotionSchedule } from './DevotionSchedule';
import type { DevotionEntry } from '@shared/churchDevotion';

afterEach(cleanup);
const entry = (id: string, planName: string, date: string, status: 'draft' | 'published' = 'draft'): DevotionEntry => ({
  id, planName, date, status, dayNumber: 1, scriptureReference: '約翰福音 3:16', scriptureText: '',
  devotionalTitle: `短文 ${id}`, devotionalText: '原文保留', prayer: '', loveAction: '', version: 3, updatedAt: date,
});
const entries = [entry('b', '盼望之旅', '2026-10-01'), entry('a2', '一起讀約翰福音', '2026-09-30'), entry('a1', '一起讀約翰福音', '2026-09-29', 'published')];
function setup(searching = false, busy = false, initialSelected: string[] = []) {
  const edit = vi.fn();
  function Harness() {
    const [selected, onSelect] = useState(initialSelected);
    return <DevotionSchedule {...{ entries, selected, onSelect, searching, busy }} onEdit={edit} today="2026-09-29" />;
  }
  render(<Harness />);
  return edit;
}
it('groups exact plan names, sorts dates, and starts collapsed without changing source data', () => {
  const before = JSON.stringify(entries);
  setup();
  expect(screen.getByText('2 個主題 · 3 筆課程')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  const buttons = screen.getAllByRole('button', { name: /展開主題/ });
  expect(buttons[0]).toHaveAccessibleName('展開主題 一起讀約翰福音');
  expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(buttons[0]);
  const rows = within(screen.getByRole('table', { name: '一起讀約翰福音 每日課程' })).getAllByRole('row');
  expect(rows[1]).toHaveTextContent('2026-09-29');
  expect(rows[2]).toHaveTextContent('2026-09-30');
  expect(screen.getByText('今日課程')).toBeTruthy();
  expect(JSON.stringify(entries)).toBe(before);
});
it('selects a collapsed topic without expanding it or selecting other topics', () => {
  setup();
  fireEvent.click(screen.getByRole('checkbox', { name: '選取主題 一起讀約翰福音' }));
  expect(screen.getByText('已選 2')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: '選取主題 盼望之旅' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '選取目前所有課程' })).toBePartiallyChecked();
  expect(screen.queryByRole('table')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '展開主題 一起讀約翰福音' }));
  expect(screen.getByRole('checkbox', { name: '選取 2026-09-29' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '選取 2026-09-29' }));
  expect(screen.getByRole('checkbox', { name: '選取主題 一起讀約翰福音' })).toBePartiallyChecked();
  fireEvent.click(screen.getByRole('button', { name: '收合主題 一起讀約翰福音' }));
  expect(screen.getByText('已選 1')).toBeTruthy();
});
it('select-all includes collapsed filtered entries and preserves selections outside the passed scope', () => {
  setup(false, false, ['outside']);
  const all = screen.getByRole('checkbox', { name: '選取目前所有課程' });
  fireEvent.click(all);
  expect(all).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '選取主題 盼望之旅' }));
  expect(all).toBePartiallyChecked();
  expect(screen.getByRole('checkbox', { name: '選取主題 一起讀約翰福音' })).toBeChecked();
});
it('expands matching search results and allows manual collapse and expand-all', () => {
  setup(true);
  expect(screen.getAllByRole('table')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '收合主題 盼望之旅' }));
  expect(screen.getAllByRole('table')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '全部展開' }));
  expect(screen.getAllByRole('table')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '全部收合' }));
  expect(screen.queryByRole('table')).toBeNull();
});
it('passes the original id and version to the existing editor', () => {
  const edit = setup();
  fireEvent.click(screen.getByRole('button', { name: '全部展開' }));
  fireEvent.click(screen.getByRole('button', { name: '編輯 2026-09-29' }));
  expect(edit).toHaveBeenCalledExactlyOnceWith(entries[2]);
});
it('keeps disclosure available while preventing selection and editing during writes', () => {
  setup(false, true);
  fireEvent.click(screen.getByRole('button', { name: '全部展開' }));
  for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
  expect(screen.getByRole('button', { name: '編輯 2026-09-29' })).toBeDisabled();
});
it('shows an empty result without misleading select-all actions', () => {
  render(<DevotionSchedule entries={[]} selected={[]} onSelect={vi.fn()} onEdit={vi.fn()} today="2026-09-29" searching busy={false} />);
  expect(screen.getByText('沒有符合條件的課程。')).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
});
