import { useRef, useState } from 'react';
import { MessageCircle, Send, Trash2, X, HandHeart, HeartHandshake, Sun, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePrayerComments, useCreateComment, useDeleteComment } from '@/hooks/usePrayerComments';
import { useUserRole } from '@/hooks/useUserRole';
import { COMMENT_LABELS, STICKER_LABELS, type PrayerSticker } from '@shared/prayerInteraction';

const stickerIcons = { praying: HandHeart, together: HeartHandshake, peace: Sun };
const stickerColors = { praying: 'text-teal-700 bg-teal-50', together: 'text-rose-700 bg-rose-50', peace: 'text-amber-800 bg-amber-50' };
function Sticker({value}:{value:PrayerSticker}) {
  const Icon = stickerIcons[value];
  return <span className={`inline-flex h-24 w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-lg ${stickerColors[value]}`}><Icon className="h-9 w-9" strokeWidth={1.7} /><span className="text-sm font-semibold">{STICKER_LABELS[value]}</span></span>;
}

export function PrayerComments({prayerId,count=0,anonymousOwner=false,readOnly=false}:{prayerId:string;count?:number;anonymousOwner?:boolean;readOnly?:boolean}) {
  const [expanded,setExpanded] = useState(false);
  const [content,setContent] = useState('');
  const [kind,setKind] = useState<keyof typeof COMMENT_LABELS>('encouragement');
  const [sticker,setSticker] = useState<PrayerSticker>('praying');
  const request = useRef<{signature:string;id:string}>();
  const comments = usePrayerComments(prayerId,expanded);
  const create = useCreateComment(); const remove = useDeleteComment(); const {isAdmin} = useUserRole();
  async function send() {
    if (create.isPending || (kind !== 'sticker' && !content.trim())) return;
    const input = {content:kind === 'sticker' ? '' : content.trim(),kind,...(kind === 'sticker' ? {sticker} : {})};
    const signature = JSON.stringify(input);
    // Reuse the receipt key after a network failure, but not after editing the draft.
    if (request.current?.signature !== signature) request.current = {signature,id:crypto.randomUUID()};
    try { await create.mutateAsync({prayerId,...input,requestId:request.current.id}); setContent(''); request.current = undefined; }
    catch { /* Keep the draft and receipt key for an explicit retry. */ }
  }
  if (!expanded) return <Button variant="ghost" size="sm" className="gap-2" onClick={()=>setExpanded(true)}><MessageCircle className="h-4 w-4" />鼓勵與禱告{count > 0 ? ` · ${count}` : ''}</Button>;
  return <section className="min-w-0 space-y-4 py-2" aria-label="鼓勵與禱告">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">鼓勵與禱告 · {comments.data?.length ?? count}</h3><Button variant="ghost" size="icon" title="收起回應" aria-label="收起回應" onClick={()=>setExpanded(false)}><X className="h-4 w-4" /></Button></div>
    {comments.isPending && <p role="status" className="text-sm text-muted-foreground">載入回應中…</p>}
    {comments.isError && <p role="alert" className="text-sm text-destructive">回應載入失敗。<button className="ml-2 underline" onClick={()=>comments.refetch()}>重新載入</button></p>}
    {!comments.isError && <div className="max-h-96 space-y-4 overflow-y-auto [overflow-wrap:anywhere]">{comments.data?.map(comment=><article key={comment.id} className="border-b pb-3 last:border-0">
      <div className="mb-2 flex items-start justify-between gap-2"><div className="min-w-0 text-xs"><span className="font-semibold">{comment.authorName}</span><span className="ml-2 text-muted-foreground">{COMMENT_LABELS[comment.kind]} · {formatDistanceToNow(new Date(comment.createdAt),{addSuffix:true,locale:zhTW})}</span></div>
        {(comment.isOwner || isAdmin) && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={remove.isPending} title="撤回回應" aria-label="撤回回應" onClick={()=>{if(window.confirm('確定撤回這則回應？')) remove.mutate({prayerId,commentId:comment.id});}}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      {comment.kind === 'sticker' && comment.sticker && comment.sticker in STICKER_LABELS ? <Sticker value={comment.sticker} /> : <p className="whitespace-pre-wrap text-sm leading-6">{comment.content}</p>}
    </article>)}</div>}
    {!readOnly && <form onSubmit={e=>{e.preventDefault();void send();}} className="border-t pt-3"><fieldset disabled={create.isPending} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm">回應類型<select aria-label="回應類型" className="h-10 rounded-md border bg-background px-2" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{Object.entries(COMMENT_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><span className="text-xs text-muted-foreground">{anonymousOwner ? '以匿名發文者回應' : '以你的名字回應'}</span></div>
      {kind === 'sticker' ? <div role="radiogroup" aria-label="禱告貼圖" className="flex flex-wrap gap-2">{(Object.keys(STICKER_LABELS) as PrayerSticker[]).map(value=><button key={value} type="button" role="radio" aria-checked={sticker===value} aria-label={STICKER_LABELS[value]} className={`rounded-lg border-2 p-1 ${sticker===value?'border-primary':'border-transparent'}`} onClick={()=>setSticker(value)}><Sticker value={value} /></button>)}</div> : <Textarea aria-label="回應內容" placeholder={kind==='scripture'?'寫下想分享的話語與經文出處…':kind==='prayer'?'寫下為對方的禱告…':'寫下一句鼓勵…'} rows={3} maxLength={1000} value={content} onChange={e=>setContent(e.target.value)} />}
      {create.isError && <p role="alert" className="text-sm text-destructive">尚未送出，你的內容仍保留在這裡。</p>}
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{kind!=='sticker' && `${content.length} / 1000`}</span><Button type="submit" disabled={create.isPending || (kind!=='sticker' && !content.trim())} className="gap-2">{create.isPending?<Loader2 className="h-4 w-4 animate-spin" />:<Send className="h-4 w-4" />}送出回應</Button></div>
    </fieldset></form>}
  </section>;
}
