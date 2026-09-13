// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {DevotionWallShareDialog} from './DevotionWallShareDialog';
import {DEVOTION_SHARE_MAX_LENGTH,devotionDayWindow,type DevotionShareDraft} from '@shared/devotionWall';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'actor'}})}));
const clients:QueryClient[]=[];let payload:any;let fail=false;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class { observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn(); });});
beforeEach(()=>{payload=undefined;fail=false;vi.stubGlobal('fetch',vi.fn(async(_path:string,options?:RequestInit)=>{
  if(options?.method==='POST'){payload=JSON.parse(options.body as string);return {ok:!fail,json:async()=>fail?{error:'尚未分享'}:{id:'posted'}};}
  return {ok:true,json:async()=>devotionDayWindow(new Date())};
}));});
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
function show(patch:Partial<DevotionShareDraft>={}){const close=vi.fn();const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<QueryClientProvider client={client}><MemoryRouter><DevotionWallShareDialog draft={{sourceId:'00000000-0000-4000-8000-000000000001',title:'心得',body:'選擇的領受',reference:'詩篇 23',...patch}} close={close} /></MemoryRouter></QueryClientProvider>);return close;}
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
