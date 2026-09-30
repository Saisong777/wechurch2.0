// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CreatePrayerDialog } from './CreatePrayerDialog';

const state = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
vi.mock('@/hooks/usePrayerWall', async importOriginal => ({ ...await importOriginal<typeof import('@/hooks/usePrayerWall')>(), useCreatePrayer: () => state }));
afterEach(cleanup);

it('keeps an unpublished prayer when dismiss is cancelled, discards only explicitly', () => {
  render(<MemoryRouter><CreatePrayerDialog /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '寫下代禱' }));
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '尚未發布的測試' } });
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
  expect(screen.getAllByRole('textbox')[0]).toHaveValue('尚未發布的測試');
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  fireEvent.click(screen.getByRole('button', { name: '放棄修改並離開' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('button', { name: '寫下代禱' })).toBeVisible();
  expect(state.mutateAsync).not.toHaveBeenCalled();
});
