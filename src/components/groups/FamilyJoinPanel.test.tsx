// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FamilyJoinPanel } from './FamilyJoinPanel';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member' } }) }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.unstubAllGlobals(); });
function show(token = '') {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => ({ ok:true, json:async () => input.includes('/directory') ? { selectedChurch:'IM 行動教會', churches:[{id:'IM 行動教會',name:'iM行動教會'}], groups:[{id:'family',name:'同行小家',description:'歡迎',meeting:'週五'}] } : [] })));
  const client = new QueryClient({ defaultOptions:{queries:{retry:false}} }); clients.push(client);
  const join = vi.fn();
  render(<QueryClientProvider client={client}><FamilyJoinPanel token={token} setToken={() => {}} join={join} joining={false} /></QueryClientProvider>);
  return join;
}
it('offers matching, directory and invitation without forcing membership', async () => {
  show();
  expect(screen.getByRole('button',{name:'幫我找小家'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:'我已經有小家'}));
  expect(await screen.findByRole('heading',{name:'同行小家'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'申請加入'})).toBeTruthy();
});
it('requires consent and contact before requesting pastoral matching', async () => {
  show();
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
