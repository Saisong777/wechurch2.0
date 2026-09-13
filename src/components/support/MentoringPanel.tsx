import { useRef,useState } from 'react';
import { flushSync } from 'react-dom';
import { Link,useSearchParams } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { ArrowLeft,ArrowRight,Plus,RefreshCw,Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UnsavedChangesGuard } from '@/components/layout/UnsavedChangesGuard';
import { mentoringLabels,type MentoringContract,type MentoringTarget,type MentoringDetail } from '@shared/mentoring';

const base='/api/mentoring';
const selectClass='min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm';
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(base+path,{method,credentials:'include',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'暫時無法完成');return data;
}
function useMentoring<T>(path:string,enabled=true){const {user}=useAuth();return useQuery<T>({queryKey:[base,user?.id,path],queryFn:()=>request<T>(path),enabled:!!user&&enabled,retry:false,staleTime:0});}
export const useJourneyMentoring=(journeyId?:string)=>useMentoring<{contracts:MentoringContract[];hasMore:boolean}>(`/contracts?mode=learner&journeyId=${journeyId}`,!!journeyId);

export function MentoringPanel({mode}:{mode:'learner'|'mentor'}){
  const {user,loading}=useAuth();const [search,setSearch]=useSearchParams();const id=search.get('contract');const journey=search.get('journey');
  const [page,setPage]=useState(0),[create,setCreate]=useState(false);
  const q=useMentoring<{contracts:MentoringContract[];hasMore:boolean}>(`/contracts?mode=${mode}&offset=${page*30}${journey?`&journeyId=${encodeURIComponent(journey)}`:''}`);
  const select=(id:string|null)=>setSearch(previous=>{const p=new URLSearchParams(previous);if(id)p.set('contract',id);else p.delete('contract');return p;});
  if(loading)return <p role="status">載入中…</p>;
  if(!user)return <Button asChild><Link to={`/login?returnTo=${encodeURIComponent(mode==='mentor'?'/work/mentoring':'/me/mentoring')}`}>登入後繼續</Link></Button>;
  if(id)return <MentoringDetailPanel key={`${user.id}:${id}`} id={id} back={()=>select(null)}/>;
  if(create&&journey)return <MentoringComposer journeyId={journey} cancel={()=>setCreate(false)} done={id=>{flushSync(()=>setCreate(false));select(id);}}/>;
  const current=q.data?.contracts.some(c=>['pending','active'].includes(c.status));
  return <section className="space-y-4 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{mode==='mentor'?'陪伴邀請與學員':'我的陪伴關係'}</h2><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="重新載入" title="重新載入" onClick={()=>void q.refetch()}><RefreshCw className="h-4 w-4"/></Button>{mode==='learner'&&journey&&<Button disabled={q.isPending||q.isError||current} onClick={()=>setCreate(true)}><Plus className="mr-2 h-4 w-4"/>邀請陪伴者</Button>}</div></div>
    {q.isError?<p role="alert">{q.error.message}</p>:q.isPending?<p role="status">載入陪伴關係中…</p>:<>
      {!q.data.contracts.length&&<p className="border-y py-6 text-muted-foreground">目前沒有陪伴關係。</p>}
      <ul className="divide-y border-y">{q.data.contracts.map(c=><li key={c.id}><button onClick={()=>select(c.id)} className="flex w-full items-center justify-between gap-3 py-4 text-left"><div className="min-w-0"><p className="font-medium">{mode==='mentor'?c.learnerName:c.mentorName}</p><p className="text-sm text-muted-foreground">{c.courseName} · {mentoringLabels[c.status]}</p></div><ArrowRight className="h-4 w-4 shrink-0"/></button></li>)}</ul>
      {(page>0||q.data.hasMore)&&<div className="flex justify-center gap-4"><Button size="icon" variant="outline" aria-label="上一頁" disabled={!page} onClick={()=>setPage(page-1)}><ArrowLeft className="h-4 w-4"/></Button><span>{page+1}</span><Button size="icon" variant="outline" aria-label="下一頁" disabled={!q.data.hasMore} onClick={()=>setPage(page+1)}><ArrowRight className="h-4 w-4"/></Button></div>}
    </>}
    {mode==='learner'&&!journey&&<Button asChild variant="outline"><Link to="/me/love-journey">前往愛的旅程</Link></Button>}
    {mode==='mentor'&&<MentoringClosures/>}
  </section>;
}

function MentoringClosures(){
  const q=useMentoring<Array<Pick<MentoringContract,'id'|'status'|'version'>>>('/closures');const cache=useQueryClient();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function close(c:Pick<MentoringContract,'id'|'status'|'version'>){
    if(!window.confirm('確定結束這項已停止存取的陪伴或邀請？'))return;
    setBusy(true);setError('');try{await request(`/contracts/${c.id}`,'PATCH',{version:c.version,action:c.status==='pending'?'decline':'end',consent:true});await cache.invalidateQueries({queryKey:[base]});}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(q.isError)return <p role="alert">無法載入待結束關係。<Button variant="link" onClick={()=>void q.refetch()}>重試</Button></p>;
  if(!q.data?.length)return null;
  return <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">已停止存取的陪伴</h3>{q.data.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3"><span>關係 {c.id.slice(0,8)} · {mentoringLabels[c.status]}</span><Button variant="outline" disabled={busy} onClick={()=>void close(c)}>{c.status==='pending'?'婉拒邀請':'結束陪伴'}</Button></div>)}{error&&<p role="alert">{error}</p>}</section>;
}

function MentoringComposer({journeyId,cancel,done}:{journeyId:string;cancel:()=>void;done:(id:string)=>void}){
  const q=useMentoring<MentoringTarget[]>('/targets');const cache=useQueryClient();const operation=useRef(crypto.randomUUID());
  const [target,setTarget]=useState(''),[cadence,setCadence]=useState('14'),[agreement,setAgreement]=useState('');
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dirty=!!(target||agreement||consent);
  async function submit(){setBusy(true);setError('');try{
    const selected=q.data?.find(t=>`${t.groupId}:${t.mentorId}`===target);if(!selected||!consent)throw new Error('請選擇陪伴者並確認同意。');
    const {groupId,mentorId}=selected;const result=await request<{id:string}>(`/contracts/${operation.current}`,'PUT',{journeyId,groupId,mentorId,cadenceDays:Number(cadence),agreement,consent});
    await cache.invalidateQueries({queryKey:[base]});setAgreement('');setConsent(false);done(result.id);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form onSubmit={e=>{e.preventDefault();if(!busy)void submit();}}><fieldset disabled={busy} className="space-y-4 min-w-0"><UnsavedChangesGuard dirty={dirty}/><h2 className="text-lg font-semibold">邀請陪伴者</h2>
    {q.isError?<p role="alert">{q.error.message}</p>:q.isPending?<p role="status">載入陪伴者中…</p>:!q.data.length?<p>目前沒有可邀請的小組陪伴者，請先請教會安排小組關係。</p>:<label className="block space-y-2 text-sm"><span>陪伴者</span><select required className={selectClass} value={target} onChange={e=>setTarget(e.target.value)}><option value="">選擇陪伴者</option>{q.data.map(t=><option key={`${t.groupId}:${t.mentorId}`} value={`${t.groupId}:${t.mentorId}`}>{t.groupName} · {t.mentorName}</option>)}</select></label>}
    <label className="block space-y-2 text-sm"><span>約定聯絡頻率</span><select className={selectClass} value={cadence} onChange={e=>setCadence(e.target.value)}><option value="7">每週</option><option value="14">每兩週</option><option value="30">每月</option></select></label>
    <label className="block space-y-2 text-sm"><span>希望一起完成的事與聯絡方式</span><Textarea required maxLength={2000} rows={5} value={agreement} onChange={e=>setAgreement(e.target.value)}/></label>
    <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={consent} onChange={e=>setConsent(e.target.checked)}/>我同意對方接受後查看本課程進度；回答仍需逐則分享。私人筆記、禱告與牧養紀錄不包含在內。</label>
    {error&&<p role="alert" className="text-destructive">{error}</p>}<div className="flex flex-wrap gap-3"><Button disabled={busy||!target||!consent} type="submit"><Send className="mr-2 h-4 w-4"/>{busy?'送出中…':'送出邀請'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{if(!dirty||window.confirm('放棄尚未送出的邀請？'))cancel();}}>取消</Button></div>
  </fieldset></form>;
}

function MentoringDetailPanel({id,back}:{id:string;back:()=>void}){
  const q=useMentoring<MentoringDetail>(`/contracts/${id}`);const cache=useQueryClient();
  const [body,setBody]=useState(''),[kind,setKind]=useState('reflection'),[consent,setConsent]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const operation=useRef(crypto.randomUUID());
  async function act(path:string,method:string,data:unknown,after?:()=>void){setBusy(true);setError('');try{await request(path,method,data);after?.();await cache.invalidateQueries({queryKey:[base]});await cache.invalidateQueries({queryKey:['/api/me/love-journey']});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const backButton=<Button disabled={busy} variant="ghost" onClick={()=>{if(!body||window.confirm('放棄尚未送出的回應？')){flushSync(()=>setBody(''));back();}}}><ArrowLeft className="mr-2 h-4 w-4"/>陪伴列表</Button>;
  if(q.isError)return <div className="space-y-4">{backButton}<p role="alert">{q.error.message}</p><Button onClick={()=>void q.refetch()} variant="outline">重新載入</Button></div>;
  if(!q.data)return <p role="status">載入中…</p>;
  const c=q.data.contract;
  return <section className="space-y-5 [overflow-wrap:anywhere]"><UnsavedChangesGuard dirty={!!body}/><div className="flex justify-between">{backButton}<Button variant="ghost" size="icon" aria-label="重新載入" title="重新載入，保留輸入" onClick={()=>void q.refetch()}><RefreshCw className="h-4 w-4"/></Button></div>
    <div className="space-y-2 border-b pb-5"><h2 className="text-xl font-semibold">{c.learnerName} 與 {c.mentorName}</h2><p>{c.courseName} · {mentoringLabels[c.status]}</p><p className="text-sm">約定每 {c.cadenceDays} 天聯絡</p><p className="whitespace-pre-wrap leading-7">{c.agreement}</p></div>
    {c.status==='pending'&&!c.isLearner&&<div className="space-y-3"><label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" disabled={busy} className="mt-1 h-5 w-5 shrink-0" checked={consent} onChange={e=>setConsent(e.target.checked)}/>我接受以上陪伴約定。只查看本課程進度與學員明確分享給我的回答，不取得其他私人資料。</label><div className="flex flex-wrap gap-3"><Button disabled={busy||!consent} onClick={()=>void act(`/contracts/${id}`,'PATCH',{version:c.version,action:'accept',consent:true})}>接受陪伴</Button><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm('確定不接受這次邀請？'))void act(`/contracts/${id}`,'PATCH',{version:c.version,action:'decline',consent:true},back);}}>婉拒邀請</Button></div></div>}
    {c.status==='active'&&<><h3 className="font-semibold">學習進度與分享</h3><ul className="divide-y">{q.data.progress.map(d=><li key={d.id} className="space-y-2 py-3"><p>第 {d.dayNumber} 天 · {d.title} <span className="text-sm text-muted-foreground">{d.status==='completed'?'已完成':d.status==='skipped'?'略過':d.status==='not_started'?'尚未開始':'進行中'}</span></p>{d.responseText!==null?<p className="whitespace-pre-wrap leading-7">{d.responseText}</p>:<p className="text-sm text-muted-foreground">未分享回答</p>}</li>)}</ul></>}
    {!!q.data.feedback.length&&<><h3 className="font-semibold">實作與回饋</h3><ol className="divide-y">{q.data.feedback.map(f=><li key={f.id} className="space-y-2 py-3"><p className="text-sm text-muted-foreground">{f.authorName} · {({reflection:'學習回應',practice:'實作紀錄',feedback:'陪伴回饋'})[f.kind]} · {new Date(f.createdAt).toLocaleString('zh-TW')}</p><p className="whitespace-pre-wrap leading-7">{f.body}</p></li>)}</ol>{q.data.hasOlderFeedback&&<p>目前顯示最近 200 則回饋。</p>}</>}
    {c.status==='active'&&<form className="space-y-3 border-t pt-4" onSubmit={e=>{e.preventDefault();if(busy)return;const submitted=body;void act(`/contracts/${id}/feedback/${operation.current}`,'PUT',{version:c.version,kind:c.isLearner?kind:'feedback',body},()=>{setBody(current=>current===submitted?'':current);operation.current=crypto.randomUUID();});}}>{c.isLearner&&<label className="block space-y-2 text-sm"><span>回應類型</span><select disabled={busy} className={selectClass} value={kind} onChange={e=>setKind(e.target.value)}><option value="reflection">學習回應</option><option value="practice">實作紀錄</option></select></label>}<label className="block space-y-2 text-sm"><span>給對方的回應</span><Textarea disabled={busy} required maxLength={5000} rows={5} value={body} onChange={e=>setBody(e.target.value)}/></label><Button type="submit" disabled={busy||!body.trim()}><Send className="mr-2 h-4 w-4"/>送出回應</Button></form>}
    {(c.status==='active'||(c.isLearner&&c.status==='pending'))&&<Button variant="outline" disabled={busy} onClick={()=>{if(body&& !window.confirm('尚有未送出的回應，確定放棄並繼續結束陪伴？'))return;if(window.confirm('結束後對方將無法存取本陪伴關係，已分享的回答會收回私人；日後邀請新陪伴者需重新分享。確定結束？'))void act(`/contracts/${id}`,'PATCH',{version:c.version,action:'end',consent:true},()=>{flushSync(()=>setBody(''));if(!c.isLearner)back();});}}>{c.status==='pending'?'取消邀請':'結束陪伴或準備交接'}</Button>}
    {error&&<p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
