// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DevotionalNoteDialog } from './DevotionalNoteDialog';
import { saveDevotionalNote } from '@/lib/saveDevotionalNote';
import type { LocalDevotionalNote } from '@/lib/localDevotionalNotes';
import type { DevotionShareDraft } from '@shared/devotionWall';

const preview=vi.hoisted(()=>vi.fn());
vi.mock('./DevotionWallShareDialog',()=>({DevotionWallShareDialog:(props:{draft:DevotionShareDraft;allowGroup?:boolean})=>{
  preview(props);return <div data-testid="share-preview">分享預覽</div>;
}}));

vi.mock('@/lib/saveDevotionalNote', () => ({ saveDevotionalNote: vi.fn(), noteSaveMessage: () => '儲存狀態' }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-owner' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/localDevotionalNotes', () => ({ findLocalDevotionalNoteById: () => null, findLocalDevotionalNoteByReference: () => null, createLocalDevotionalNoteId: () => 'local-test' }));
beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveDevotionalNote).mockReset();
  preview.mockClear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function show(inline = false) {
  function Note() { const [open, setOpen] = useState(true); return <main><DevotionalNoteDialog inline={inline} open={open} onOpenChange={setOpen} verseReference="以賽亞書 43" verseText="經文" /></main>; }
  const router = createMemoryRouter([{ path: '/', element: <h1>首頁</h1> }, { path: '/note', element: <Note /> }], { initialEntries: ['/', '/note'], initialIndex: 1 });
  render(<RouterProvider router={router} />);
  await screen.findByRole('textbox', { name: '看見' });
  return router;
}

it('renders inline in the page without a dialog, portal or scroll lock', async () => {
  await show(true);
  const editor = screen.getByRole('region', { name: '靈修筆記' });
  expect(editor.closest('main')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body).not.toHaveAttribute('data-scroll-locked');
  expect(screen.getByRole('heading', { name: '靈修筆記' })).toHaveFocus();
  expect(screen.getByRole('button', { name: '儲存（自己看）' }).closest('footer')).toBeTruthy();
  expect(screen.getByRole('button', { name: '分享' }).closest('footer')).toBeTruthy();
});

it('positions the inline heading after asynchronous note loading expands the page', async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const shown = show(true);
  const heading = screen.getByRole('heading', { name: '靈修筆記' });
  heading.scrollIntoView = vi.fn();
  await act(async () => { finish({ ok: false } as Response); });
  await shown;
  expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  expect(heading).toHaveFocus();
});

it('keeps the inline editor and private text in place after saving', async () => {
  vi.mocked(saveDevotionalNote).mockImplementation(async (_, note) => ({ note, status: 'synced' }));
  const router = await show(true);
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '同頁筆記' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  await waitFor(() => expect(saveDevotionalNote).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('同頁筆記');
  expect(router.state.location.pathname).toBe('/note');
  expect(preview).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '收起筆記' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.queryByTestId('devotional-note-inline')).toBeNull();
});

it('protects inline unsaved input when collapsing or navigating away', async () => {
  const router = await show(true);
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '不可遺失' } });
  fireEvent.click(screen.getByRole('button', { name: '收起筆記' }));
  fireEvent.click(await screen.findByRole('button', { name: '繼續編輯' }));
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('不可遺失');
  await act(async () => { await router.navigate(-1); });
  fireEvent.click(await screen.findByRole('button', { name: '繼續編輯' }));
  expect(router.state.location.pathname).toBe('/note');
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('不可遺失');
});

it('keeps inline writing mounted while showing explicit sharing confirmation', async () => {
  vi.mocked(saveDevotionalNote).mockImplementation(async (_, note) => ({ note, status: 'synced' }));
  await show(true);
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '先確認再分享' } });
  fireEvent.click(screen.getByRole('button', { name: '分享' }));
  await screen.findByTestId('share-preview');
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('先確認再分享');
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ allowGroup: true }));
});

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

it('uses a wide editor with bottom save outside the scrolling body and collapsed scripture', async () => {
  await show();
  const editor = screen.getByRole('dialog', { name: '靈修筆記' });
  expect(editor).toHaveClass('devotional-note-editor');
  expect(screen.getByTestId('button-save-devotional-note').closest('.note-editor-footer')).toBeTruthy();
  expect(screen.getByTestId('button-save-devotional-note').closest('.note-editor-body')).toBeNull();
  expect(screen.getByTestId('button-save-devotional-note').closest('.note-editor-header')).toBeNull();
  expect(screen.getByRole('button',{name:'分享'}).closest('.note-editor-footer')).toBeTruthy();
  expect(screen.queryByText('儲存並預覽公開分享')).toBeNull();
  const disclosure = screen.getByTestId('text-verse-text').closest('details')!;
  expect(disclosure.open).toBe(false);
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '留下觀察' } });
  fireEvent.click(disclosure.querySelector('summary')!);
  expect(disclosure.open).toBe(true);
  fireEvent.click(disclosure.querySelector('summary')!);
  expect(disclosure.open).toBe(false);
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('留下觀察');
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveClass('overflow-y-auto');
});

it('saves all three sections and closes only after synchronization succeeds', async () => {
  vi.mocked(saveDevotionalNote).mockImplementation(async (_, note) => ({ note, status: 'synced' }));
  await show();
  for (const [name, value] of [['看見', '觀察'], ['領受', '領受內容'], ['回應', '回應內容']]) {
    fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  await waitFor(() => expect(screen.queryByTestId('devotional-note-sheet')).toBeNull());
  expect(saveDevotionalNote).toHaveBeenCalledWith('test-owner', expect.objectContaining({
    observation: '觀察', heartbeatVerse: '領受內容', actionPlan: '回應內容',
    coreInsightNote: JSON.stringify({ GOD_ATTRIBUTE: '領受內容' }),
    verseReference: '以賽亞書 43', verseText: '經文',
  }));
  expect(preview).not.toHaveBeenCalled();
});

it.each(['pending', 'blocked'] as const)('keeps the editor and text open for a %s save', async status => {
  vi.mocked(saveDevotionalNote).mockImplementation(async (_, note) => ({ note, status }));
  await show();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '尚未同步' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  await waitFor(() => expect(saveDevotionalNote).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('尚未同步');
  expect(screen.getByRole('button', { name: '儲存（自己看）' })).toBeEnabled();
});

it('preserves input and restores save after an unexpected error', async () => {
  vi.mocked(saveDevotionalNote).mockRejectedValue(new Error('Storage unavailable'));
  await show();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '不能丟失' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  await waitFor(() => expect(saveDevotionalNote).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('不能丟失');
  expect(screen.getByRole('button', { name: '儲存（自己看）' })).toBeEnabled();
});

it('prevents closing or editing while a save is in flight', async () => {
  let finish!: (value: Awaited<ReturnType<typeof saveDevotionalNote>>) => void;
  vi.mocked(saveDevotionalNote).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await show();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '等待同步' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  expect(screen.getByRole('textbox', { name: '看見' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByTestId('devotional-note-sheet')).toBeTruthy();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  await act(async () => { finish({ note: vi.mocked(saveDevotionalNote).mock.calls[0][1], status: 'synced' }); });
  expect(screen.queryByTestId('devotional-note-sheet')).toBeNull();
});

it('retains legacy fields when editing an existing note', async () => {
  const note: LocalDevotionalNote = {
    id: 'existing-note', userId: 'test-owner', verseReference: '以賽亞書 43', verseText: '原始經文',
    readingPlanId: 'plan', dayNumber: 3, titlePhrase: '舊標題', heartbeatVerse: '舊領受',
    observation: '舊觀察', coreInsightCategory: '["PROMISE"]', coreInsightNote: '{"PROMISE":"應許"}',
    scholarsNote: '舊查經', actionPlan: '舊行動', coolDownNote: '舊禱告',
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  };
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => note } as Response);
  vi.mocked(saveDevotionalNote).mockImplementation(async (_, saved) => ({ note: saved, status: 'synced' }));
  await show();
  expect(screen.getByRole('textbox', { name: '領受' })).toHaveValue('應許');
  expect(screen.queryByTestId('button-analyze-devotional-note')).toBeNull();
  expect(screen.queryByText('AI 整理分析')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '新觀察' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存（自己看）' }));
  await waitFor(() => expect(saveDevotionalNote).toHaveBeenCalledWith('test-owner', expect.objectContaining({
    ...note, observation: '新觀察', updatedAt: expect.any(String),
  })));
});

it('opens audience selection only after saving the private note',async()=>{
  vi.mocked(saveDevotionalNote).mockImplementation(async(_,note)=>({note:{...note,id:'saved-note'},status:'synced'}));
  await show();
  fireEvent.change(screen.getByRole('textbox',{name:'看見'}),{target:{value:'我的觀察'}});
  fireEvent.click(screen.getByRole('button',{name:'分享'}));
  await screen.findByTestId('share-preview');
  expect(saveDevotionalNote).toHaveBeenCalledOnce();
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({allowGroup:true,draft:expect.objectContaining({sourceId:'saved-note'})}));
});

it.each(['pending','blocked'] as const)('never opens sharing when private save is %s',async status=>{
  vi.mocked(saveDevotionalNote).mockImplementation(async(_,note)=>({note,status}));
  await show();
  fireEvent.change(screen.getByRole('textbox',{name:'看見'}),{target:{value:'尚未同步'}});
  fireEvent.click(screen.getByRole('button',{name:'分享'}));
  await waitFor(()=>expect(saveDevotionalNote).toHaveBeenCalledOnce());
  expect(preview).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox',{name:'看見'})).toHaveValue('尚未同步');
});
