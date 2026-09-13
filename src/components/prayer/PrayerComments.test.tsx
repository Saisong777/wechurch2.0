// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { PrayerComments } from './PrayerComments';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'actor'}})}));
vi.mock('@/hooks/useUserRole',()=>({useUserRole:()=>({isAdmin:false})}));
let fail=false; let posts:any[]=[]; let rows:any[]=[]; const clients:QueryClient[]=[];
beforeEach(()=>{fail=false;posts=[];rows=[];localStorage.clear();vi.stubGlobal('fetch',vi.fn(async(_path:string,options?:RequestInit)=>{
  if(options?.method==='POST'){
    const input=JSON.parse(options.body as string);posts.push(input);
    if(fail) return {ok:false,json:async()=>({error:'測試連線失敗'})};
    const comment={...input,id:'comment',authorName:'匿名發文者',isOwner:true,isAnonymous:true,createdAt:new Date().toISOString()};rows=[comment];
    return {ok:true,json:async()=>comment};
  }
  return {ok:true,json:async()=>rows};
}));});
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
function show(){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(client);render(<QueryClientProvider client={client}><PrayerComments prayerId="prayer" anonymousOwner count={2} /></QueryClientProvider>);}
async function expand(){fireEvent.click(screen.getByRole('button',{name:'鼓勵與禱告 · 2'}));await screen.findByRole('textbox',{name:'回應內容'});}
it('does not fetch every collapsed conversation',()=>{
  show();expect(fetch).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'鼓勵與禱告 · 2'})).toBeTruthy();
});
it('keeps failed text without local success and reuses the receipt key when retrying',async()=>{
  show();await expand();fail=true;
  fireEvent.change(screen.getByRole('textbox',{name:'回應內容'}),{target:{value:'願你有平安'}});
  fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await screen.findByRole('alert');expect(rows).toHaveLength(0);expect(localStorage.length).toBe(0);
  expect((screen.getByRole('textbox',{name:'回應內容'}) as HTMLTextAreaElement).value).toBe('願你有平安');
  fail=false;fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await waitFor(()=>expect((screen.getByRole('textbox',{name:'回應內容'}) as HTMLTextAreaElement).value).toBe(''));
  expect(posts).toHaveLength(2);expect(posts[0].requestId).toBe(posts[1].requestId);
});
it('sends the chosen sticker as structured content and preserves anonymous author display',async()=>{
  show();await expand();expect(screen.getByText('以匿名發文者回應')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox',{name:'回應類型'}),{target:{value:'sticker'}});
  fireEvent.click(screen.getByRole('radio',{name:'願你平安'}));fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await screen.findByText('匿名發文者');expect(posts[0]).toMatchObject({kind:'sticker',sticker:'peace',content:''});expect(posts[0].userId).toBeUndefined();
});
it('supports longer prayer words and keeps text rendering literal',async()=>{
  show();await expand();fireEvent.change(screen.getByRole('combobox',{name:'回應類型'}),{target:{value:'scripture'}});
  fireEvent.change(screen.getByRole('textbox',{name:'回應內容'}),{target:{value:'<script>literal words</script>'}});fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await screen.findByText('<script>literal words</script>');expect(document.querySelector('script')).toBeNull();expect(posts[0].kind).toBe('scripture');
});
