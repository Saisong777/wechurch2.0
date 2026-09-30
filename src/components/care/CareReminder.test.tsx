// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { CareReminder } from './CareReminder';
afterEach(() => { cleanup(); vi.useRealTimers(); });
function Example() { const [date, setDate] = useState(''); return <CareReminder value={date} onChange={setDate} />; }
it('uses Taiwan calendar days for shortcuts across month and year boundaries', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-12-30T17:00:00Z'));
  render(<Example />);
  fireEvent.click(screen.getByRole('button', { name: '提醒我再關心' }));
  fireEvent.click(screen.getByRole('button', { name: '三天後' }));
  expect(screen.getByRole('button', { name: /2027-01-03 提醒我關心/ })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '一週後' }));
  expect(screen.getByRole('button', { name: /2027-01-07 提醒我關心/ })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '選日期' }));
  fireEvent.change(screen.getByLabelText('提醒日期'), { target: { value: '2027-02-01' } });
  expect(screen.getByRole('button', { name: /2027-02-01 提醒我關心/ })).toBeVisible();
});
