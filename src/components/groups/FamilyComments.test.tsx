// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { GroupComment } from '@shared/lifeGroup';
import { FamilyComments } from './FamilyComments';

let records: GroupComment[], failWrite: boolean, failRead: boolean;
const clients: QueryClient[] = [];
const comment = (n: number): GroupComment => ({ id: 'c'+n, authorId: n === 1 ? 'member' : 'other', authorName: n === 1 ? '自己' : '家人', body: '留言'+n, createdAt: new Date(Date.UTC(2026,8,30,0,n)).toISOString() });
beforeEach(() => {
  records = [comment(1), comment(2)]; failWrite = false; failRead = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (init.method === 'PUT') {
      if (failWrite) return { ok: false, json: async () => ({error:'連線中斷，請重試'}) };
      const id = url.split('/').at(-1)!;
      if (!records.some(c => c.id === id)) records.push({...comment(records.length+1), id, authorId:'member', authorName:'自己', body:JSON.parse(init.body as string).body});
      return {ok:true,json:async()=>({ok:true})};
    }
    if (init.method === 'DELETE') { records = records.filter(c => !url.endsWith('/'+c.id)); return {ok:true,json:async()=>({ok:true})}; }
    const offset = Number(new URL(url,'https://example.test').searchParams.get('offset'));
    return {ok:!failRead,json:async()=>failRead?{error:'無法讀取'}:[...records].reverse().slice(offset,offset+30)};
  }));
});
afterEach(()=>{cleanup(); clients.forEach(c=>c.clear()); clients.length=0; vi.restoreAllMocks(); vi.unstubAllGlobals();});
function show(count=records.length, manager=false) {
  const client = new QueryClient({ defaultOptions:{ queries:{retry:false},mutations:{retry:false} } }); clients.push(client);
  render(<QueryClientProvider client={client}><FamilyComments groupId="group" shareId="share" actor="member" manager={manager} count={count}/></QueryClientProvider>);
}
const replies = () => within(screen.getByRole('list',{name:'留言內容'}));
async function write(body: string) {
  if (screen.queryByRole('button',{name:'寫下留言'})) fireEvent.click(screen.getByRole('button',{name:'寫下留言'}));
  fireEvent.change(screen.getByRole('textbox',{name:'寫下留言'}),{target:{value:body}});
  fireEvent.click(screen.getByRole('button',{name:'送出留言'}));
}

it('shows replies immediately in chronological order without a dialog or keyboard focus',async()=>{
  show(); await screen.findByText('留言2');
  expect(replies().getAllByRole('listitem').map(e=>e.textContent)).toEqual([expect.stringContaining('留言1'),expect.stringContaining('留言2')]);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'寫下留言'}));
  const input = screen.getByRole('textbox',{name:'寫下留言'});
  expect(input).not.toHaveFocus();
  expect(screen.getByText('留言2').compareDocumentPosition(input)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it('appends repeated replies and immediately shows the persisted new reply',async()=>{
  show(); await screen.findByText('留言2');
  await write('第一則新留言'); await screen.findByText('第一則新留言');
  await waitFor(()=>expect(screen.getByRole('textbox')).not.toBeDisabled());
  await write('第二則新留言'); await screen.findByText('第二則新留言');
  expect(replies().getAllByRole('listitem').at(-1)).toHaveTextContent('第二則新留言');
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(records).toHaveLength(4);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('loads older pages above existing replies without duplicates and retains them after sending',async()=>{
  records=Array.from({length:35},(_,i)=>comment(i+1)); show(); await screen.findByText('留言35');
  expect(replies().getAllByRole('listitem')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button',{name:'查看較早留言'}));
  await waitFor(()=>expect(replies().getAllByRole('listitem')).toHaveLength(30));
  fireEvent.click(screen.getByRole('button',{name:'查看較早留言'}));
  await screen.findByText('留言1'); expect(replies().getAllByRole('listitem')).toHaveLength(35);
  await write('追加'); await screen.findByText('追加');
  expect(replies().getAllByRole('listitem')).toHaveLength(36);
  expect(replies().getAllByRole('listitem')[0]).toHaveTextContent('留言1');
});
it('preserves failed drafts and reuses the idempotency ID when retried',async()=>{
  show(); await screen.findByText('留言2'); failWrite=true;
  await write('保留草稿'); await screen.findByText('連線中斷，請重試');
  expect(screen.getByRole('textbox')).toHaveValue('保留草稿');
  failWrite=false; fireEvent.click(screen.getByRole('button',{name:'送出留言'}));
  await replies().findByText('保留草稿');
  const writes=vi.mocked(fetch).mock.calls.filter(([,i])=>i?.method==='PUT');
  expect(writes).toHaveLength(2); expect(writes[0][0]).toBe(writes[1][0]);
});
it('can retry failed reads without deleting saved comments',async()=>{
  failRead=true; show(); await screen.findByText('留言暫時無法載入，請重試。');
  failRead=false; fireEvent.click(screen.getByRole('button',{name:'重新載入留言'}));
  await screen.findByText('留言2'); expect(records).toHaveLength(2);
});
it('only offers own-comment removal to members and confirms before removing',async()=>{
  show(); await screen.findByText('留言2');
  expect(screen.queryByRole('button',{name:'撤回 家人 的留言'})).toBeNull();
  vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button',{name:'撤回 自己 的留言'}));
  await waitFor(()=>expect(screen.queryByText('留言1')).toBeNull());
  expect(screen.getByText('留言2')).toBeTruthy();
});
it('offers moderation to managers',async()=>{
  show(2,true); await screen.findByText('留言2');
  expect(screen.getByRole('button',{name:'撤回 家人 的留言'})).toBeTruthy();
});
it('does not request empty threads until the user starts a reply',async()=>{
  records=[]; show(0); expect(fetch).not.toHaveBeenCalled();
  await write('第一則留言'); await replies().findByText('第一則留言');
  expect(screen.queryByRole('dialog')).toBeNull();
});
