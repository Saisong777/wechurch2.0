import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { wallTimeRemaining, type DevotionWallFeed } from '@shared/devotionWall';
import { toast } from 'sonner';

export async function devotionWallApi<T>(path='',method='GET',body?:unknown):Promise<T> {
  const response=await fetch(`/api/devotion-wall${path}`,{method,credentials:'include',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error || '尚未完成，請重試。');return data;
}
type TimedFeed = DevotionWallFeed & { receivedAt:number;receivedTick:number };
export function useDevotionWall(windowOnly=false,mineOnly=false) {
  const {user}=useAuth();const [,tick]=useState(0);
  const query=useQuery<TimedFeed>({queryKey:['devotion-wall',user?.id,windowOnly?'window':mineOnly?'mine':'feed'],enabled:!!user,retry:false,refetchInterval:15000,queryFn:async()=>{
    const start=performance.now();const data=await devotionWallApi<DevotionWallFeed>(windowOnly?'/window':mineOnly?'/mine':'');
    // Count the request duration too, so a slow response cannot extend its lifetime.
    return {...data,receivedAt:Date.now()-(performance.now()-start),receivedTick:start};
  }});
  const data=query.data;
  const remaining=data?wallTimeRemaining(data,Math.max(Date.now()-data.receivedAt,performance.now()-data.receivedTick)):0;
  useEffect(()=>{
    const refresh=()=>{tick(n=>n+1);};const timer=window.setInterval(refresh,1000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const expired=!!data && remaining===0;
  useEffect(()=>{if(expired)void query.refetch();},[expired,query.refetch]);
  return {...query,expired,posts:!query.isError && !expired ? data?.posts || [] : []};
}
export function useWithdrawDevotionShare() {
  const client=useQueryClient();
  return useMutation({mutationFn:(id:string)=>devotionWallApi(`/${id}`,'DELETE'),onSuccess:async()=>{await client.invalidateQueries({queryKey:['devotion-wall']});toast.success('已撤回公開分享，個人筆記仍保留');},onError:(e:Error)=>toast.error(e.message)});
}
