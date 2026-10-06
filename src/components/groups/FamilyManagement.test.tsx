// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FamilyManagement } from './FamilyManagement';
import { toast } from 'sonner';
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'leader' } }) }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });
function show() {
  const group = {id:'family',name:'同行小家',church:'IM 行動教會',audience:'couples',listed:true,status:'active',version:1,description:'',meeting:'',announcement:'',leaderId:null,memberCount:1,pendingRequestCount:1};
  vi.stubGlobal('fetch', vi.fn(async (input: string) => ({ok:true,json:async () => input.endsWith('/management') ? {groups:[group],requests:[],churches:[{id:'IM 行動教會',name:'iM行動教會'}]} : {members:[],requests:[{id:'member',name:'申請人',message:'希望週五參加'}],history:[],canChangeLeader:true}})));
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}}); clients.push(client);
  render(<MemoryRouter><QueryClientProvider client={client}><FamilyManagement /></QueryClientProvider></MemoryRouter>);
}
it('surfaces pending applications and submits explicit approval', async () => {
  show();
  fireEvent.click(await screen.findByRole('button',{name:'同行小家 · 1 位申請人'}));
  await screen.findByText('希望週五參加');
  fireEvent.click(screen.getByRole('button',{name:'同意加入'}));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/life-groups/management/family/requests/member',expect.objectContaining({method:'POST',body:JSON.stringify({approve:true})})));
});

function showDeletion({ status = 'active', canDelete = true, ordinaryMemberCount = 0, unlinkedActiveMemberCount = 0, fail = false, deferred = false } = {}) {
  let group = {id:'family',name:'可恢復小家',church:'IM 行動教會',audience:'unspecified',listed:status !== 'archived',status,version:7,description:'',meeting:'',announcement:'',leaderId:null,coLeaderId:null,memberCount:ordinaryMemberCount,pendingRequestCount:0,canManage:true,canDelete,ordinaryMemberCount,unlinkedActiveMemberCount};
  let resolveMutation: (() => void) | undefined;
  const fetch = vi.fn(async (input: string, options?: RequestInit) => {
    if (options?.method === 'DELETE' || (options?.method === 'POST' && input.endsWith('/restore'))) {
      if (deferred) await new Promise<void>(resolve => { resolveMutation = resolve; });
      if (fail) return { ok:false,json:async () => ({error:'資料已更新，請重新載入後再試。'}) };
      group = {...group,status:input.endsWith('/restore')?'active':'archived',listed:false,version:group.version+1};
      return {ok:true,json:async()=>({ok:true})};
    }
    return {ok:true,json:async()=>input.endsWith('/management')?{groups:[group],requests:[],churches:[]}:{members:[],requests:[],history:[],canChangeLeader:true}};
  });
  vi.stubGlobal('fetch',fetch);
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);
  const invalidate = vi.spyOn(client,'invalidateQueries');
  render(<MemoryRouter><QueryClientProvider client={client}><FamilyManagement initialGroup={status === 'active' ? 'family' : null}/></QueryClientProvider></MemoryRouter>);
  return {fetch,invalidate,release:()=>resolveMutation?.()};
}
it('requires the exact current group name, allows cancellation and removes archived status from ordinary settings',async()=>{
  const {fetch}=showDeletion();
  fireEvent.click(await screen.findByRole('button',{name:'刪除 可恢復小家'}));
  const dialog=screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('button',{name:'確認刪除'})).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('textbox',{name:'請輸入小家完整名稱確認'}),{target:{value:'別的小家'}});
  expect(within(dialog).getByRole('button',{name:'確認刪除'})).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button',{name:'取消'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(fetch.mock.calls.some(([,opts])=>opts?.method==='DELETE')).toBe(false);
  expect(within(screen.getByRole('combobox',{name:'狀態'})).queryByRole('option',{name:'已封存'})).toBeNull();
});
it('submits only a named versioned deletion, closes the editor and moves the family into the recovery list',async()=>{
  const {fetch,invalidate}=showDeletion();
  fireEvent.click(await screen.findByRole('button',{name:'刪除 可恢復小家'}));
  const dialog=screen.getByRole('alertdialog');
  fireEvent.change(within(dialog).getByRole('textbox',{name:'請輸入小家完整名稱確認'}),{target:{value:'可恢復小家'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'確認刪除'}));
  await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(fetch).toHaveBeenCalledWith('/api/life-groups/management/family',expect.objectContaining({method:'DELETE',body:JSON.stringify({version:7,confirmName:'可恢復小家'})}));
  expect(screen.queryByRole('button',{name:'儲存小家設定'})).toBeNull();
  expect(within(screen.getByRole('region',{name:'目前的小家'})).queryByText('可恢復小家')).toBeNull();
  expect(screen.getByText('已刪除的小家 · 1')).toBeInTheDocument();
  expect(toast.success).toHaveBeenCalledWith('小家已刪除，歷史資料已保留');
  expect(invalidate).toHaveBeenCalledWith({queryKey:['/api/life-groups']});
  expect(invalidate).toHaveBeenCalledWith({queryKey:['access-control-me']});
});
it('keeps failed deletion visible without success or an automatic retry',async()=>{
  const {fetch}=showDeletion({fail:true});
  fireEvent.click(await screen.findByRole('button',{name:'刪除 可恢復小家'}));
  const dialog=screen.getByRole('alertdialog');
  fireEvent.change(within(dialog).getByRole('textbox',{name:'請輸入小家完整名稱確認'}),{target:{value:'可恢復小家'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'確認刪除'}));
  await within(dialog).findByRole('alert');
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(fetch.mock.calls.filter(([,opts])=>opts?.method==='DELETE')).toHaveLength(1);
  expect(toast.success).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button',{name:'取消'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('blocks a populated family and gives the existing move or exit route',async()=>{
  const {fetch}=showDeletion({ordinaryMemberCount:2});
  fireEvent.click(await screen.findByRole('button',{name:'刪除 可恢復小家'}));
  const dialog=screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('status')).toHaveTextContent('還有 2 筆一般成員資料');
  expect(within(dialog).getByRole('textbox')).toBeDisabled();
  expect(within(dialog).getByRole('button',{name:'確認刪除'})).toBeDisabled();
  expect(fetch.mock.calls.some(([,opts])=>opts?.method==='DELETE')).toBe(false);
});
it('hides deletion from assigned leaders without church management',async()=>{
  showDeletion({canDelete:false});
  await screen.findByRole('button',{name:'設定與成員異動'});
  expect(screen.queryByRole('button',{name:'刪除 可恢復小家'})).toBeNull();
});
it('explains unlinked membership separately without claiming the user-only transfer menu can handle it',async()=>{
  showDeletion({ordinaryMemberCount:1,unlinkedActiveMemberCount:1});
  fireEvent.click(await screen.findByRole('button',{name:'刪除 可恢復小家'}));
  const dialog=screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('status')).toHaveTextContent('另有 1 筆尚未綁定帳號的成員名錄');
  expect(within(dialog).getByRole('status')).toHaveTextContent('無法在此處的「轉家或退出」選單操作');
  expect(within(dialog).getByRole('status')).not.toHaveTextContent('請先到「設定與成員異動」完成轉家');
  expect(within(dialog).getByRole('button',{name:'確認刪除'})).toBeDisabled();
});
it('requires explicit named restoration for existing archived families and explains invitation behavior',async()=>{
  const {fetch}=showDeletion({status:'archived'});
  fireEvent.click(await screen.findByText('已刪除的小家 · 1'));
  fireEvent.click(screen.getByRole('button',{name:'恢復 可恢復小家'}));
  const dialog=screen.getByRole('alertdialog');
  expect(within(dialog).getByText(/不會重新公開，也不會啟用舊邀請/)).toBeVisible();
  fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'可恢復小家'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'確認恢復'}));
  await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(fetch).toHaveBeenCalledWith('/api/life-groups/management/family/restore',expect.objectContaining({method:'POST',body:JSON.stringify({version:7,confirmName:'可恢復小家'})}));
  expect(within(screen.getByRole('region',{name:'目前的小家'})).getByText('可恢復小家')).toBeVisible();
  expect(toast.success).toHaveBeenCalledWith('小家已恢復，尚未開放申請');
});
it('prevents double submit and dismissal while a deletion request is busy',async()=>{
  const {fetch,release}=showDeletion({deferred:true});
  fireEvent.click(await screen.findByRole('button',{name:'刪除 可恢復小家'}));
  const dialog=screen.getByRole('alertdialog');
  fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'可恢復小家'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'確認刪除'}));
  expect(within(dialog).getByRole('button',{name:'處理中…'})).toBeDisabled();
  expect(within(dialog).getByRole('button',{name:'取消'})).toBeDisabled();
  fireEvent.keyDown(dialog,{key:'Escape'});
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(fetch.mock.calls.filter(([,opts])=>opts?.method==='DELETE')).toHaveLength(1);
  release();
  await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
});
it('creates categorized, publicly listed families and allows explicit unlisting', async () => {
  show();
  await screen.findByText('開啟新小家');
  fireEvent.click(screen.getByText('開啟新小家'));
  expect(screen.getByRole('checkbox',{name:'公開簡介，開放申請加入'})).toBeChecked();
  fireEvent.change(screen.getByRole('textbox',{name:'小家名稱'}),{target:{value:'姊妹小家'}});
  fireEvent.change(screen.getByRole('combobox',{name:'小家類型'}),{target:{value:'women'}});
  fireEvent.click(screen.getByRole('button',{name:'建立小家'}));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/life-groups/management',expect.objectContaining({method:'POST',body:JSON.stringify({name:'姊妹小家',church:'IM 行動教會',audience:'women',listed:true})})));
});

const primaryId='f7d374ba-3e98-43b0-9e45-6e74591442ab', secondId='eec8d8fc-1ba9-44e1-927f-6e376db84c43', thirdId='dc4e51b7-6d57-46d8-aed5-4c13da190095';
function showLeaders(coLeaderId: string | null=null, canChangeLeader=true, leaderId: string | null=primaryId) {
  const group={id:'family',name:'共同負責小家',church:'IM 行動教會',audience:'couples',listed:true,status:'active',version:5,description:'來源名單尚未登入者留在簡介核對',meeting:'',announcement:'',leaderId,coLeaderId,leaderName:leaderId?'領袖甲':null,coLeaderName:coLeaderId?'領袖乙':null,memberCount:3,pendingRequestCount:0,canManage:true};
  const members=[{id:primaryId,name:'領袖甲',manager:!!leaderId},{id:secondId,name:'領袖乙',manager:!!coLeaderId},{id:thirdId,name:'成員丙',manager:false}];
  const fetch=vi.fn(async(input:string,_options?:RequestInit)=>({ok:true,json:async()=>input.endsWith('/management')?{groups:[group],requests:[],churches:[]}:{members,requests:[],history:[],canChangeLeader}}));vi.stubGlobal('fetch',fetch);
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<MemoryRouter><QueryClientProvider client={client}><FamilyManagement initialGroup="family"/></QueryClientProvider></MemoryRouter>);return fetch;
}
it('offers two equal leadership slots with distinct current members and explicit versioned handover',async()=>{const fetch=showLeaders();vi.spyOn(window,'confirm').mockReturnValue(true);const first=await screen.findByRole('combobox',{name:'小家長（一）'});const second=screen.getByRole('combobox',{name:'小家長（二）'});expect(first).toHaveValue(primaryId);expect(within(second).queryByRole('option',{name:'領袖甲'})).toBeNull();fireEvent.change(second,{target:{value:secondId}});expect(within(first).queryByRole('option',{name:'領袖乙'})).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('領袖甲、領袖乙');fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));const patch=fetch.mock.calls.find(([,options])=>options?.method==='PATCH')!;expect(JSON.parse(patch[1]!.body as string)).toMatchObject({version:5,leaderId:primaryId,coLeaderId:secondId});expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('兩位小家長有相同的小家管理權'));expect(screen.queryByText(/副小家長|主要小家長/)).toBeNull();});
it('preserves both current leaders on unrelated settings and displays both as small-group leaders',async()=>{const fetch=showLeaders(secondId);await screen.findByRole('combobox',{name:'小家長（二）'});expect(screen.getByText('小家長：領袖甲、領袖乙')).toBeVisible();expect(screen.getByText('領袖甲 · 小家長')).toBeVisible();expect(screen.getByText('領袖乙 · 小家長')).toBeVisible();fireEvent.change(screen.getByRole('textbox',{name:'小家簡介（公開）'}),{target:{value:'更新聚會說明'}});fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));expect(JSON.parse(fetch.mock.calls.find(([,options])=>options?.method==='PATCH')![1]!.body as string)).toMatchObject({leaderId:primaryId,coLeaderId:secondId,description:'更新聚會說明'});});
it('cancels a leadership handover without any mutation',async()=>{const fetch=showLeaders(secondId);vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.change(await screen.findByRole('combobox',{name:'小家長（二）'}),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));expect(window.confirm).toHaveBeenCalled();expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(false);expect(screen.getByRole('combobox',{name:'小家長（二）'})).toHaveValue('');});
it('allows an explicit null second slot instead of silently keeping or replacing it',async()=>{const fetch=showLeaders(secondId);vi.spyOn(window,'confirm').mockReturnValue(true);fireEvent.change(await screen.findByRole('combobox',{name:'小家長（二）'}),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));expect(JSON.parse(fetch.mock.calls.find(([,options])=>options?.method==='PATCH')![1]!.body as string)).toMatchObject({leaderId:primaryId,coLeaderId:null});});
it('keeps both assignments unchanged when the server does not permit leadership changes',async()=>{const fetch=showLeaders(secondId,false);await screen.findByText('領袖甲 · 小家長');expect(screen.queryByRole('combobox',{name:'小家長（一）'})).toBeNull();expect(screen.queryByRole('combobox',{name:'小家長（二）'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));expect(JSON.parse(fetch.mock.calls.find(([,options])=>options?.method==='PATCH')![1]!.body as string)).toMatchObject({leaderId:primaryId,coLeaderId:secondId});});

it('preserves two unassigned slots and the source description until a real member is assigned', async () => {
  const fetch = showLeaders(null, true, null);
  await screen.findByRole('combobox', { name: '小家長（一）' });
  expect(screen.getByRole('combobox', { name: '小家長（一）' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: '小家長（二）' })).toHaveValue('');
  expect(screen.getByText('小家長：尚未指派')).toBeVisible();
  expect(screen.getByRole('textbox', { name: '小家簡介（公開）' })).toHaveValue('來源名單尚未登入者留在簡介核對');
  fireEvent.click(screen.getByRole('button', { name: '儲存小家設定' }));
  await waitFor(() => expect(fetch.mock.calls.some(([,options]) => options?.method === 'PATCH')).toBe(true));
  expect(JSON.parse(fetch.mock.calls.find(([,options]) => options?.method === 'PATCH')![1]!.body as string)).toMatchObject({leaderId:null, coLeaderId:null});
});
