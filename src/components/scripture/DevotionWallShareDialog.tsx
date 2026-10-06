import { useEffect,useRef,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Globe,Loader2,Share2,Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { devotionWallApi,useDevotionWall } from '@/hooks/useDevotionWall';
import type { DevotionShareDraft } from '@shared/devotionWall';
import { DEVOTION_SHARE_MAX_LENGTH } from '@shared/devotionWall';
import { composeDevotionShare } from '@/lib/devotionShareDraft';
import { useAuth } from '@/contexts/AuthContext';
import { GROUP_SHARE_MAX_LENGTH,type GroupSummary } from '@shared/lifeGroup';

async function groupRequest<T>(path='',method='GET',body?:unknown):Promise<T> {
  const response=await fetch(`/api/life-groups${path}`,{method,credentials:'include',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error || '尚未完成，請重試。');
  return data;
}

export function DevotionWallShareDialog({draft,close,allowGroup=false}:{draft:DevotionShareDraft;close:()=>void;allowGroup?:boolean}) {
  const {user}=useAuth();
  const [groupSelected,setGroupSelected]=useState(allowGroup);
  const [wallSelected,setWallSelected]=useState(!allowGroup);
  const initialSource=useRef(draft.sourceId);const initialActor=useRef(user?.id);const currentActor=useRef(user?.id);currentActor.current=user?.id;
  const busyLock=useRef(false);
  const [groupId,setGroupId]=useState('');
  const mutationIds=useRef<Record<string,string>>({});
  const isWall=wallSelected;
  const maxLength=groupSelected?GROUP_SHARE_MAX_LENGTH:DEVOTION_SHARE_MAX_LENGTH;
  const [title,setTitle]=useState(draft.title || '今日靈修心得');const [legacyBody,setLegacyBody]=useState(draft.body);
  const [sections] = useState(draft.sections || []);
  const [selected,setSelected] = useState(sections.filter(section=>section.key.startsWith('insight:')).map(section=>section.key));
  const [texts,setTexts] = useState<Record<string,string>>(Object.fromEntries(sections.map(section=>[section.key,section.text])));
  const body = sections.length ? composeDevotionShare(sections,selected,texts) : legacyBody;
  const [reference,setReference]=useState(draft.reference);const [anonymous,setAnonymous]=useState(false);
  const [consent,setConsent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const window=useDevotionWall(true,false,isWall);const client=useQueryClient();const navigate=useNavigate();
  const groups=useQuery<{groups:GroupSummary[]}>({queryKey:['/api/life-groups',user?.id,'note-sharing-picker'],queryFn:()=>groupRequest(),enabled:allowGroup && groupSelected && !!user,retry:false,staleTime:0});
  const selectedGroup=groups.data?.groups.find(group=>group.id===groupId);
  const destinationReady=(groupSelected || isWall) && (!isWall || (window.data && !window.expired && !window.isError)) && (!groupSelected || (selectedGroup && !groups.isError));
  useEffect(()=>{setConsent(false);},[window.data?.day,window.expired]);
  useEffect(()=>{setConsent(false);setError('');},[user?.id,draft.sourceId]);
  const valid=draft.sourceId===initialSource.current && user?.id===initialActor.current && !!user && title.trim() && title.length<=160 && body.trim() && body.length<=maxLength && reference.trim() && reference.length<=200 && consent && destinationReady;
  return <Dialog open onOpenChange={open=>{if(!open && !busy)close();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl [overflow-wrap:anywhere] [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:grid [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:place-items-center">
    <DialogHeader className="pr-8"><DialogTitle>{allowGroup?'分享靈修筆記':'分享到今日靈修牆'}</DialogTitle><DialogDescription>{groupSelected && isWall?'同時分享至所選小家及全站靈修牆。小家以你的姓名分享；牆上可選匿名，台灣時間午夜移出公開牆。私人筆記仍保留。':isWall?'全站登入成員可見。台灣時間午夜移出公開牆，個人筆記仍保留。':'只有所選小家成員可見，以你的姓名分享。私人筆記仍保留。'}</DialogDescription></DialogHeader>
    <form onSubmit={async e=>{
      e.preventDefault();if(!valid || busyLock.current)return;busyLock.current=true;setBusy(true);setError('');
      try{
        const input={sourceId:draft.sourceId,title,body,reference,consent,
          ...(groupSelected?{group:{groupId}}:{}),...(isWall?{wall:{day:window.data!.day,anonymous}}:{})};
        // Retry the exact reviewed operation; changing content/destinations gets a new ID.
        const key=JSON.stringify(input);const mutationId=mutationIds.current[key] ??= crypto.randomUUID();
        await devotionWallApi(`/shares/${mutationId}`,'PUT',input);
        if(currentActor.current!==initialActor.current)return;
        // A failed cache refresh is not a failed publication.
        void client.invalidateQueries({queryKey:['devotion-wall']});
        void client.invalidateQueries({queryKey:['/api/life-groups']});
        toast.success(groupSelected && isWall?`已分享到${selectedGroup!.name}及今日靈修牆`:isWall?'已分享到今日靈修牆':`已分享到${selectedGroup!.name}`);
        close();navigate(isWall?'/devotion-wall':`/groups/${groupId}?view=note`);
      }
      catch(e){if(currentActor.current===initialActor.current){setError((e as Error).message);if(isWall)void window.refetch();if(groupSelected)void groups.refetch();}}finally{busyLock.current=false;setBusy(false);}
    }}><fieldset disabled={busy} className="min-w-0 space-y-4">
      {allowGroup && <fieldset className="space-y-2"><legend className="text-sm font-medium">分享對象</legend><div className="grid grid-cols-2 gap-2">
        {([['group','所屬小家',Users],['wall','所有人・靈修牆',Globe]] as const).map(([value,label,Icon])=><label key={value} className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${(value==='group'?groupSelected:isWall)?'border-primary bg-primary/5':'border-border'}`}><input type="checkbox" checked={value==='group'?groupSelected:isWall} onChange={e=>{if(value==='group')setGroupSelected(e.target.checked);else setWallSelected(e.target.checked);setConsent(false);setError('');}} /><Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" /><span>{label}</span></label>)}
      </div></fieldset>}
      {groupSelected && <div className="space-y-2">
        <label className="block space-y-1 text-sm"><span>選擇所屬小家</span><select className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base" value={groupId} onChange={e=>{setGroupId(e.target.value);setConsent(false);setError('');}} disabled={groups.isPending || groups.isError || busy}><option value="">請選擇小家</option>{groups.data?.groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        {groups.isPending && <p role="status" className="text-sm text-muted-foreground">載入小家中…</p>}
        {groups.isError && <p role="alert" className="text-sm text-destructive">小家載入失敗。<button type="button" className="ml-2 min-h-11 underline" onClick={()=>groups.refetch()}>重新載入</button></p>}
        {!groups.isPending && !groups.isError && !groups.data?.groups.length && <p className="text-sm text-muted-foreground">尚未加入小家。<Link to="/groups" onClick={close} className="ml-2 inline-block min-h-11 py-2 text-primary underline">前往我的小家</Link></p>}
      </div>}
      {isWall && <p className="text-sm font-medium">分享日期：{window.data?.day || '確認中…'}（台灣時間）</p>}
      {isWall && (window.isError || window.expired) && <p role="alert" className="text-sm text-destructive">日期已換日或無法確認。<button type="button" className="ml-2 underline" onClick={()=>window.refetch()}>重新確認日期</button></p>}
      <label className="block space-y-1 text-sm"><span>分享標題</span><Input required maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);setConsent(false);}} /></label>
      <label className="block space-y-1 text-sm"><span>經文出處</span><Input required maxLength={200} value={reference} onChange={e=>{setReference(e.target.value);setConsent(false);}} /></label>
      {sections.length > 0 ? <>
        <fieldset className="min-w-0 space-y-2 border-y py-3">
          <legend className="text-sm font-medium">分享範圍</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"><Checkbox checked={selected.length===sections.length} onCheckedChange={checked=>{setSelected(checked===true ? sections.map(section=>section.key) : []);setConsent(false);}} />全部分享</label>
          <div className="grid grid-cols-2 gap-x-3">
            {sections.map(section=><label key={section.key} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={selected.includes(section.key)} onCheckedChange={checked=>{setSelected(current=>checked===true ? [...current,section.key] : current.filter(key=>key!==section.key));setConsent(false);}} />{section.label}</label>)}
          </div>
        </fieldset>
        {sections.filter(section=>selected.includes(section.key)).map(section=><label key={section.key} className="block space-y-1 text-sm"><span>{section.label}內容</span><Textarea rows={3} value={texts[section.key]} onChange={e=>{setTexts(current=>({...current,[section.key]:e.target.value}));setConsent(false);}} /></label>)}
        <section aria-label={isWall?'公開內容預覽':'小家分享預覽'} className="space-y-2 border-y py-3"><h3 className="text-sm font-medium">{isWall?'公開內容預覽':'小家分享預覽'}</h3><div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{body || '尚未選擇分享內容'}</div></section>
      </> : <label className="block space-y-1 text-sm"><span>{isWall?'公開心得':'分享心得'}</span><Textarea required rows={6} maxLength={maxLength} value={body} onChange={e=>{setLegacyBody(e.target.value);setConsent(false);}} /></label>}
      <p className={`text-right text-xs ${body.length>maxLength?'text-destructive':'text-muted-foreground'}`}>{body.length} / {maxLength}</p>
      {body.length>maxLength && <p role="alert" className="text-sm text-destructive">內容超過字數上限，請減少段落或縮短內容。尚未送出，原始筆記不受影響。</p>}
      {isWall && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e=>{setAnonymous(e.target.checked);setConsent(false);}} />匿名分享</label>}
      {isWall && anonymous && <p className="text-sm text-muted-foreground">牆上不顯示姓名；系統仍保留作者供本人管理。請移除內文中可辨識自己或他人的細節。</p>}
      {groupSelected && selectedGroup && <p className="text-sm font-medium">分享對象：{selectedGroup.name} 全體成員</p>}
      <label className="flex min-h-11 items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1.5" checked={consent} onChange={e=>setConsent(e.target.checked)} />{groupSelected && isWall?'我同意將以上內容同時分享給所選小家及公開靈修牆，已移除不想分享的私人資訊。':isWall?'我同意公開以上內容，已移除不想公開的私人資訊。':'我同意將以上內容分享給所選小家，已移除不想分享的私人資訊。'}</label>
      {!groupSelected && !isWall && <p role="status" className="text-sm text-muted-foreground">請至少勾選一個分享對象。</p>}
      {user?.id!==initialActor.current && <p role="alert" className="text-sm text-destructive">登入帳號已變更，請關閉後從本人的筆記重新分享。</p>}
      {draft.sourceId!==initialSource.current && <p role="alert" className="text-sm text-destructive">筆記已變更，請關閉後重新確認分享內容。</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit" disabled={!valid || busy} className="gap-2">{busy?<Loader2 className="h-4 w-4 animate-spin" />:<Share2 className="h-4 w-4" />}{groupSelected && isWall?'確認同時分享':isWall?'確認公開分享':'確認分享至小家'}</Button></div>
    </fieldset></form>
  </DialogContent></Dialog>;
}
