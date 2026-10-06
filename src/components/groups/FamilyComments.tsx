import { churchFetch as fetch } from '@/lib/churchFetch';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import type { GroupComment } from '@shared/lifeGroup';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { familyBase, familyRequest } from '@/lib/familyApi';

export function FamilyComments({ groupId, shareId, actor, manager, count, targetCommentId='' }: {
  groupId: string; shareId: string; actor: string; manager: boolean; count: number; targetCommentId?:string;
}) {
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState('');
  const [mutationId, setMutationId] = useState(() => crypto.randomUUID());
  const [visibleCount, setVisibleCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const locked = useRef(false);
  const thread = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const client = useQueryClient();
  const path = `/${groupId}/shares/${shareId}/comments`;
  const focused = useRef('');
  const target = useQuery<GroupComment>({queryKey:[familyBase,actor,path,'target',targetCommentId],queryFn:() => familyRequest(`${path}/${targetCommentId}`),enabled:!!targetCommentId,retry:false});
  const q = useInfiniteQuery({
    queryKey: [familyBase, actor, path, 'thread'],
    queryFn: ({ pageParam }) => familyRequest<GroupComment[]>(`${path}?offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.length === 30 ? pages.length * 30 : undefined,
    enabled: count > 0 || composing || !!targetCommentId,
    staleTime: 15000, refetchInterval: 60000, retry: false,
  });
  // The API returns newest first. Keep a single chronological thread across older pages.
  const comments = useMemo(() => [...new Map([...(q.data?.pages.flat() || []),...(!target.isError && target.data ? [target.data] : [])].map(c => [c.id, c])).values()].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)), [q.data,target.data,target.isError]);
  const visible = useMemo(() => q.isError ? [] : targetCommentId ? comments : comments.slice(-visibleCount), [q.isError,targetCommentId,comments,visibleCount]);
  const hasOlder = comments.length > visibleCount || q.hasNextPage;
  const submittedVisible = visible.some(c => c.id === submittedId);
  useEffect(() => {
    if (!targetCommentId || focused.current === targetCommentId || !visible.some(c => c.id === targetCommentId)) return;
    const item = thread.current?.querySelector<HTMLElement>(`[data-comment-id="${targetCommentId}"]`);
    if (item) { item.focus({preventScroll:true}); item.scrollIntoView?.({block:'nearest'}); focused.current = targetCommentId; }
  },[targetCommentId,visible]);
  useEffect(() => {
    if (!submittedId || !submittedVisible) return;
    const item = thread.current?.querySelector<HTMLElement>(`[data-comment-id="${submittedId}"]`);
    item?.focus({ preventScroll: true });
    item?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    setSubmittedId(null);
  }, [submittedId, submittedVisible]);

  return <section ref={thread} aria-label="分享留言" className="mt-3 min-w-0 space-y-3 border-t pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4" />留言{count > 0 && ` · ${count}`}</h4>
      {!composing && <Button size="sm" variant="ghost" onClick={() => setComposing(true)} aria-expanded={false} aria-controls={`comment-form-${shareId}`}>寫下留言</Button>}
    </div>
    {q.isPending && q.isFetching && <p role="status" className="text-sm text-muted-foreground">載入留言中…</p>}
    {q.isError && <div role="alert" className="space-y-2 text-sm"><p>留言暫時無法載入，請重試。</p><Button variant="outline" size="sm" onClick={() => void q.refetch()}>重新載入留言</Button></div>}
    {targetCommentId && target.isError && <div role="alert"><p>這則留言已撤回，或暫時無法載入。</p><Button variant="outline" onClick={() => void target.refetch()}>重新載入這則留言</Button></div>}
    {!q.isError && hasOlder && <Button size="sm" variant="ghost" disabled={q.isFetching || busy} onClick={async () => {
      if (visibleCount >= comments.length && q.hasNextPage) {
        const result = await q.fetchNextPage();
        if (result.isError) return;
      }
      setVisibleCount(n => n + 30);
    }}><ChevronUp className="mr-2 h-4 w-4" />查看較早留言</Button>}
    <ol className="space-y-4" aria-label="留言內容">{visible.map(comment => <li key={comment.id} data-comment-id={comment.id} tabIndex={-1} className={`min-w-0 scroll-mt-32 border-l-2 pl-3 outline-offset-4 ${comment.id === targetCommentId ? 'border-primary bg-primary/5' : ''}`}>
      <p className="font-medium">{comment.authorName}</p>
      <p className="mt-1 whitespace-pre-wrap break-words leading-7">{comment.body}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
        <time dateTime={comment.createdAt} className="text-sm text-muted-foreground"><span className="inline-block">{new Date(comment.createdAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>{' '}<span className="inline-block">{new Date(comment.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span></time>
        {(manager || comment.isOwner || comment.authorId === actor) && <Button size="icon" variant="ghost" className="shrink-0" title="撤回留言" aria-label={`撤回 ${comment.authorName} 的留言`} disabled={busy} onClick={async () => {
          if (locked.current || !window.confirm('撤回這則留言？')) return;
          locked.current = true; setBusy(true); setError('');
          try { await familyRequest(`${path}/${comment.id}`, 'DELETE'); await client.invalidateQueries({ queryKey: [familyBase] }); }
          catch (e) { setError((e as Error).message); }
          finally { locked.current = false; setBusy(false); }
        }}><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </li>)}</ol>
    {composing && <form id={`comment-form-${shareId}`} className="space-y-3 border-t pt-3" onSubmit={async e => {
      e.preventDefault();
      if (locked.current || !body.trim()) return;
      locked.current = true; setBusy(true); setError('');
      try {
        await familyRequest(`${path}/${mutationId}`, 'PUT', { body });
        input.current?.blur(); setBody(''); setSubmittedId(mutationId); setMutationId(crypto.randomUUID());
        await client.invalidateQueries({ queryKey: [familyBase] });
      } catch (e) { setError((e as Error).message); }
      finally { locked.current = false; setBusy(false); }
    }}>
      <label className="block space-y-2 text-sm"><span>寫下留言</span><Textarea ref={input} required rows={2} maxLength={4000} disabled={busy} value={body} onChange={e => setBody(e.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-2"><Button disabled={busy || !body.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}送出留言</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { if (!body.trim() || window.confirm('放棄尚未送出的留言？')) { setBody(''); setMutationId(crypto.randomUUID()); setError(''); setComposing(false); } }}>取消</Button></div>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
