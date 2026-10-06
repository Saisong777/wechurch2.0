// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {DevotionWallShareDialog} from './DevotionWallShareDialog';
import {DEVOTION_SHARE_MAX_LENGTH,devotionDayWindow,type DevotionShareDraft} from '@shared/devotionWall';
import {GROUP_SHARE_MAX_LENGTH} from '@shared/lifeGroup';
const auth=vi.hoisted(()=>({user:{id:'actor'} as {id:string}|null}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:auth.user})}));
const clients:QueryClient[]=[];let payload:any;let fail=false;
let groupFail=false;let groupLoadFail=false;
let groupList:Array<{id:string;name:string}>=[];
let groupWrites:Array<{path:string;body:Record<string,unknown>}>=[];
const firstGroup='00000000-0000-4000-8000-000000000002';
const secondGroup='00000000-0000-4000-8000-000000000003';
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class { observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn(); });});
beforeEach(()=>{auth.user={id:'actor'};payload=undefined;fail=false;groupFail=false;groupLoadFail=false;groupWrites=[];groupList=[{id:firstGroup,name:'同行小家'},{id:secondGroup,name:'盼望小家'}];vi.stubGlobal('fetch',vi.fn(async(_path:string,options?:RequestInit)=>{
  if(options?.method==='PUT'){
    const input=JSON.parse(options.body as string);
    if(input.group)groupWrites.push({path:_path,body:input});
    if(input.wall)payload={...input,anonymous:input.wall.anonymous};
    const failed=(input.group && groupFail)||(input.wall && fail);
    return {ok:!failed,json:async()=>failed?{error:'分享暫時失敗'}:{requestId:'posted'}};
  }
  if(_path==='/api/life-groups')return {ok:!groupLoadFail,json:async()=>groupLoadFail?{error:'讀取失敗'}:{groups:groupList}};
  return {ok:true,json:async()=>devotionDayWindow(new Date())};
}));});
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
function show(patch:Partial<DevotionShareDraft>={},allowGroup=false){const close=vi.fn();const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<QueryClientProvider client={client}><MemoryRouter><DevotionWallShareDialog draft={{sourceId:'00000000-0000-4000-8000-000000000001',title:'心得',body:'選擇的領受',reference:'詩篇 23',...patch}} close={close} allowGroup={allowGroup} /></MemoryRouter></QueryClientProvider>);return close;}
const consent=()=>screen.getByRole('checkbox',{name:/我同意公開以上內容/});
it('requires preview consent and sends only the explicit excerpt',async()=>{
  const close=show();await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
  expect((screen.getByRole('button',{name:'確認公開分享'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(consent());fireEvent.change(screen.getByRole('textbox',{name:'公開心得'}),{target:{value:'只分享這段'}});
  expect((consent() as HTMLInputElement).checked).toBe(false);
  fireEvent.click(consent());fireEvent.click(screen.getByRole('button',{name:'確認公開分享'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(payload.body).toBe('只分享這段');expect(payload).not.toHaveProperty('actionPlan');expect(payload).not.toHaveProperty('userId');
});
it('retains the edited preview and consent on failed sharing',async()=>{
  fail=true;const close=show();await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());fireEvent.click(consent());fireEvent.click(screen.getByRole('button',{name:'確認公開分享'}));
  await screen.findByRole('alert');expect(close).not.toHaveBeenCalled();expect((screen.getByRole('textbox',{name:'公開心得'}) as HTMLTextAreaElement).value).toBe('選擇的領受');
});
const sections = [
  {key:'observation',label:'看見',text:'看見的原文'},
  {key:'insight:GOD_ATTRIBUTE',label:'領受',text:'領受的原文'},
  {key:'actionPlan',label:'回應',text:'私人回應'},
];
it('selects all parts only after an explicit choice and sends the exact preview',async()=>{
  const close=show({sections});await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
  expect(screen.getByRole('checkbox',{name:'看見'})).not.toBeChecked();
  expect(screen.getByRole('checkbox',{name:'回應'})).not.toBeChecked();
  expect(screen.getByRole('checkbox',{name:'全部分享'})).not.toBeChecked();
  expect(screen.getByRole('region',{name:'公開內容預覽'})).not.toHaveTextContent('私人回應');
  fireEvent.click(consent());
  fireEvent.click(screen.getByRole('checkbox',{name:'全部分享'}));
  expect(consent()).not.toBeChecked();
  const expected='看見\n看見的原文\n\n領受\n領受的原文\n\n回應\n私人回應';
  expect(screen.getByRole('region',{name:'公開內容預覽'})).toHaveTextContent('私人回應');
  fireEvent.click(screen.getByRole('checkbox',{name:'匿名分享'}));fireEvent.click(consent());
  fireEvent.click(screen.getByRole('button',{name:'確認公開分享'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());
  expect(payload.body).toBe(expected);expect(payload.anonymous).toBe(true);
  expect(payload).not.toHaveProperty('sections');
});
it('shares only selected edited parts and preserves edits when toggling them off and on',async()=>{
  const close=show({sections});await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
  fireEvent.click(screen.getByRole('checkbox',{name:'看見'}));
  fireEvent.change(screen.getByRole('textbox',{name:'看見內容'}),{target:{value:'只公開一小段'}});
  fireEvent.click(consent());
  fireEvent.click(screen.getByRole('checkbox',{name:'看見'}));
  expect(consent()).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox',{name:'看見'}));
  expect(screen.getByRole('textbox',{name:'看見內容'})).toHaveValue('只公開一小段');
  fireEvent.click(screen.getByRole('checkbox',{name:'領受'}));fireEvent.click(consent());
  fireEvent.click(screen.getByRole('button',{name:'確認公開分享'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());
  expect(payload.body).toBe('看見\n只公開一小段');expect(payload.body).not.toContain('私人回應');
});
it('blocks empty and oversized selections without truncating the originals',async()=>{
  show({sections});await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
  fireEvent.click(screen.getByRole('checkbox',{name:'領受'}));fireEvent.click(consent());
  expect(screen.getByRole('button',{name:'確認公開分享'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:'領受'}));
  fireEvent.change(screen.getByRole('textbox',{name:'領受內容'}),{target:{value:'長'.repeat(DEVOTION_SHARE_MAX_LENGTH+1)}});
  fireEvent.click(consent());
  expect(screen.getByRole('button',{name:'確認公開分享'})).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('超過字數上限');
  expect(screen.getByRole('textbox',{name:'領受內容'})).toHaveValue('長'.repeat(DEVOTION_SHARE_MAX_LENGTH+1));
  expect(payload).toBeUndefined();
});

const groupConsent=()=>screen.getByRole('checkbox',{name:/我同意將以上內容分享給所選小家/});
const chooseGroup=async(id=firstGroup)=>{
  await screen.findByRole('option',{name:'同行小家'});
  fireEvent.change(screen.getByRole('combobox',{name:'選擇所屬小家'}),{target:{value:id}});
};

it('defaults to own groups and sends only selected text without publishing to the wall',async()=>{
  const close=show({sections},true);
  await chooseGroup();
  expect(screen.getByRole('checkbox',{name:'所屬小家'})).toBeChecked();
  expect(screen.queryByRole('checkbox',{name:'匿名分享'})).toBeNull();
  expect(screen.getByRole('button',{name:'確認分享至小家'})).toBeDisabled();
  expect(vi.mocked(fetch).mock.calls.some(([path])=>String(path).includes('/api/devotion-wall'))).toBe(false);
  fireEvent.change(screen.getByRole('textbox',{name:'領受內容'}),{target:{value:'只分享這段领受'}});
  fireEvent.click(groupConsent());fireEvent.click(screen.getByRole('button',{name:'確認分享至小家'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());
  expect(groupWrites).toHaveLength(1);
  expect(groupWrites[0].path).toMatch(/^\/api\/devotion-wall\/shares\/[a-f0-9-]{36}$/);
  expect(groupWrites[0].body).toEqual({group:{groupId:firstGroup},sourceId:'00000000-0000-4000-8000-000000000001',title:'心得',body:'領受\n只分享這段领受',reference:'詩篇 23',consent:true});
  expect(payload).toBeUndefined();
});

it('resets consent when changing group or audience and publishes only to the selected destination',async()=>{
  const close=show({sections},true);await chooseGroup();fireEvent.click(groupConsent());
  fireEvent.change(screen.getByRole('combobox',{name:'選擇所屬小家'}),{target:{value:secondGroup}});
  expect(groupConsent()).not.toBeChecked();fireEvent.click(groupConsent());
  fireEvent.click(screen.getByRole('checkbox',{name:'所屬小家'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'所有人・靈修牆'}));
  expect(consent()).not.toBeChecked();
  await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
  fireEvent.click(screen.getByRole('checkbox',{name:'匿名分享'}));
  fireEvent.click(consent());fireEvent.click(screen.getByRole('button',{name:'確認公開分享'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());
  expect(payload.anonymous).toBe(true);expect(groupWrites).toHaveLength(0);
});

it('does not claim anonymity for a group share after switching from the wall',async()=>{
  const close=show({},true);await chooseGroup();
  fireEvent.click(screen.getByRole('checkbox',{name:'所有人・靈修牆'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'匿名分享'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'所有人・靈修牆'}));
  expect(screen.queryByRole('checkbox',{name:'匿名分享'})).toBeNull();
  fireEvent.click(groupConsent());fireEvent.click(screen.getByRole('button',{name:'確認分享至小家'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());
  expect(groupWrites[0].body).not.toHaveProperty('anonymous');expect(payload).toBeUndefined();
});

it('keeps an empty membership list private and never falls back to the wall',async()=>{
  groupList=[];show({},true);await screen.findByText('尚未加入小家。');
  fireEvent.click(groupConsent());expect(screen.getByRole('button',{name:'確認分享至小家'})).toBeDisabled();
  expect(screen.getByRole('checkbox',{name:'所屬小家'})).toBeChecked();expect(payload).toBeUndefined();
});

it('blocks group sharing on load failure and allows an explicit retry',async()=>{
  groupLoadFail=true;show({},true);await screen.findByRole('alert');
  expect(screen.getByRole('combobox',{name:'選擇所屬小家'})).toBeDisabled();
  fireEvent.click(groupConsent());expect(screen.getByRole('button',{name:'確認分享至小家'})).toBeDisabled();
  groupLoadFail=false;fireEvent.click(screen.getByRole('button',{name:'重新載入'}));await chooseGroup();
  expect(groupConsent()).not.toBeChecked();
});

it('keeps failed group previews and retries with the same operation ID',async()=>{
  groupFail=true;const close=show({},true);await chooseGroup();
  fireEvent.change(screen.getByRole('textbox',{name:'分享心得'}),{target:{value:'重試前保留內容'}});
  fireEvent.click(groupConsent());fireEvent.click(screen.getByRole('button',{name:'確認分享至小家'}));
  await screen.findByRole('alert');expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox',{name:'分享心得'})).toHaveValue('重試前保留內容');
  groupFail=false;fireEvent.click(screen.getByRole('button',{name:'確認分享至小家'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());
  expect(groupWrites).toHaveLength(2);expect(groupWrites[0]).toEqual(groupWrites[1]);expect(payload).toBeUndefined();
});

it('applies the selected destination length limit without truncating the preview',async()=>{
  show({sections},true);await chooseGroup();
  const content='長'.repeat(GROUP_SHARE_MAX_LENGTH+1);
  fireEvent.change(screen.getByRole('textbox',{name:'領受內容'}),{target:{value:content}});
  fireEvent.click(groupConsent());expect(screen.getByRole('button',{name:'確認分享至小家'})).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('超過字數上限');
  fireEvent.click(screen.getByRole('checkbox',{name:'所屬小家'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'所有人・靈修牆'}));
  await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
  expect(screen.getByRole('textbox',{name:'領受內容'})).toHaveValue(content);
  fireEvent.click(consent());expect(screen.getByRole('button',{name:'確認公開分享'})).toBeEnabled();
  expect(payload).toBeUndefined();expect(groupWrites).toHaveLength(0);
});

it('requires at least one audience and never silently publishes publicly',async()=>{
  show({},true);await chooseGroup();fireEvent.click(screen.getByRole('checkbox',{name:'所屬小家'}));
  fireEvent.click(groupConsent());expect(screen.getByRole('button',{name:'確認分享至小家'})).toBeDisabled();
  expect(payload).toBeUndefined();expect(groupWrites).toHaveLength(0);
});
it('publishes both audiences once and retries the exact operation after a failed response',async()=>{
  const close=show({sections},true);await chooseGroup();
  fireEvent.click(groupConsent());fireEvent.click(screen.getByRole('checkbox',{name:'所有人・靈修牆'}));
  const bothConsent=()=>screen.getByRole('checkbox',{name:/我同意將以上內容同時分享/});
  expect(bothConsent()).not.toBeChecked();await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
  expect(screen.getByText(/小家以你的姓名分享/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox',{name:'匿名分享'}));fireEvent.click(bothConsent());
  fail=true;fireEvent.click(screen.getByRole('button',{name:'確認同時分享'}));await screen.findByRole('alert');
  expect(close).not.toHaveBeenCalled();fail=false;fireEvent.click(screen.getByRole('button',{name:'確認同時分享'}));
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(groupWrites).toHaveLength(2);
  expect(groupWrites[0]).toEqual(groupWrites[1]);expect(groupWrites[0].body).toMatchObject({group:{groupId:firstGroup},wall:{anonymous:true}});
  expect(vi.mocked(fetch).mock.calls.filter(([,o])=>o?.method==='PUT')).toHaveLength(2);
});

it('locks the whole form while a dual destination request is pending',async()=>{
 const close=show({},true);await chooseGroup();fireEvent.click(screen.getByRole('checkbox',{name:'所有人・靈修牆'}));
 await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());
 let resolve!:()=>void;const pending=new Promise<void>(r=>{resolve=r;});
 const original=vi.mocked(fetch).getMockImplementation()!;
 vi.mocked(fetch).mockImplementation(async(path,options)=>{if(options?.method==='PUT')await pending;return original(path,options);});
 fireEvent.click(screen.getByRole('checkbox',{name:/我同意將以上內容同時分享/}));
 const button=screen.getByRole('button',{name:'確認同時分享'});fireEvent.click(button);fireEvent.click(button);
 expect(screen.getByRole('checkbox',{name:'所屬小家'})).toBeDisabled();expect(screen.getByRole('button',{name:'取消'})).toBeDisabled();
 expect(screen.getByRole('textbox',{name:'分享標題'})).toBeDisabled();expect(close).not.toHaveBeenCalled();
 resolve();await waitFor(()=>expect(close).toHaveBeenCalledOnce());
 expect(vi.mocked(fetch).mock.calls.filter(([,o])=>o?.method==='PUT')).toHaveLength(1);
});
it('clears consent and blocks a changed authenticated user or changed note in an open dialog',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);const close=vi.fn();
 const draft={sourceId:'00000000-0000-4000-8000-000000000001',title:'心得',body:'原稿',reference:'詩篇 23'};
 const view=(source=draft)=><QueryClientProvider client={client}><MemoryRouter><DevotionWallShareDialog draft={source} close={close}/></MemoryRouter></QueryClientProvider>;
 const rendered=render(view());await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());fireEvent.click(consent());
 auth.user={id:'different'};rendered.rerender(view());expect(consent()).not.toBeChecked();expect(screen.getByRole('button',{name:'確認公開分享'})).toBeDisabled();
 expect(screen.getByRole('alert')).toHaveTextContent('登入帳號已變更');
 auth.user={id:'actor'};rendered.rerender(view({...draft,sourceId:'00000000-0000-4000-8000-000000000007'}));
 fireEvent.click(consent());expect(screen.getByRole('button',{name:'確認公開分享'})).toBeDisabled();expect(screen.getByRole('alert')).toHaveTextContent('筆記已變更');
 expect(payload).toBeUndefined();
});
it('clears consent when the server day changes and reuses no old-date request',async()=>{
 show();await waitFor(()=>expect(screen.queryByText(/確認中/)).toBeNull());fireEvent.click(consent());
 const next=devotionDayWindow(new Date(Date.now()+86400000));
 const original=vi.mocked(fetch).getMockImplementation()!;
 vi.mocked(fetch).mockImplementation(async(path,options)=>String(path).includes('/window')?{ok:true,json:async()=>next} as Response:original(path,options));
 await clients[0].refetchQueries({queryKey:['devotion-wall']});
 await waitFor(()=>expect(consent()).not.toBeChecked());expect(screen.getByText(new RegExp(next.day))).toBeInTheDocument();expect(payload).toBeUndefined();
});
