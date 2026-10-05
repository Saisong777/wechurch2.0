// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { PrayerComments } from './PrayerComments';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'actor'}})}));
vi.mock('@/hooks/useUserRole',()=>({useUserRole:()=>({isAdmin:false})}));
vi.mock('@/hooks/useAccessControl',()=>({useAccessControl:()=>({data:undefined})}));
let fail=false; let getFail=false; let posts:Record<string,unknown>[]=[]; let rows:Record<string,unknown>[]=[]; const clients:QueryClient[]=[];
beforeEach(()=>{fail=false;getFail=false;posts=[];rows=[];localStorage.clear();vi.stubGlobal('fetch',vi.fn(async(_path:string,options?:RequestInit)=>{
  if(options?.method==='POST'){
    const input=JSON.parse(options.body as string);posts.push(input);
    if(fail) return {ok:false,json:async()=>({error:'測試連線失敗'})};
    const comment={...input,id:'comment',authorName:'匿名發文者',isOwner:true,isAnonymous:true,createdAt:new Date().toISOString()};rows=[comment];
    return {ok:true,json:async()=>comment};
  }
  if(options?.method==='DELETE'){rows=[];return {ok:true,json:async()=>({ok:true})};}
  if(getFail)return {ok:false,json:async()=>({error:'測試讀取失敗'})};
  return {ok:true,json:async()=>rows};
}));});
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
function show(readOnly=false,targetCommentId='',enabled=true){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(client);const component=(active:boolean,closed:boolean)=><QueryClientProvider client={client}><PrayerComments prayerId="prayer" anonymousOwner count={2} readOnly={closed} enabled={active} targetCommentId={targetCommentId} /></QueryClientProvider>;const view=render(component(enabled,readOnly));return {setState:(active:boolean,closed=readOnly)=>view.rerender(component(active,closed))};}
async function composerReady(){await screen.findByRole('textbox',{name:'回應內容'});}
it('loads visible inline conversations without an extra button and leaves disabled threads idle', async()=>{
  const view=show(false,'',false);expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:/寫下鼓勵|查看回應|收起回應/})).toBeNull();
  view.setState(true);await waitFor(()=>expect(fetch).toHaveBeenCalled());
  expect(screen.getByRole('textbox',{name:'回應內容'})).toBeVisible();
});
it('keeps failed text without local success and reuses the receipt key when retrying',async()=>{
  show();await composerReady();fail=true;
  fireEvent.change(screen.getByRole('textbox',{name:'回應內容'}),{target:{value:'願你有平安'}});
  fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await screen.findByRole('alert');expect(rows).toHaveLength(0);expect(localStorage.length).toBe(0);
  expect((screen.getByRole('textbox',{name:'回應內容'}) as HTMLTextAreaElement).value).toBe('願你有平安');
  fail=false;fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await waitFor(()=>expect((screen.getByRole('textbox',{name:'回應內容'}) as HTMLTextAreaElement).value).toBe(''));
  expect(posts).toHaveLength(2);expect(posts[0].requestId).toBe(posts[1].requestId);
});
it('sends the chosen sticker as structured content and preserves anonymous author display',async()=>{
  show();await composerReady();expect(screen.getByText('以匿名發文者回應')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox',{name:'回應內容'}),{target:{value:'送貼圖後仍保留的文字'}});
  fireEvent.click(screen.getByRole('radio',{name:'貼圖'}));
  fireEvent.click(screen.getByRole('radio',{name:'願你平安'}));fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await screen.findByText('匿名發文者');expect(posts[0]).toMatchObject({kind:'sticker',sticker:'peace',content:''});expect(posts[0].userId).toBeUndefined();
  await waitFor(()=>expect(screen.getByRole('radio',{name:'鼓勵'})).not.toBeDisabled());
  fireEvent.click(screen.getByRole('radio',{name:'鼓勵'}));
  expect(screen.getByRole('textbox',{name:'回應內容'})).toHaveValue('送貼圖後仍保留的文字');
});
it('supports longer prayer words and keeps text rendering literal',async()=>{
  show();await composerReady();fireEvent.click(screen.getByRole('radio',{name:'經文'}));
  fireEvent.change(screen.getByRole('textbox',{name:'回應內容'}),{target:{value:'<script>literal words</script>'}});fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await screen.findByText('<script>literal words</script>');expect(document.querySelector('script')).toBeNull();expect(posts[0].kind).toBe('scripture');
});
it('preserves a draft when switching response kinds or collapsing and does not send on selection',async()=>{
  const view=show();await composerReady();
  fireEvent.change(screen.getByRole('textbox',{name:'回應內容'}),{target:{value:'尚未送出的鼓勵'}});
  fireEvent.click(screen.getByRole('radio',{name:'貼圖'}));
  fireEvent.click(screen.getByRole('radio',{name:'與你同行'}));
  expect(posts).toHaveLength(0);
  view.setState(false);view.setState(true);
  expect(screen.getByRole('radio',{name:'與你同行'})).toBeChecked();
  fireEvent.click(screen.getByRole('radio',{name:'禱告'}));
  expect(screen.getByRole('textbox',{name:'回應內容'})).toHaveValue('尚未送出的鼓勵');
  fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await waitFor(()=>expect(posts).toHaveLength(1));
  expect(posts[0]).toMatchObject({kind:'prayer',content:'尚未送出的鼓勵'});
});
it('retains read-only history without a composer on completed prayers',async()=>{
  show(true);
  await screen.findByText('還沒有回應');
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button',{name:'送出回應'})).toBeNull();
});
it('expands and focuses a notified reply rather than focusing the composer',async()=>{
  rows=[{id:'target',authorName:'家人',kind:'encouragement',content:'這則鼓勵',createdAt:new Date().toISOString()}];show(false,'target');
  const body=await screen.findByText('這則鼓勵');await waitFor(() => expect(body.closest('article')).toHaveFocus());
  expect(screen.getByRole('textbox',{name:'回應內容'})).not.toHaveFocus();expect(screen.queryByRole('dialog')).toBeNull();
});

it('puts existing encouragement before the directly visible composer and supports withdrawal cancellation', async () => {
  rows=[{id:'owned',authorName:'家人',kind:'encouragement',content:'與你一同守望',isOwner:true,createdAt:new Date().toISOString()}];show();
  const comment=await screen.findByText('與你一同守望');const composer=screen.getByRole('textbox',{name:'回應內容'});
  expect(comment.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button',{name:'撤回回應'}));expect(fetch).not.toHaveBeenCalledWith(expect.anything(),expect.objectContaining({method:'DELETE'}));
  confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'撤回回應'}));
  await waitFor(()=>expect(screen.queryByText('與你一同守望')).toBeNull());confirm.mockRestore();
});
it('retains a failed draft through hidden and read-only states without posting again', async () => {
  const view=show();await composerReady();fail=true;
  fireEvent.change(screen.getByRole('textbox',{name:'回應內容'}),{target:{value:'私人未送出的鼓勵'}});
  fireEvent.click(screen.getByRole('button',{name:'送出回應'}));await screen.findByRole('alert');
  view.setState(false);view.setState(true,true);
  expect(screen.queryByRole('textbox')).toBeNull();expect(screen.queryByRole('button',{name:'送出回應'})).toBeNull();expect(posts).toHaveLength(1);
  view.setState(true,false);expect(screen.getByRole('textbox',{name:'回應內容'})).toHaveValue('私人未送出的鼓勵');
  fail=false;fireEvent.click(screen.getByRole('button',{name:'送出回應'}));await waitFor(()=>expect(posts).toHaveLength(2));expect(posts[0].requestId).toBe(posts[1].requestId);
});
it('does not poll twenty collapsed mobile threads and can retry a visible thread read failure', async () => {
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);
  const view=render(<QueryClientProvider client={client}>{Array.from({length:20},(_,i)=><PrayerComments key={i} prayerId={'hidden-'+i} enabled={false}/>)}</QueryClientProvider>);
  expect(fetch).not.toHaveBeenCalled();view.unmount();getFail=true;show();
  await screen.findByText('回應載入失敗。');getFail=false;fireEvent.click(screen.getByRole('button',{name:'重新載入'}));await screen.findByText('還沒有回應');
});
