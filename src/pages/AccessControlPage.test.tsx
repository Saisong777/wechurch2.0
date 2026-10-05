// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccessControlPage from './AccessControlPage';
import type { AccessGrant } from '@shared/accessControl';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin' }, loading: false }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: true, loading: false }) }));
vi.mock('@/components/theme/AppearanceControl', () => ({ AppearanceControl: () => null }));
const data = {
  church: 'IM 行動教會', isSystemAdmin: true,
  users: [{ id: 'member', name: '測試成員', email: 'fixture@example.test', role: 'member' }],
  roles: [{ id: 'coworker', name: '同工', permissions: ['email.send'], version: 1 }],
  groups: [{ id: 'family', name: '測試小家' }], grants: [] as AccessGrant[], history: [], legacyScopes: [], appointments: [] as Array<{id:string;name:string;leaderId:string|null;coLeaderId?:string|null;pastorId:string|null}>,
};
let fail = false;
let sent: Record<string, unknown>[] = [];
let revoked: {url:string;body:Record<string,unknown>}[]=[];
let deleteError='';
let client: QueryClient;
beforeEach(() => {
  sent = []; fail = false;revoked=[];deleteError='';data.appointments=[];
  data.grants=['同工','全職同工'].map((roleName,i)=>({id:'grant-'+i,userId:'member',roleId:'coworker',roleName,permissions:['members.read'],scope:'church',church:'IM 行動教會',groupId:null,memberId:null,expiresAt:null,active:true,version:1,reason:'初始授權'}));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window,'prompt').mockReturnValue(null);
  vi.stubGlobal('fetch', vi.fn(async (_url, options?: RequestInit) => {
    if (options?.method === 'POST') {
      sent.push(JSON.parse(String(options.body)));
      return { ok: !fail, json: async () => fail ? { error: '連線失敗，請重試' } : { id: 'grant' } };
    }
    if(options?.method==='DELETE'){
      revoked.push({url:String(_url),body:JSON.parse(String(options.body))});
      if(!deleteError)data.grants=data.grants.map(g=>String(_url).endsWith('/'+g.id)?{...g,active:false,version:g.version+1}:g);
      return {ok:!deleteError,json:async()=>deleteError?{error:deleteError}:{ok:true}};
    }
    return { ok: true, json: async () => structuredClone(data) };
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter initialEntries={['/admin/access?member=member']}><QueryClientProvider client={client}><AccessControlPage /></QueryClientProvider></MemoryRouter>);
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('starts with a title only and applies preset permissions only on explicit action', async () => {
  fireEvent.click(await screen.findByRole('button', { name: '新增職分' }));
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '管理全站靈修課表' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '套用職分預設權限' }));
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).toBeChecked();
  fireEvent.change(screen.getByLabelText('管理範圍'), { target: { value: 'site' } });
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: '管理全站靈修課表' })).not.toBeDisabled();
  expect(sent).toHaveLength(0);
});

it('preserves a failed grant and sends the chosen scope, permission and reason', async () => {
  fireEvent.click(await screen.findByRole('button', { name: '新增職分' }));
  fireEvent.change(screen.getByLabelText('管理範圍'), { target: { value: 'group' } });
  fireEvent.change(screen.getByLabelText('指定對象'), { target: { value: 'family' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '管理小家與成員異動' }));
  fireEvent.change(screen.getByLabelText('異動原因'), { target: { value: '協助小家服事' } });
  fail = true;
  fireEvent.click(screen.getByRole('button', { name: '儲存授權' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('異動原因')).toHaveValue('協助小家服事');
  expect(screen.getByRole('checkbox', { name: '管理小家與成員異動' })).toBeChecked();
  expect(sent[0]).toMatchObject({ userId: 'member', roleId: 'coworker', scope: 'group', groupId: 'family', memberId: null, permissions: ['groups.manage'], reason: '協助小家服事' });
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: '儲存授權' }));
  await waitFor(() => expect(screen.queryByRole('form', { name: '編輯成員授權' })).toBeNull());
});

it('does not grant when confirmation is cancelled', async () => {
  fireEvent.click(await screen.findByRole('button', { name: '新增職分' }));
  fireEvent.change(screen.getByLabelText('異動原因'), { target: { value: '只設定職分' } });
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '儲存授權' }));
  expect(sent).toHaveLength(0);
});

it('opens inline confirmation and cancels without native dialogs or a revoke request',async()=>{
  fireEvent.click((await screen.findAllByRole('button',{name:'撤回授權'}))[0]);
  expect(screen.getByRole('form',{name:'撤回授權確認'})).toBeInTheDocument();
  expect(screen.getByLabelText('撤回原因')).toHaveValue('職務調整');
  expect(window.prompt).not.toHaveBeenCalled();expect(window.confirm).not.toHaveBeenCalled();
  expect(revoked).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'取消'}));
  expect(screen.queryByRole('form',{name:'撤回授權確認'})).toBeNull();
  expect(revoked).toHaveLength(0);
});

it('revokes only the confirmed grant, preserves the other role and sends its version and reason',async()=>{
  fireEvent.click((await screen.findAllByRole('button',{name:'撤回授權'}))[0]);
  fireEvent.change(screen.getByLabelText('撤回原因'),{target:{value:'  重複授權  '}});
  const form=screen.getByRole('form',{name:'撤回授權確認'});
  fireEvent.submit(form);fireEvent.submit(form);
  await screen.findByText('已撤回',{exact:true});
  expect(revoked).toEqual([{url:'/api/access-control/grants/grant-0',body:{version:1,reason:'重複授權'}}]);
  expect(data.grants[1].active).toBe(true);
  expect(screen.getAllByText('生效中',{exact:true})).toHaveLength(1);
  expect(window.prompt).not.toHaveBeenCalled();expect(window.confirm).not.toHaveBeenCalled();
});

it('shows an empty reason error in place without sending a request',async()=>{
  fireEvent.click((await screen.findAllByRole('button',{name:'撤回授權'}))[0]);
  fireEvent.change(screen.getByLabelText('撤回原因'),{target:{value:'   '}});
  fireEvent.click(screen.getByRole('button',{name:'確認撤回'}));
  expect(screen.getByRole('alert')).toHaveTextContent('請填寫撤回原因');
  expect(revoked).toHaveLength(0);
});

it.each(['連線失敗，請重試','授權已更新或撤回，請重新載入。'])('keeps the reason and shows the error next to the action: %s',async message=>{
  fireEvent.click((await screen.findAllByRole('button',{name:'撤回授權'}))[0]);
  fireEvent.change(screen.getByLabelText('撤回原因'),{target:{value:'工作重新分配'}});
  deleteError=message;
  fireEvent.click(screen.getByRole('button',{name:'確認撤回'}));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.getByLabelText('撤回原因')).toHaveValue('工作重新分配');
  expect(data.grants[0].active).toBe(true);
  deleteError='';
  fireEvent.click(screen.getByRole('button',{name:'確認撤回'}));
  await screen.findByText('已撤回',{exact:true});
});

it('includes the equal second leader appointment without disguising it as a pastor appointment',async()=>{data.appointments=[{id:'shared-group',name:'共同負責小家',leaderId:'other',coLeaderId:'member',pastorId:null}];await client.invalidateQueries({queryKey:['access-control-admin']});expect(await screen.findByText('小家長職務 · 共同負責小家')).toBeVisible();expect(screen.queryByText('牧者職務 · 共同負責小家')).toBeNull();});
