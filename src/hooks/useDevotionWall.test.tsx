// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider,focusManager} from '@tanstack/react-query';
import {useDevotionWall} from './useDevotionWall';
import {devotionDayWindow} from '@shared/devotionWall';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'actor'}})}));
let client:QueryClient;
afterEach(()=>{cleanup();client?.clear();focusManager.setFocused(undefined);vi.unstubAllGlobals();vi.useRealTimers();});
function Feed({enabled=true,mine=false,windowOnly=false}:{enabled?:boolean;mine?:boolean;windowOnly?:boolean}){const wall=useDevotionWall(windowOnly,mine,enabled);return <div>{wall.posts.map(p=><p key={p.id}>{p.body}</p>)}{wall.expired && <span>EXPIRED</span>}{wall.hasNextPage && <button disabled={wall.isFetching} onClick={()=>wall.fetchNextPage()}>MORE</button>}<button onClick={()=>client.invalidateQueries({queryKey:['devotion-wall']})}>INVALIDATE</button></div>;}
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
it.each([false,true])('loads older shares only on demand, including mine=%s',async(mine)=>{
  vi.useFakeTimers(); const paths:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>{
    paths.push(path);const older=new URL(path,'http://local').searchParams.has('cursor');
    return {ok:true,json:async()=>({...devotionDayWindow(new Date()),posts:[{id:older?'old':'new',body:older?'OLDER':'NEWER'}],nextCursor:older?null:'next-page'})};
  }));
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});render(<QueryClientProvider client={client}><Feed mine={mine} /></QueryClientProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(20);});
  expect(paths).toEqual([`/api/devotion-wall${mine?'/mine':''}?limit=30`]);expect(screen.queryByText('OLDER')).toBeNull();
  fireEvent.click(screen.getByText('MORE'));await act(async()=>{await vi.advanceTimersByTimeAsync(20);});
  expect(screen.getByText('NEWER')).toBeTruthy();expect(screen.getByText('OLDER')).toBeTruthy();expect(screen.queryByText('MORE')).toBeNull();
});
it('polls at 45s only while focused and refreshes immediately on focus',async()=>{
  vi.useFakeTimers();focusManager.setFocused(true);
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({...devotionDayWindow(new Date()),posts:[],nextCursor:null})})));
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});render(<QueryClientProvider client={client}><Feed /></QueryClientProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(fetch).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(15020);});expect(fetch).toHaveBeenCalledTimes(2);
  act(()=>focusManager.setFocused(false));await act(async()=>{await vi.advanceTimersByTimeAsync(90000);});expect(fetch).toHaveBeenCalledTimes(2);
  await act(async()=>{focusManager.setFocused(true);await vi.advanceTimersByTimeAsync(20);});expect(fetch).toHaveBeenCalledTimes(3);
});
it('keeps window-only requests separate and without pagination',async()=>{
  vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>devotionDayWindow(new Date())})));
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});render(<QueryClientProvider client={client}><Feed windowOnly /></QueryClientProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(20);});expect(fetch).toHaveBeenCalledWith('/api/devotion-wall/window',expect.anything());expect(screen.queryByText('MORE')).toBeNull();
});
it('refreshes loaded pages on withdrawal invalidation instead of retaining a withdrawn post',async()=>{
  vi.useFakeTimers();let withdrawn=false;
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({...devotionDayWindow(new Date()),posts:withdrawn?[]:[{id:'one',body:'WITHDRAW ME'}],nextCursor:null})})));
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});render(<QueryClientProvider client={client}><Feed /></QueryClientProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(20);});expect(screen.getByText('WITHDRAW ME')).toBeTruthy();withdrawn=true;
  fireEvent.click(screen.getByText('INVALIDATE'));await act(async()=>{await vi.advanceTimersByTimeAsync(20);});expect(screen.queryByText('WITHDRAW ME')).toBeNull();
});
