/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { createQueryClient, queryClient as personalClient } from '@/lib/queryClient';
import { churchScopeKey, setChurchScope, subscribeChurchScope } from '@/lib/churchFetch';

export type ChurchContextData = { actorChurch:string|null; selectedChurch:string|null; isSystemAdmin:boolean; allowedOptions:{id:string;name:string}[]; requiresApproval:boolean };
type ChurchState = { data:ChurchContextData|null; loading:boolean; error:string; identity:string; selectChurch:(id:string)=>Promise<void>; refreshChurch:()=>Promise<void> };
const Context = createContext<ChurchState | null>(null);
export function useChurchContext() { return useContext(Context); }
export function useChurchScopeKey() { return useSyncExternalStore(subscribeChurchScope,churchScopeKey,churchScopeKey); }
export function ChurchProvider({children}:{children:ReactNode}) {
  const {user,loading:authLoading,refreshAuth} = useAuth();
  const actorId = user?.id;
  const actor = JSON.stringify([user?.id ?? null,user?.church ?? null,user?.role ?? null]);
  const latestActor=useRef(actor);latestActor.current=actor;
  const [result,setResult] = useState<{actor:string;data:ChurchContextData|null;loading:boolean;error:string}>({actor:'',data:null,loading:true,error:''});
  const serial = useRef(0); const controller = useRef<AbortController>(); const selected = useRef<string|null>(null);
  const data = result.actor === actor ? result.data : null;
  const loading = authLoading || result.actor !== actor || result.loading;
  const identity = JSON.stringify([user?.id ?? null,data?.actorChurch ?? null,data?.selectedChurch ?? null]);
  const tenantClient = useMemo(() => createQueryClient(identity),[identity]);
  const activeClient = useRef(tenantClient); activeClient.current=tenantClient;
  useEffect(() => () => { void tenantClient.cancelQueries(); tenantClient.clear(); },[tenantClient]);
  const load = useCallback(async (church: string|null = null) => {
    const attempt=++serial.current;controller.current?.abort();controller.current=new AbortController();
    setChurchScope(null);void activeClient.current.cancelQueries();activeClient.current.clear();
    if (!actorId) { selected.current=null;setResult({actor,data:null,loading:false,error:''}); return; }
    setResult(previous=>({...previous,actor,loading:true,error:''}));
    try {
      const response=await globalThis.fetch('/api/church-context',{credentials:'include',cache:'no-store',signal:controller.current.signal,...(church ? {headers:{'X-WeChurch-Church':encodeURIComponent(church)}} : {})});
      if(attempt!==serial.current)return;
      if(!response.ok)throw new Error(response.status===401?'請重新登入以確認教會歸屬。':response.status===403?'無法使用此教會，請聯繫管理者核定。':'教會資料載入失敗，請重試。');
      const next:ChurchContextData=await response.json();if(attempt!==serial.current)return;
      if(!Array.isArray(next.allowedOptions)||typeof next.isSystemAdmin!=='boolean'||typeof next.requiresApproval!=='boolean'||(next.selectedChurch!==null&&!next.allowedOptions.some(option=>option.id===next.selectedChurch))||(!next.isSystemAdmin&&next.selectedChurch!==next.actorChurch)|| (church && next.selectedChurch!==church))throw new Error('無法確認教會範圍，請重試。');
      selected.current=next.selectedChurch;
      setChurchScope({actorId,actorChurch:next.actorChurch,selectedChurch:next.selectedChurch,isSystemAdmin:next.isSystemAdmin});
      setResult({actor,data:next,loading:false,error:''});
    }catch(error){if(attempt===serial.current&&!controller.current?.signal.aborted)setResult({actor,data:null,loading:false,error:(error as Error).message});}
  // Client lifetime is intentionally separate: re-keying after verification must not re-fetch context in a loop.
  },[actor,actorId]);
  const stop=useCallback(()=>{serial.current++;controller.current?.abort();},[]);
  useEffect(()=>{if(authLoading)return;selected.current=null;void load();return()=>{stop();setChurchScope(null,false);};},[actor,authLoading,load,stop]);
  const selectChurch=async(id:string)=>{if(data?.isSystemAdmin&&data.allowedOptions.some(option=>option.id===id)&&id!==data.selectedChurch)await load(id);};
  const refreshChurch=async()=>{await refreshAuth?.();if(latestActor.current!==actor)return;await load(data?.isSystemAdmin?selected.current:null);};
  const value={data,loading,error:result.actor===actor?result.error:'',identity,selectChurch,refreshChurch};
  return <Context.Provider value={value}><QueryClientProvider client={tenantClient}>{children}</QueryClientProvider></Context.Provider>;
}
export function ChurchPageBoundary({children,personal=false,allowPendingOwner=false}:{children:ReactNode;personal?:boolean;allowPendingOwner?:boolean}) {
  const church=useChurchContext();
  if(personal || !church)return <QueryClientProvider client={personalClient}>{children}</QueryClientProvider>;
  if(church.loading)return <section role="status" className="mx-auto max-w-lg p-6">正在確認教會歸屬…</section>;
  if(church.error)return <section role="alert" className="mx-auto max-w-lg space-y-3 p-6"><p>{church.error}</p><button type="button" className="min-h-11 underline" onClick={()=>void church.refreshChurch()}>重新確認教會</button></section>;
  if(church.data?.isSystemAdmin&&!church.data.selectedChurch)return <section role="status" className="mx-auto max-w-lg p-6">請先選擇目前教會，確認要管理的分享牆、小家與課表。</section>;
  if(church.data?.requiresApproval&&!allowPendingOwner)return <section className="mx-auto max-w-lg space-y-3 p-6"><h1 className="text-lg font-semibold">等待教會核定</h1><p>你的教會歸屬需要管理者核定，核定後即可使用教會的分享牆、小家與課表。個人筆記與聖經仍可使用。</p><a href="/learn/my-notes" className="mr-4 inline-flex min-h-11 items-center underline">個人筆記</a><a href="/learn/bible" className="inline-flex min-h-11 items-center underline">聖經</a><button className="block min-h-11 underline" onClick={()=>void church.refreshChurch()}>核定後重新確認</button></section>;
  return <div key={church.identity}>{children}</div>;
}
