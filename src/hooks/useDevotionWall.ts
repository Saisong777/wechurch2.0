import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { wallTimeRemaining, type DevotionWallFeed } from '@shared/devotionWall';
import { toast } from 'sonner';

export async function devotionWallApi<T>(path='',method='GET',body?:unknown,signal?:AbortSignal):Promise<T> {
  const response=await fetch(`/api/devotion-wall${path}`,{method,credentials:'include',signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error || '尚未完成，請重試。');return data;
}
type TimedFeed = DevotionWallFeed & { receivedAt:number;receivedTick:number };
export function useDevotionWall(windowOnly=false,mineOnly=false,enabled=true) {
  const {user}=useAuth();const [,tick]=useState(0);
  const query=useInfiniteQuery({queryKey:['devotion-wall',user?.id,windowOnly?'window':mineOnly?'mine':'feed','pages'],enabled:!!user && enabled,retry:false,
    initialPageParam:null as string|null,
    getNextPageParam:(last:TimedFeed)=>windowOnly?undefined:last.nextCursor || undefined,
    staleTime:30000,refetchInterval:45000,refetchIntervalInBackground:false,refetchOnWindowFocus:'always',
    queryFn:async({pageParam,signal}):Promise<TimedFeed>=>{
    const parameters=new URLSearchParams({limit:'30'});if(pageParam)parameters.set('cursor',pageParam);
    const start=performance.now();const data=await devotionWallApi<DevotionWallFeed>(windowOnly?'/window':`${mineOnly?'/mine':''}?${parameters}`,'GET',undefined,signal);
    // Count the request duration too, so a slow response cannot extend its lifetime.
    return {...data,receivedAt:Date.now()-(performance.now()-start),receivedTick:start};
  }});
  const data=query.data?.pages[0];
  const remaining=data?wallTimeRemaining(data,Math.max(Date.now()-data.receivedAt,performance.now()-data.receivedTick)):0;
  useEffect(()=>{
    if(!enabled)return;
    const refresh=()=>{tick(n=>n+1);};const timer=window.setInterval(refresh,1000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[enabled]);
  const expired=!!data && remaining===0;
  const {refetch}=query;
  useEffect(()=>{if(enabled && expired)void refetch();},[enabled,expired,refetch]);
  const posts=!query.isError && !expired ? (query.data?.pages || []).filter(page=>page.day===data?.day).flatMap(page=>page.posts || []) : [];
  return {...query,data,expired,posts,hasNextPage:!expired && query.hasNextPage};
}
export function useWithdrawDevotionShare() {
  const client=useQueryClient();
  return useMutation({mutationFn:(id:string)=>devotionWallApi(`/${id}`,'DELETE'),onSuccess:async()=>{await client.invalidateQueries({queryKey:['devotion-wall']});toast.success('已撤回公開分享，個人筆記仍保留');},onError:(e:Error)=>toast.error(e.message)});
}
