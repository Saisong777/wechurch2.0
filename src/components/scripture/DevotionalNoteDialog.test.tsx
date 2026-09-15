// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DevotionalNoteDialog } from './DevotionalNoteDialog';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-owner' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/localDevotionalNotes', () => ({ findLocalDevotionalNoteById: () => null, findLocalDevotionalNoteByReference: () => null, createLocalDevotionalNoteId: () => 'local-test' }));
beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function show() {
  function Note() { const [open, setOpen] = useState(true); return <DevotionalNoteDialog open={open} onOpenChange={setOpen} verseReference="以賽亞書 43" verseText="經文" />; }
  const router = createMemoryRouter([{ path: '/', element: <h1>首頁</h1> }, { path: '/note', element: <Note /> }], { initialEntries: ['/', '/note'], initialIndex: 1 });
  render(<RouterProvider router={router} />);
  await screen.findByRole('textbox', { name: '看見' });
  return router;
}

it('closes an unchanged note without asking to discard it', async () => {
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.queryByTestId('devotional-note-sheet')).toBeNull();
});

it('keeps unsaved text when closing is cancelled, and discards only after confirmation', async () => {
  await show();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '尚未儲存的筆記' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(await screen.findByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('尚未儲存的筆記');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: '放棄修改並離開' }));
  expect(screen.queryByTestId('devotional-note-sheet')).toBeNull();
});

it('protects an open note from browser-back navigation', async () => {
  const router = await show();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '保留筆記' } });
  await act(async () => { await router.navigate(-1); });
  fireEvent.click(await screen.findByRole('button', { name: '繼續編輯' }));
  expect(router.state.location.pathname).toBe('/note');
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('保留筆記');
});
