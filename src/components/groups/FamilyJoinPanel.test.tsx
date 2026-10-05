// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FamilyJoinPanel } from './FamilyJoinPanel';
import { MemoryRouter } from 'react-router-dom';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member' } }) }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.unstubAllGlobals(); });
function show(token = '', membershipStatus: string | null = null, leaders: {leaderName?:string;coLeaderName?:string} = {}) {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => ({ ok:true, json:async () => input.includes('/directory') ? { selectedChurch:'IM 行動教會', churches:[{id:'IM 行動教會',name:'iM行動教會'}], groups:[{id:'family',name:'同行小家',description:'歡迎',meeting:'週五',audience:'couples',membershipStatus,...leaders}] } : [] })));
  const client = new QueryClient({ defaultOptions:{queries:{retry:false}} }); clients.push(client);
  const join = vi.fn();
  render(<MemoryRouter><QueryClientProvider client={client}><FamilyJoinPanel token={token} setToken={() => {}} join={join} joining={false} /></QueryClientProvider></MemoryRouter>);
  return join;
}
it('offers matching, directory and invitation without forcing membership', async () => {
  show();
  expect(screen.getByRole('button',{name:'瀏覽小家'})).toHaveAttribute('aria-pressed','true');
  expect(await screen.findByRole('heading',{name:'同行小家'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'申請加入'})).toBeTruthy();
});
it('requires consent and contact before requesting pastoral matching', async () => {
  show();
  fireEvent.click(screen.getByRole('button',{name:'請同工幫我找'}));
  await screen.findByText('iM行動教會');
  expect(screen.queryByRole('combobox', {name:'選擇教會'})).toBeNull();
  fireEvent.change(screen.getByRole('textbox',{name:'方便聚會的時間'}),{target:{value:'週五晚上'}});
  fireEvent.change(screen.getByRole('textbox',{name:'方便聯繫的方式'}),{target:{value:'fixture@example.test'}});
  expect(screen.getByRole('button',{name:'請同工協助安排'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button',{name:'請同工協助安排'})).not.toBeDisabled();
});
it('opens the invitation form when returning from an invitation link', () => {
  const join = show('AB12-CD34-EF56');
  expect(screen.getByRole('textbox',{name:'小家邀請碼'})).toHaveValue('AB12-CD34-EF56');
  fireEvent.click(screen.getByRole('button',{name:'送出加入申請'}));
  expect(join).toHaveBeenCalledOnce();
});
it('filters categories and sends an introduction only after explicit submission', async () => {
  show();
  await screen.findByRole('heading',{name:'同行小家'});
  fireEvent.change(screen.getByRole('combobox',{name:'小家類型'}),{target:{value:'women'}});
  expect(screen.queryByRole('heading',{name:'同行小家'})).toBeNull();
  fireEvent.change(screen.getByRole('combobox',{name:'小家類型'}),{target:{value:'couples'}});
  fireEvent.click(screen.getByRole('button',{name:'申請加入'}));
  fireEvent.change(screen.getByRole('textbox',{name:'想對小家長說的話（選填）'}),{target:{value:'週五方便參加'}});
  fireEvent.click(screen.getByRole('button',{name:'送出加入申請'}));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/life-groups/directory/family/join',expect.objectContaining({method:'POST',body:JSON.stringify({message:'週五方便參加'})})));
});
it('shows pending review and withdrawal without allowing duplicate application', async () => {
  show('', 'pending');
  await screen.findByText('等待小家長審核');
  expect(screen.queryByRole('button',{name:'申請加入'})).toBeNull();
  vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button',{name:'撤回申請'}));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/life-groups/directory/family/join',expect.objectContaining({method:'DELETE'})));
  vi.restoreAllMocks();
});
it('offers an entry only to approved members and reapplication to declined applicants', async () => {
  show('', 'approved');
  expect(await screen.findByRole('link',{name:'進入我的小家'})).toHaveAttribute('href','/groups/family');
  cleanup();
  show('', 'rejected');
  expect(await screen.findByRole('button',{name:'重新申請'})).toBeEnabled();
});

it('shows both supplied equal leaders in the directory without inventing account identities',async()=>{show('',null,{leaderName:'領袖甲',coLeaderName:'領袖乙'});expect(await screen.findByText('小家長：領袖甲、領袖乙')).toBeVisible();expect(screen.queryByText(/副小家長|主要小家長/)).toBeNull();});
