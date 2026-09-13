import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2,Share2 } from 'lucide-react';
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

export function DevotionWallShareDialog({draft,close}:{draft:DevotionShareDraft;close:()=>void}) {
  const [title,setTitle]=useState(draft.title || '今日靈修心得');const [legacyBody,setLegacyBody]=useState(draft.body);
  const [sections] = useState(draft.sections || []);
  const [selected,setSelected] = useState(sections.filter(section=>section.key.startsWith('insight:')).map(section=>section.key));
  const [texts,setTexts] = useState<Record<string,string>>(Object.fromEntries(sections.map(section=>[section.key,section.text])));
  const body = sections.length ? composeDevotionShare(sections,selected,texts) : legacyBody;
  const [reference,setReference]=useState(draft.reference);const [anonymous,setAnonymous]=useState(false);
  const [consent,setConsent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const window=useDevotionWall(true);const client=useQueryClient();const navigate=useNavigate();
  useEffect(()=>{setConsent(false);},[window.data?.day,window.expired]);
  const valid=title.trim() && title.length<=160 && body.trim() && body.length<=DEVOTION_SHARE_MAX_LENGTH && reference.trim() && reference.length<=200 && consent && window.data && !window.expired && !window.isError;
  return <Dialog open onOpenChange={open=>{if(!open && !busy)close();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl [overflow-wrap:anywhere]">
    <DialogHeader><DialogTitle>分享到今日靈修牆</DialogTitle><DialogDescription>全站登入成員可見。台灣時間午夜移出公開牆，個人筆記仍保留。</DialogDescription></DialogHeader>
    <form onSubmit={async e=>{
      e.preventDefault();if(!valid || busy)return;setBusy(true);setError('');
      try{await devotionWallApi('','POST',{sourceId:draft.sourceId,title,body,reference,anonymous,day:window.data!.day,consent});await client.invalidateQueries({queryKey:['devotion-wall']});toast.success('已分享到今日靈修牆');close();navigate('/devotion-wall');}
      catch(e){setError((e as Error).message);void window.refetch();}finally{setBusy(false);}
    }}><fieldset disabled={busy} className="min-w-0 space-y-4">
      <p className="text-sm font-medium">分享日期：{window.data?.day || '確認中…'}（台灣時間）</p>
      {(window.isError || window.expired) && <p role="alert" className="text-sm text-destructive">日期已換日或無法確認。<button type="button" className="ml-2 underline" onClick={()=>window.refetch()}>重新確認日期</button></p>}
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
        <section aria-label="公開內容預覽" className="space-y-2 border-y py-3"><h3 className="text-sm font-medium">公開內容預覽</h3><div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{body || '尚未選擇分享內容'}</div></section>
      </> : <label className="block space-y-1 text-sm"><span>公開心得</span><Textarea required rows={6} maxLength={DEVOTION_SHARE_MAX_LENGTH} value={body} onChange={e=>{setLegacyBody(e.target.value);setConsent(false);}} /></label>}
      <p className={`text-right text-xs ${body.length>DEVOTION_SHARE_MAX_LENGTH?'text-destructive':'text-muted-foreground'}`}>{body.length} / {DEVOTION_SHARE_MAX_LENGTH}</p>
      {body.length>DEVOTION_SHARE_MAX_LENGTH && <p role="alert" className="text-sm text-destructive">內容超過字數上限，請減少段落或縮短內容。尚未送出，原始筆記不受影響。</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e=>{setAnonymous(e.target.checked);setConsent(false);}} />匿名分享</label>
      {anonymous && <p className="text-sm text-muted-foreground">牆上不顯示姓名；系統仍保留作者供本人管理。請移除內文中可辨識自己或他人的細節。</p>}
      <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1.5" checked={consent} onChange={e=>setConsent(e.target.checked)} />我同意公開以上內容，已移除不想公開的私人資訊。</label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit" disabled={!valid || busy} className="gap-2">{busy?<Loader2 className="h-4 w-4 animate-spin" />:<Share2 className="h-4 w-4" />}確認公開分享</Button></div>
    </fieldset></form>
  </DialogContent></Dialog>;
}
