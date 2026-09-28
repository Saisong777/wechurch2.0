import { useId, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2, HandHeart, HeartHandshake, Sun, Loader2, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePrayerComments, useCreateComment, useDeleteComment } from '@/hooks/usePrayerComments';
import { useUserRole } from '@/hooks/useUserRole';
import { COMMENT_LABELS, STICKER_LABELS, type PrayerSticker } from '@shared/prayerInteraction';

const stickerIcons = { praying: HandHeart, together: HeartHandshake, peace: Sun };
const stickerColors = {
  praying: 'text-teal-800 bg-teal-50 dark:text-teal-200 dark:bg-teal-950/40',
  together: 'text-rose-800 bg-rose-50 dark:text-rose-200 dark:bg-rose-950/40',
  peace: 'text-amber-900 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/40',
};
const responseLabels = { encouragement: '鼓勵', prayer: '禱告', scripture: '經文', sticker: '貼圖' } as const;
function Sticker({value, compact=false}:{value:PrayerSticker;compact?:boolean}) {
  const Icon = stickerIcons[value];
  return <span className={`inline-flex shrink-0 flex-col items-center justify-center gap-2 rounded-md ${compact ? 'h-20 w-full' : 'h-24 w-28'} ${stickerColors[value]}`}><Icon className={compact ? 'h-7 w-7' : 'h-10 w-10'} strokeWidth={1.7} /><span className="text-xs font-semibold sm:text-sm">{STICKER_LABELS[value]}</span></span>;
}

export function PrayerComments({prayerId,count=0,anonymousOwner=false,readOnly=false}:{prayerId:string;count?:number;anonymousOwner?:boolean;readOnly?:boolean}) {
  const [expanded,setExpanded] = useState(false);
  const [content,setContent] = useState('');
  const [kind,setKind] = useState<keyof typeof COMMENT_LABELS>('encouragement');
  const [sticker,setSticker] = useState<PrayerSticker>('praying');
  const formId = useId();
  const request = useRef<{signature:string;id:string}>();
  const comments = usePrayerComments(prayerId,expanded);
  const create = useCreateComment(); const remove = useDeleteComment(); const {isAdmin} = useUserRole();
  async function send() {
    if (create.isPending || (kind !== 'sticker' && !content.trim())) return;
    const input = {content:kind === 'sticker' ? '' : content.trim(),kind,...(kind === 'sticker' ? {sticker} : {})};
    const signature = JSON.stringify(input);
    // Reuse the receipt key after a network failure, but not after editing the draft.
    if (request.current?.signature !== signature) request.current = {signature,id:crypto.randomUUID()};
    try { await create.mutateAsync({prayerId,...input,requestId:request.current.id}); if (kind !== 'sticker') setContent(''); request.current = undefined; }
    catch { /* Keep the draft and receipt key for an explicit retry. */ }
  }
  return <>
    <Button variant={expanded ? 'secondary' : 'outline'} className="min-h-11 min-w-0 flex-1 gap-1.5 px-2" aria-expanded={expanded} aria-controls={formId} onClick={()=>setExpanded(!expanded)}><MessageCircle className="h-4 w-4" />{expanded ? '收起回應' : readOnly ? '查看回應' : '寫下鼓勵'}{count > 0 ? ` · ${count}` : ''}</Button>
    {expanded && <section id={formId} className="w-full min-w-0 basis-full space-y-4 border-t pt-4" aria-label="鼓勵與禱告">
      {!readOnly && <form onSubmit={e=>{e.preventDefault();void send();}}><fieldset disabled={create.isPending} className="min-w-0 space-y-3">
        <div role="radiogroup" aria-label="回應類型" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">{(Object.keys(responseLabels) as (keyof typeof responseLabels)[]).map(value => <label key={value} className="min-w-0 cursor-pointer">
          <input type="radio" name={formId+'-kind'} aria-label={responseLabels[value]} value={value} checked={kind===value} onChange={()=>setKind(value)} className="peer sr-only" />
          <span className="flex min-h-11 items-center justify-center rounded-md px-1 text-sm text-muted-foreground peer-checked:bg-background peer-checked:font-semibold peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{responseLabels[value]}</span>
        </label>)}</div>
        {kind === 'sticker' ? <div role="radiogroup" aria-label="禱告貼圖" className="grid grid-cols-3 gap-2">{(Object.keys(STICKER_LABELS) as PrayerSticker[]).map(value=><label key={value} className="min-w-0 cursor-pointer">
          <input type="radio" name={formId+'-sticker'} aria-label={STICKER_LABELS[value]} value={value} checked={sticker===value} onChange={()=>setSticker(value)} className="peer sr-only" />
          <span className="relative block rounded-lg border-2 border-transparent p-1 peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring"><Sticker value={value} compact />{sticker===value && <Check aria-hidden="true" className="absolute right-1 top-1 h-4 w-4 text-primary" />}</span>
        </label>)}</div> : <Textarea aria-label="回應內容" placeholder={kind==='scripture'?'分享一句經文，並寫下出處…':kind==='prayer'?'寫下你為對方的禱告…':'寫一句鼓勵，讓對方知道你在關心…'} rows={3} maxLength={1000} value={content} onChange={e=>setContent(e.target.value)} />}
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{anonymousOwner ? '以匿名發文者回應' : '以你的名字回應'}</span>{kind!=='sticker' && <span>{content.length} / 1000</span>}</div>
        {create.isError && <p role="alert" className="text-sm text-destructive">尚未送出，你的內容仍保留在這裡。</p>}
        <Button type="submit" disabled={create.isPending || (kind!=='sticker' && !content.trim())} className="min-h-11 w-full gap-2">{create.isPending?<Loader2 className="h-4 w-4 animate-spin" />:<Send className="h-4 w-4" />}送出回應</Button>
      </fieldset></form>}
      <div className="space-y-3 border-t pt-3">
        <h3 className="text-sm font-semibold">大家的回應 · {comments.data?.length ?? count}</h3>
        {comments.isPending && <p role="status" className="text-sm text-muted-foreground">載入回應中…</p>}
        {comments.isError && <p role="alert" className="text-sm text-destructive">回應載入失敗。<button className="ml-2 min-h-11 underline" onClick={()=>comments.refetch()}>重新載入</button></p>}
        {!comments.isPending && !comments.isError && !comments.data?.length && <p className="text-sm text-muted-foreground">還沒有回應</p>}
        {!comments.isError && <div className="max-h-96 space-y-4 overflow-y-auto [overflow-wrap:anywhere]">{comments.data?.map(comment=><article key={comment.id} className="border-b pb-3 last:border-0">
          <div className="mb-2 flex items-start justify-between gap-2"><div className="min-w-0 text-xs"><span className="font-semibold">{comment.authorName}</span><span className="ml-2 text-muted-foreground">{COMMENT_LABELS[comment.kind]} · {formatDistanceToNow(new Date(comment.createdAt),{addSuffix:true,locale:zhTW})}</span></div>
            {(comment.isOwner || isAdmin) && <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={remove.isPending} title="撤回回應" aria-label="撤回回應" onClick={()=>{if(window.confirm('確定撤回這則回應？')) remove.mutate({prayerId,commentId:comment.id});}}><Trash2 className="h-4 w-4" /></Button>}
          </div>
          {comment.kind === 'sticker' && comment.sticker && comment.sticker in STICKER_LABELS ? <Sticker value={comment.sticker} /> : <p className="whitespace-pre-wrap text-sm leading-6">{comment.content}</p>}
        </article>)}</div>}
      </div>
    </section>}
  </>;
}
