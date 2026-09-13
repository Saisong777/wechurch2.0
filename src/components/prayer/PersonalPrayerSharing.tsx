import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PersonalPrayer } from '@shared/personalPrayer';
import type { GroupSummary } from '@shared/lifeGroup';
import type { PrayerShareDelivery } from '@shared/prayerSharing';

async function api<T>(path: string, method='GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials:'include', ...(body === undefined ? {} : { headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '尚未完成，請重試。');
  return data;
}
function useRefreshSharing() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({queryKey:['/api/prayer-sharing']});
    await client.invalidateQueries({queryKey:['/api/life-groups']});
    await client.invalidateQueries({queryKey:['prayer-wall']});
  };
}
export function usePrayerSharing() {
  const { user } = useAuth();
  const refresh = useRefreshSharing();
  const query = useQuery<PrayerShareDelivery[]>({queryKey:['/api/prayer-sharing',user?.id],enabled:!!user,queryFn:() => api('/api/prayer-sharing'),refetchInterval:15000,retry:false});
  const withdraw = useMutation({
    mutationFn:(share:PrayerShareDelivery) => api(`/api/prayer-sharing/${share.prayerId}/${share.destination}`,'DELETE'),
    onSuccess:async () => { await refresh(); toast.success('已撤回分享，私人原稿仍保留'); },
    onError:(e:Error) => toast.error(e.message),
  });
  return {...query,withdraw};
}
export function PrayerDeliveries({items,busy,onWithdraw}:{items:PrayerShareDelivery[];busy:boolean;onWithdraw:(item:PrayerShareDelivery)=>void}) {
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-x-4 gap-y-2 border-t px-4 py-3 text-xs">{items.map(item => <div key={item.destination} className="flex min-w-0 items-center gap-2"><Link className="break-words text-primary underline" to={item.groupId ? `/groups/${item.groupId}?view=prayer` : '/prayer-wall?view=my'}>{item.name} · {item.anonymous ? '匿名' : '具名'}</Link><Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={busy} title="撤回分享" aria-label={`撤回分享到${item.name}`} onClick={() => { if (window.confirm(`撤回分享到「${item.name}」的副本與回應？私人禱告仍保留。`)) onWithdraw(item); }}><Undo2 className="h-4 w-4" /></Button></div>)}</div>;
}
export function PersonalPrayerShareDialog({records,close,done}:{records:PersonalPrayer[];close:()=>void;done:()=>void}) {
  const {user}=useAuth();
  const refresh=useRefreshSharing();
  const [items,setItems]=useState(() => records.map(record => ({sourceId:record.id,title:record.title,body:record.prayer || record.title})));
  const [groupId,setGroupId]=useState(''); const [publicWall,setPublicWall]=useState(false); const [anonymous,setAnonymous]=useState(false);
  const [consent,setConsent]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const groups=useQuery<{groups:GroupSummary[]}>({queryKey:['/api/life-groups',user?.id,'sharing-picker'],queryFn:() => api('/api/life-groups'),enabled:!!user,retry:false});
  const groupName=groups.data?.groups.find(g=>g.id===groupId)?.name;
  const valid=!!(groupId || publicWall) && consent && items.length>0 && items.every(i=>i.title.trim() && i.body.trim());
  return <Dialog open onOpenChange={open=>{if(!open && !busy && window.confirm('關閉分享預覽？私人禱告不受影響。')) close();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl [overflow-wrap:anywhere]">
    <DialogHeader><DialogTitle>分享選取的 {items.length} 筆禱告</DialogTitle><DialogDescription>只分享以下內容；私人恩典回應不會公開。已分享的副本不會被覆蓋。</DialogDescription></DialogHeader>
    <form onSubmit={async e=>{
      e.preventDefault(); if(!valid || busy) return; setBusy(true); setError('');
      try { const result=await api<{created:number;skipped:number}>('/api/prayer-sharing','POST',{items,groupId:groupId || null,publicWall,anonymous,consent}); await refresh(); done(); toast.success(`新增 ${result.created} 份分享${result.skipped ? `，${result.skipped} 份已存在` : ''}`); }
      catch(e){setError((e as Error).message);} finally{setBusy(false);}
    }}><fieldset disabled={busy} className="min-w-0 space-y-5">
      <label className="block space-y-2 text-sm"><span>分享至小組（選填）</span><select aria-label="分享至小組" className="h-11 w-full min-w-0 rounded-md border bg-background px-3" value={groupId} onChange={e=>{setGroupId(e.target.value);setConsent(false);}}><option value="">不分享到小組</option>{groups.data?.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      {groups.isError && <p role="alert" className="text-sm text-destructive">小組載入失敗。<button type="button" className="ml-2 underline" onClick={()=>groups.refetch()}>重新載入</button></p>}
      {!groups.isPending && !groups.isError && !groups.data?.groups.length && <Link className="block text-sm text-primary underline" to="/groups">尚未加入小組</Link>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={publicWall} onChange={e=>{setPublicWall(e.target.checked);setConsent(false);}} />分享到公共禱告牆（全站登入成員可見）</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e=>{setAnonymous(e.target.checked);setConsent(false);}} />匿名分享</label>
      {anonymous && <p className="text-sm text-muted-foreground">分享中不顯示姓名、頭像或帳號識別碼；系統仍保留作者供本人管理。請移除內文中可辨認身分的細節。</p>}
      <div className="space-y-4 border-y py-4">{items.map((item,index)=><div key={item.sourceId} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0"><label className="block space-y-1 text-sm"><span>第 {index+1} 筆標題</span><Input required maxLength={160} value={item.title} onChange={e=>{setItems(items.map((v,i)=>i===index?{...v,title:e.target.value}:v));setConsent(false);}} /></label><label className="block space-y-1 text-sm"><span>第 {index+1} 筆分享內容</span><Textarea rows={4} required maxLength={10000} value={item.body} onChange={e=>{setItems(items.map((v,i)=>i===index?{...v,body:e.target.value}:v));setConsent(false);}} /></label></div>)}</div>
      <p className="text-sm font-medium">分享對象：{[groupName,publicWall?'公共禱告牆':null].filter(Boolean).join('、') || '尚未選擇'} · {anonymous?'匿名':'具名'}</p>
      <label className="flex items-start gap-2 text-sm leading-6"><input className="mt-1.5" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />我確認將以上內容分享給所選對象，且不包含未經同意的他人私密資訊。</label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={!valid}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}確認分享</Button>
    </fieldset></form>
  </DialogContent></Dialog>;
}
