// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NoteConflictReview } from './NoteConflictReview';
import type { LocalDevotionalNote } from '@/lib/localDevotionalNotes';

const note = { id:'note-a',userId:'owner',version:1,syncStatus:'blocked',verseReference:'約翰福音 1',verseText:'',createdAt:'2026-09-13',updatedAt:'2026-09-13' } as LocalDevotionalNote;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('requires an explicit comparison and consent without writing the server', async () => {
  const cloud = { ...note,version:2,observation:'另一台裝置的內容' };
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>cloud});
  vi.stubGlobal('fetch',fetcher);
  vi.stubGlobal('confirm',vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true));
  const onRebase=vi.fn();
  render(<NoteConflictReview note={note} owner="owner" busy={false} onRebase={onRebase} />);
  fireEvent.click(screen.getByRole('button',{name:'查看雲端版本'}));
  expect(await screen.findByText('另一台裝置的內容')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'已合併，保留目前輸入'}));
  expect(onRebase).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'已合併，保留目前輸入'}));
  expect(onRebase).toHaveBeenCalledWith(cloud);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].method).toBeUndefined();
});
it('rejects a mismatched owner and keeps the draft intact', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...note,userId:'someone-else',version:2})}));
  const onRebase=vi.fn();
  render(<NoteConflictReview note={note} owner="owner" busy={false} onRebase={onRebase} />);
  fireEvent.click(screen.getByRole('button',{name:'查看雲端版本'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('原稿仍保留');
  expect(onRebase).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'已合併，保留目前輸入'})).toBeNull();
});
