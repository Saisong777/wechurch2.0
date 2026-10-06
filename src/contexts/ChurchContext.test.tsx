// @vitest-environment jsdom
import {useUnifiedMembers} from '@/hooks/useUnifiedMembers';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useQuery} from '@tanstack/react-query';
import {ChurchProvider,ChurchPageBoundary,useChurchContext} from './ChurchContext';
import {ChurchControl} from '@/components/layout/ChurchControl';
import {churchFetch,setChurchScope} from '@/lib/churchFetch';
const auth=vi.hoisted(()=>({user:{id:'actor',church:'IM 行動教會',role:'admin'} as {id:string;church:string|null;role:string}|null,refreshAuth:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({...auth,loading:false})}));
const options=[{id:'IM 行動教會',name:'iM行動教會'},{id:'桃園WeChurch',name:'桃園WeChurch'},{id:'火樂',name:'火樂'}];
let contextFail=0;
beforeEach(()=>{auth.user={id:'actor',church:'IM 行動教會',role:'admin'};contextFail=0;auth.refreshAuth.mockReset();vi.spyOn(window,'confirm').mockReturnValue(true);vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
 if(String(input)==='/api/church-context'){if(contextFail)return new Response('{}',{status:contextFail});const selected=decodeURIComponent(new Headers(init?.headers).get('X-WeChurch-Church')||'')||auth.user?.church||null;return new Response(JSON.stringify({actorChurch:auth.user?.church??null,selectedChurch:selected,isSystemAdmin:auth.user?.role==='admin',allowedOptions:auth.user?.role==='admin'?options:options.filter(option=>option.id===auth.user?.church),requiresApproval:!auth.user?.church}));}
 return new Response(JSON.stringify({church:decodeURIComponent(new Headers(init?.headers).get('X-WeChurch-Church')||'')}));
 }));});
afterEach(()=>{cleanup();setChurchScope(null,false);vi.unstubAllGlobals();vi.restoreAllMocks();});
function Tenant(){const [draft,setDraft]=React.useState('');const q=useQuery({queryKey:['same-key'],queryFn:async()=>(await churchFetch('/api/prayers')).json(),retry:false});return <><p data-testid="tenant">{q.data?.church??'loading'}</p><input aria-label="教會分享稿" value={draft} onChange={event=>setDraft(event.target.value)}/></>;}
import React from 'react';
function Personal(){const [draft,setDraft]=React.useState('');return <input aria-label="私人筆記稿" value={draft} onChange={event=>setDraft(event.target.value)}/>;}
function App(){return <ChurchProvider><ChurchControl/><ChurchPageBoundary><Tenant/></ChurchPageBoundary><ChurchPageBoundary personal><Personal/></ChurchPageBoundary></ChurchProvider>;}
it('switches verified namespaces, resets only tenant drafts and preserves personal draft',async()=>{
 render(<App/>);await waitFor(()=>expect(screen.getByTestId('tenant')).toHaveTextContent('IM 行動教會'));
 fireEvent.change(screen.getByRole('textbox',{name:'教會分享稿'}),{target:{value:'舊教會未送稿'}});fireEvent.change(screen.getByRole('textbox',{name:'私人筆記稿'}),{target:{value:'尚未儲存的私稿'}});
 fireEvent.change(screen.getByRole('combobox',{name:'目前教會'}),{target:{value:'火樂'}});
 await waitFor(()=>expect(screen.getByTestId('tenant')).toHaveTextContent('火樂'));
 expect(screen.getByRole('textbox',{name:'教會分享稿'})).toHaveValue('');expect(screen.getByRole('textbox',{name:'私人筆記稿'})).toHaveValue('尚未儲存的私稿');
});
it('makes ordinary church membership readonly and null membership pending while keeping personal editing',async()=>{
 auth.user={id:'actor',church:null,role:'member'};render(<App/>);
 expect(await screen.findByText('等待教會核定')).toBeVisible();expect(screen.queryByRole('combobox',{name:'目前教會'})).toBeNull();
 expect(screen.getByRole('textbox',{name:'私人筆記稿'})).toBeVisible();expect(screen.queryByRole('textbox',{name:'教會分享稿'})).toBeNull();
});
it('shows clear auth/context failures and keeps personal pages accessible',async()=>{
 contextFail=401;render(<App/>);expect(await screen.findByText('請重新登入以確認教會歸屬。')).toBeVisible();expect(screen.getByRole('textbox',{name:'私人筆記稿'})).toBeVisible();expect(screen.queryByTestId('tenant')).toBeNull();
});
it('cancels selecting another church without changing drafts or requests',async()=>{
 render(<App/>);await screen.findByRole('combobox',{name:'目前教會'});fireEvent.change(screen.getByRole('textbox',{name:'教會分享稿'}),{target:{value:'保留分享稿'}});vi.mocked(window.confirm).mockReturnValue(false);
 fireEvent.change(screen.getByRole('combobox',{name:'目前教會'}),{target:{value:'火樂'}});expect(screen.getByRole('textbox',{name:'教會分享稿'})).toHaveValue('保留分享稿');expect(screen.getByRole('combobox',{name:'目前教會'})).toHaveValue('IM 行動教會');
});

it('re-verifies a same-user approved church change and preserves the private note draft',async()=>{
 auth.user={id:'actor',church:'IM 行動教會',role:'member'};const view=render(<App/>);await waitFor(()=>expect(screen.getByTestId('tenant')).toHaveTextContent('IM 行動教會'));fireEvent.change(screen.getByRole('textbox',{name:'私人筆記稿'}),{target:{value:'同帳號未存筆記'}});auth.user={...auth.user!,church:'桃園WeChurch'};view.rerender(<App/>);await waitFor(()=>expect(screen.getByTestId('tenant')).toHaveTextContent('桃園WeChurch'));expect(screen.getByRole('textbox',{name:'私人筆記稿'})).toHaveValue('同帳號未存筆記');expect(screen.getByText('所屬教會：桃園WeChurch')).toBeVisible();
});
it('keeps null-affiliation owner support accessible and blocks the tenant wall',async()=>{
 auth.user={id:'actor',church:null,role:'member'};render(<ChurchProvider><ChurchPageBoundary allowPendingOwner><p>本人的陪伴申請</p></ChurchPageBoundary><ChurchPageBoundary><Tenant/></ChurchPageBoundary></ChurchProvider>);expect(await screen.findByText('等待教會核定')).toBeVisible();expect(screen.getByText('本人的陪伴申請')).toBeVisible();expect(screen.queryByTestId('tenant')).toBeNull();
});
it('shows a clear 403 context failure instead of mounting tenant content',async()=>{contextFail=403;render(<App/>);expect(await screen.findByText('無法使用此教會，請聯繫管理者核定。')).toBeVisible();expect(screen.queryByTestId('tenant')).toBeNull();});

it('does not let an old refresh closure override the same-user newly approved church',async()=>{
 auth.user={id:'actor',church:'IM 行動教會',role:'member'};
 function Refresh(){const context=useChurchContext();return <button onClick={()=>void context?.refreshChurch()}>同步教會核定</button>;}
 const tree=()=> <ChurchProvider><Refresh/><ChurchControl/><ChurchPageBoundary><Tenant/></ChurchPageBoundary></ChurchProvider>;
 const view=render(tree());await waitFor(()=>expect(screen.getByTestId('tenant')).toHaveTextContent('IM 行動教會'));
 auth.refreshAuth.mockImplementation(async()=>{auth.user={...auth.user!,church:'火樂'};view.rerender(tree());});
 fireEvent.click(screen.getByRole('button',{name:'同步教會核定'}));await waitFor(()=>expect(screen.getByTestId('tenant')).toHaveTextContent('火樂'));expect(screen.getByText('所屬教會：火樂')).toBeVisible();
});

it('uses the real member mutators under a verified selector so child writes carry the selected church',async()=>{
 const original=vi.mocked(fetch).getMockImplementation()!;vi.mocked(fetch).mockImplementation(async(input,init)=>{if(String(input)==='/api/church-context')return original(input,init);return new Response(JSON.stringify(init?.method?{}:[]));});
 function Members(){const context=useChurchContext();const members=useUnifiedMembers({tab:'all',church:context?.data?.selectedChurch || '',enabled:!!context?.data?.selectedChurch});return <><p>{members.isLoading?'讀取會員中':'會員已載入'}</p><button onClick={()=>members.updatePotentialMember.mutate({id:'potential-id',updates:{status:'pending'}})}>更新聯絡資料</button><button onClick={()=>members.deleteMember.mutate('potential-id')}>刪除聯絡資料</button><button onClick={()=>members.updateRole.mutate({userId:'user-id',newRole:'member'})}>更新會員角色</button></>;}
 render(<ChurchProvider><ChurchControl/><ChurchPageBoundary><Members/></ChurchPageBoundary></ChurchProvider>);await screen.findByText('會員已載入');fireEvent.change(screen.getByRole('combobox',{name:'目前教會'}),{target:{value:'火樂'}});await waitFor(()=>expect(screen.getByRole('combobox',{name:'目前教會'})).toHaveValue('火樂'));await screen.findByText('會員已載入');for(const label of ['更新聯絡資料','刪除聯絡資料','更新會員角色'])fireEvent.click(screen.getByRole('button',{name:label}));
 await waitFor(()=>expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method)).toHaveLength(3));const writes=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method);expect(writes.map(([url,init])=>[url,init?.method])).toEqual([['/api/potential-members/potential-id','PATCH'],['/api/potential-members/potential-id','DELETE'],['/api/user-roles/user-id','PUT']]);for(const [,init] of writes)expect(new Headers(init?.headers).get('X-WeChurch-Church')).toBe(encodeURIComponent('火樂'));
});
