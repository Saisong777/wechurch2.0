// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {useDevotionWall} from './useDevotionWall';
import {devotionDayWindow} from '@shared/devotionWall';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'actor'}})}));
let client:QueryClient;
afterEach(()=>{cleanup();client?.clear();vi.unstubAllGlobals();vi.useRealTimers();});
function Feed({enabled=true}:{enabled?:boolean}){const wall=useDevotionWall(false,false,enabled);return <div>{wall.posts.map(p=><p key={p.id}>{p.body}</p>)}{wall.expired && <span>EXPIRED</span>}</div>;}
it('removes yesterday content while open even if midnight refresh is offline',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-11T15:59:59Z'));
  let requests=0;vi.stubGlobal('fetch',vi.fn(async()=>{
    requests++;if(requests>1)throw new Error('offline');
    return {ok:true,json:async()=>({...devotionDayWindow(new Date()),posts:[{id:'post',body:'YESTERDAY ONLY'}]})};
  }));
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});render(<QueryClientProvider client={client}><Feed /></QueryClientProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(20);});expect(screen.getByText('YESTERDAY ONLY')).toBeTruthy();
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});expect(screen.queryByText('YESTERDAY ONLY')).toBeNull();expect(screen.getByText('EXPIRED')).toBeTruthy();expect(requests).toBeGreaterThan(1);
});
it('does not poll the public wall while audience selection uses groups',async()=>{
  vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn());
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  render(<QueryClientProvider client={client}><Feed enabled={false} /></QueryClientProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(31000);});
  expect(fetch).not.toHaveBeenCalled();
});
