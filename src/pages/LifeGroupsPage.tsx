import { ScriptureSection } from '@/components/scripture/ChurchScriptureSection';
import { fetchChurchReadingForToday, type ChurchReadingSummary } from '@/lib/churchReading';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, Check, Heart, HandHeart, Loader2, MessageCircle, Pencil, Plus, RefreshCw, Star, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { careStatuses, type GroupCare, type GroupComment, type GroupMember, type GroupShare, type GroupSummary, type CareUpdate, type ShareSource } from '@shared/lifeGroup';
import { taipeiToday } from '@shared/churchDevotion';
import { toast } from 'sonner';

const base = '/api/life-groups';
const selectClass = 'h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm';
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(base + path, { method, credentials: 'include', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '未完成，請重試。');
  return data;
}
function useGroupQuery<T>(path: string, enabled = true) {
  const { user } = useAuth();
  return useQuery<T>({ queryKey: [base, user?.id, path], queryFn: () => request<T>(path), enabled: !!user && enabled, staleTime: 0, refetchInterval: 15000, retry: false });
}
function Notice({ error, retry }: { error?: Error | null; retry?: () => void }) {
  return <div role="alert" className="space-y-3 py-5"><p>{error?.message || '暫時無法讀取小組資料。'}</p>{retry && <Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />重新載入</Button>}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1.5 text-sm"><span>{label}</span>{children}</label>;
}
function Pages({ page, setPage, count }: { page: number; setPage: (page: number) => void; count: number }) {
  if (!page && count < 30) return null;
  return <div className="flex items-center justify-center gap-4 py-4"><Button size="icon" variant="outline" disabled={!page} title="上一頁" aria-label="上一頁" onClick={() => setPage(page - 1)}><ArrowLeft className="h-4 w-4" /></Button><span className="text-sm">第 {page + 1} 頁</span><Button size="icon" variant="outline" disabled={count < 30} title="下一頁" aria-label="下一頁" onClick={() => setPage(page + 1)}><ArrowRight className="h-4 w-4" /></Button></div>;
}
const time = (value: string) => new Date(value).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function LifeGroupsPage() {
  const { user, loading } = useAuth();
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const q = useGroupQuery<{ groups: GroupSummary[]; requests: Array<{ id: string; name: string; status: string }>; canCreate: boolean }>('');
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(action: 'create' | 'join') {
    setBusy(true); setError('');
    try {
      if (action === 'create') { const group = await request<{ id: string }>('', 'POST', { name }); setName(''); navigate(`/groups/${group.id}`); }
      else { const result = await request<{ status: string }>('/join', 'POST', { token }); setToken(''); toast.success(result.status === 'approved' ? '你已是小組成員' : '申請已送出，等候小組長確認'); }
      await client.invalidateQueries({ queryKey: [base] });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (loading) return <><Header title="我的小組" backTo="/" /><p role="status" className="p-6">載入中…</p></>;
  if (!user) return <><Header title="我的小組" backTo="/" /><main className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl font-semibold">我的小組</h1><Button asChild><Link to="/login">登入小組</Link></Button></main></>;
  return <div className="min-h-screen bg-background pb-6 [overflow-wrap:anywhere]">
    <Header title="我的小組" backTo="/" />
    <main className="mx-auto max-w-5xl px-4 py-5">
      {q.data && q.data.groups.length > 0 && <div className="mb-5"><select aria-label="選擇小組" className={`${selectClass} max-w-72`} value={groupId || ''} onChange={e => navigate(e.target.value ? `/groups/${e.target.value}` : '/groups')}><option value="">所有小組</option>{q.data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>}
      {q.isError ? <Notice error={q.error as Error} retry={() => q.refetch()} /> : groupId ? <GroupWorkspace key={`${user.id}:${groupId}`} id={groupId} initialTab={search.get('view') || 'reading'} /> : q.isPending ? <p role="status">載入小組中…</p> : <>
        <div className="grid gap-3 sm:grid-cols-2">{q.data?.groups.map(g => <Link key={g.id} to={`/groups/${g.id}?view=${search.get('view') || 'reading'}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border p-5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div><h2 className="font-semibold">{g.name}</h2><p className="mt-1 text-sm text-muted-foreground">{g.memberCount} 位成員{g.manager ? ' · 小組管理' : ''}</p></div><ArrowRight className="h-5 w-5 shrink-0" /></Link>)}</div>
        {!q.data?.groups.length && <p className="py-6 text-muted-foreground">目前尚未加入小組。</p>}
        {q.data?.requests.map(r => <p key={r.id} className="border-b py-3 text-sm">{r.name} · {r.status === 'pending' ? '等待小組長確認' : '申請未通過，請聯絡小組長'}</p>)}
        <div className="mt-7 grid gap-8 border-t pt-6 sm:grid-cols-2">
          <form onSubmit={e => { e.preventDefault(); void submit('join'); }} className="space-y-3"><h2 className="text-lg font-semibold">加入小組</h2><Field label="小組邀請碼"><Input value={token} maxLength={48} required autoComplete="off" onChange={e => setToken(e.target.value.trim())} /></Field><Button disabled={busy || !token}>送出加入申請</Button></form>
          {q.data?.canCreate && <form onSubmit={e => { e.preventDefault(); void submit('create'); }} className="space-y-3"><h2 className="text-lg font-semibold">建立小組</h2><Field label="小組名稱"><Input value={name} maxLength={160} required onChange={e => setName(e.target.value)} /></Field><Button disabled={busy || !name.trim()} variant="outline"><Plus className="mr-2 h-4 w-4" />建立</Button></form>}
        </div>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </>}
    </main>
  </div>;
}

type Info = { id: string; name: string; manager: boolean; members: GroupMember[]; requests: Array<{ id: string; name: string }> };
function GroupWorkspace({ id, initialTab }: { id: string; initialTab: string }) {
  const { user } = useAuth();
  const q = useGroupQuery<Info>(`/${id}`);
  const [tab, setTab] = useState(['reading','note','prayer','care'].includes(initialTab) ? initialTab : 'reading');
  const [membersOpen, setMembersOpen] = useState(false);
  const [compose, setCompose] = useState<{ kind: 'note' | 'prayer'; reference?: string; existing?: GroupShare } | null>(null);
  const [careOpen, setCareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await work(); await client.invalidateQueries({ queryKey: [base] }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (q.isError) return <Notice error={q.error as Error} retry={() => q.refetch()} />;
  if (!q.data) return <p role="status">正在載入小組…</p>;
  const info = q.data;
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{info.name}</h2><p className="mt-1 text-sm text-muted-foreground">僅此小組成員可見 · {info.members.length} 位成員</p></div><Button variant="outline" onClick={() => setMembersOpen(true)}><Users className="mr-2 h-4 w-4" />成員{info.requests.length > 0 && ` (${info.requests.length})`}</Button></div>
    <div role="tablist" aria-label="小組生活" className="mb-5 grid grid-cols-4 border-b">{([['reading','一起讀經',BookOpen],['note','靈修分享',Pencil],['prayer','小組代禱',Heart],['care','共同關懷',HandHeart]] as const).map(([key,label,Icon]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setError(''); }} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-b-2 px-1 text-sm sm:flex-row sm:gap-2 ${tab === key ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon className="h-4 w-4 shrink-0" />{label}</button>)}</div>
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    <div role="tabpanel">
      {tab === 'reading' && <Reading id={id} actor={user!.id} busy={busy} act={act} onShare={reference => setCompose({ kind: 'note', reference })} />}
      {(tab === 'note' || tab === 'prayer') && <ShareFeed key={tab} id={id} kind={tab} info={info} actor={user!.id} busy={busy} act={act} compose={existing => setCompose({ kind: tab, existing })} />}
      {tab === 'care' && <CareFeed id={id} actor={user!.id} info={info} create={() => setCareOpen(true)} busy={busy} act={act} />}
    </div>
    {compose && <ShareComposer id={id} groupName={info.name} {...compose} close={() => setCompose(null)} />}
    {careOpen && <CareComposer id={id} info={info} close={() => setCareOpen(false)} />}
    {membersOpen && <Members id={id} info={info} actor={user!.id} close={() => setMembersOpen(false)} />}
  </>;
}
type Act = (work: () => Promise<unknown>) => Promise<void>;
function Reading({ id, actor, busy, act, onShare }: { id: string; actor: string; busy: boolean; act: Act; onShare: (reference: string) => void }) {
  const [date, setDate] = useState(taipeiToday);
  const q = useGroupQuery<{ entry: { id: string; version: number; title: string; reference: string; scriptureText: string; body: string; prayer: string; loveAction: string; planName: string } | null; readers: Array<{ id: string; name: string }> }>(`/${id}/reading?date=${date}`, !!date);
  const entry = q.data?.entry;
  const scripture = useQuery({
    queryKey: ['/api/church-reading/today', date],
    queryFn: () => fetchChurchReadingForToday(date),
    enabled: !!entry && !entry.scriptureText && !!date,
    staleTime: 30000,
    retry: 1,
  });
  const reading: ChurchReadingSummary | null = !entry ? null : {
    id: entry.id, date, dayNumber: 0, planName: entry.planName,
    scriptureReference: entry.reference, devotionalTitle: entry.title, devotionalText: entry.body,
    scriptureText: entry.scriptureText || (scripture.data?.date === date && scripture.data.scriptureReference === entry.reference ? scripture.data.scriptureText : ''),
    previewVerses: !entry.scriptureText && scripture.data?.date === date && scripture.data.scriptureReference === entry.reference ? scripture.data.previewVerses : [],
    scriptureStatus: entry.scriptureText ? 'ready' : scripture.isError ? 'unavailable' : scripture.data?.scriptureStatus,
  };
  const done = q.data?.readers.some(r => r.id === actor);
  return <section className="mx-auto max-w-2xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">教會靈修進度</h3><Input className="w-44" aria-label="讀經日期" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
    {q.isError ? <Notice error={q.error as Error} retry={() => q.refetch()} /> : !date ? <p>請選日期。</p> : q.isPending ? <p role="status">載入課表中…</p> : !entry ? <div className="space-y-3 border-y py-6"><p>這一天尚未發佈教會靈修課程。</p><Button asChild variant="outline"><Link to="/learn/bible">閱讀聖經</Link></Button></div> : <>
      <div className="space-y-3"><p className="text-sm text-muted-foreground">{entry.planName}</p><h3 className="text-xl font-semibold">{entry.title}</h3></div>
      {scripture.isFetching && !entry.scriptureText && !reading?.previewVerses.length && <p role="status" className="text-sm text-muted-foreground">正在載入經文…</p>}
      {reading && <ScriptureSection key={`${date}:${entry.reference}`} reading={reading} retry={() => scripture.refetch()} />}
      <p className="whitespace-pre-wrap leading-8">{entry.body}</p>{entry.prayer && <div className="border-l-2 border-rose-300 pl-4"><h4 className="mb-2 text-sm font-semibold">回應禱告</h4><p className="whitespace-pre-wrap leading-7">{entry.prayer}</p></div>}{entry.loveAction && <div className="border-l-2 border-emerald-300 pl-4"><h4 className="mb-2 text-sm font-semibold">愛人行動</h4><p className="whitespace-pre-wrap leading-7">{entry.loveAction}</p></div>}
      <div className="flex flex-wrap gap-3 border-t pt-5"><Button variant={done ? 'secondary' : 'outline'} disabled={busy} onClick={() => void act(() => request(`/${id}/reading/${entry.id}`, 'PUT', { version: entry.version, done: !done }))}>{done && <Check className="mr-2 h-4 w-4" />}{done ? '已分享讀完 · 撤回' : '與小組分享已讀'}</Button><Button onClick={() => onShare(entry.reference)}><Pencil className="mr-2 h-4 w-4" />分享今日領受</Button></div>
      <p className="text-sm text-muted-foreground">{q.data!.readers.length ? `分享已讀：${q.data!.readers.map(r => r.name).join('、')}` : '還沒有人分享已讀。'}</p>
    </>}
  </section>;
}

function ShareFeed({ id, kind, info, actor, busy, act, compose }: { id: string; kind: 'note' | 'prayer'; info: Info; actor: string; busy: boolean; act: Act; compose: (existing?: GroupShare) => void }) {
  const [page, setPage] = useState(0);
  const [comments, setComments] = useState<GroupShare | null>(null);
  const q = useGroupQuery<GroupShare[]>(`/${id}/shares?kind=${kind}&offset=${page * 30}`);
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Link className="py-2 text-sm text-muted-foreground underline" to={kind === 'note' ? '/learn/my-notes' : '/grace-record'}>{kind === 'note' ? '我的私人筆記' : '我的私人禱告'}</Link><Button onClick={() => compose()}><Plus className="mr-2 h-4 w-4" />{kind === 'note' ? '分享靈修筆記' : '新增小組代禱'}</Button></div>
    {q.isError ? <Notice error={q.error as Error} retry={() => q.refetch()} /> : q.isPending ? <p role="status">載入分享中…</p> : <>
      {!q.data.length && <p className="py-6 text-center text-muted-foreground">{page ? '沒有更多分享。' : kind === 'note' ? '還沒有靈修分享。' : '還沒有小組代禱。'}</p>}
      <div className="space-y-4">{q.data.map(post => <article key={post.id} className="min-w-0 rounded-lg border p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{post.authorName} · {time(post.createdAt)}{post.answered && ' · 已蒙應允'}</p><h3 className="mt-2 text-lg font-semibold">{post.title}</h3></div><div className="flex">{(post.isOwner || post.authorId === actor) && <Button size="icon" variant="ghost" title="編輯分享" aria-label={`編輯 ${post.title}`} onClick={() => compose(post)}><Pencil className="h-4 w-4" /></Button>}{((post.isOwner || post.authorId === actor) || info.manager) && <Button size="icon" variant="ghost" title="撤回分享" aria-label={`撤回 ${post.title}`} disabled={busy} onClick={() => { if (window.confirm('撤回這則分享及其回應？私人原稿不受影響。')) void act(() => request(`/${id}/shares/${post.id}`, 'DELETE')); }}><Trash2 className="h-4 w-4" /></Button>}</div></div>{post.reference && <p className="mt-2 text-sm font-medium text-primary">{post.reference}</p>}<p className="mt-3 whitespace-pre-wrap text-sm leading-7">{post.body}</p><div className="mt-4 flex flex-wrap gap-3 border-t pt-3">{kind === 'prayer' && <Button size="sm" variant={post.prayed ? 'secondary' : 'outline'} disabled={busy || post.prayed} onClick={() => void act(() => request(`/${id}/shares/${post.id}/prayed`, 'PUT', {}))}><Heart className="mr-2 h-4 w-4" />{post.prayed ? '已為你禱告' : '為你禱告'} · {post.prayerCount}</Button>}<Button size="sm" variant="ghost" onClick={() => setComments(post)}><MessageCircle className="mr-2 h-4 w-4" />回應 {post.commentCount}</Button></div></article>)}</div><Pages page={page} setPage={setPage} count={q.data.length} />
    </>}{comments && <Comments id={id} post={comments} actor={actor} manager={info.manager} close={() => setComments(null)} />}
  </section>;
}
function ShareComposer({ id, groupName, kind, reference = '', existing, close }: { id: string; groupName: string; kind: 'note' | 'prayer'; reference?: string; existing?: GroupShare; close: () => void }) {
  const [mutationId] = useState(() => existing?.id || crypto.randomUUID());
  const [title, setTitle] = useState(existing?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  const [ref, setRef] = useState(existing?.reference || reference);
  const [sourceId, setSourceId] = useState('');
  const [consent, setConsent] = useState(false);
  const [answered, setAnswered] = useState(existing?.answered || false);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const q = useGroupQuery<ShareSource[]>(`/sources?kind=${kind}`, !existing);
  const dirty = title !== (existing?.title || '') || body !== (existing?.body || '') || ref !== (existing?.reference || reference) || answered !== (existing?.answered || false);
  return <Dialog open onOpenChange={open => { if (!open && !busy && (!dirty || window.confirm('放棄尚未送出的內容？'))) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl [overflow-wrap:anywhere]"><DialogHeader><DialogTitle>{existing ? '編輯分享' : kind === 'note' ? '分享靈修筆記' : '新增小組代禱'}</DialogTitle><DialogDescription>分享對象：{groupName} 全體成員；私人原稿不變。</DialogDescription></DialogHeader>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await request(`/${id}/shares/${mutationId}`, existing ? 'PATCH' : 'PUT', existing ? { title, body, reference: ref, version: existing.version, answered } : { kind, title, body, reference: ref, sourceId: sourceId || null, consent, anonymous }); await client.invalidateQueries({ queryKey: [base] }); close(); toast.success('已分享至小組'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><fieldset disabled={busy} className="min-w-0 space-y-4">
      {!existing && <Field label={kind === 'note' ? '選擇已儲存的私人筆記' : '選擇私人禱告'}><select className={selectClass} value={sourceId} onChange={e => { const source = q.data?.find(s => s.id === e.target.value); setSourceId(e.target.value); if (source) { setTitle(source.title.slice(0,160)); setBody(source.body); setRef(source.reference); } }}><option value="">自行填寫</option>{q.data?.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select>{q.isError && <span role="status" className="block text-xs text-destructive">私人內容載入失敗，仍可自行填寫。</span>}</Field>}
      <Field label="分享標題"><Input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></Field><Field label="經文出處（選填）"><Input maxLength={500} value={ref} onChange={e => setRef(e.target.value)} /></Field><Field label="分享內容"><Textarea required rows={8} maxLength={12000} value={body} onChange={e => setBody(e.target.value)} /></Field>
      {!existing && kind === 'prayer' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />匿名分享</label>}
      {existing && kind === 'prayer' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={answered} onChange={e => setAnswered(e.target.checked)} />已蒙應允</label>}
      <label className="flex items-start gap-2 text-sm leading-6"><input className="mt-1.5" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />我確認以上內容可分享給 {groupName}，不包含未經同意的他人私密資訊。</label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={!consent || !body.trim() || !title.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{existing ? '儲存修改' : '確認分享至小組'}</Button>
    </fieldset></form>
  </DialogContent></Dialog>;
}
function Comments({ id, post, actor, manager, close }: { id: string; post: GroupShare; actor: string; manager: boolean; close: () => void }) {
  const [body, setBody] = useState(''); const [mutationId, setMutationId] = useState(() => crypto.randomUUID()); const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const client = useQueryClient();
  const path = `/${id}/shares/${post.id}/comments`;
  const q = useGroupQuery<GroupComment[]>(`${path}?offset=${page * 30}`);
  return <Dialog open onOpenChange={open => { if (!open && !busy && (!body || window.confirm('放棄尚未送出的回應？'))) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto [overflow-wrap:anywhere]"><DialogHeader><DialogTitle>小組回應</DialogTitle><DialogDescription>{post.title}</DialogDescription></DialogHeader>
    {q.isError ? <Notice error={q.error as Error} retry={() => q.refetch()} /> : <>
      <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await request(`${path}/${mutationId}`, 'PUT', { body }); setBody(''); setMutationId(crypto.randomUUID()); setPage(0); await client.invalidateQueries({ queryKey: [base] }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }} className="space-y-3"><Field label="寫下回應"><Textarea required maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></Field><Button disabled={busy || !body.trim()}>送出回應</Button></form>
      {q.data?.map(comment => <div key={comment.id} className="border-t pt-3"><div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{comment.authorName} · {time(comment.createdAt)}</p>{(manager || comment.authorId === actor) && <Button disabled={busy} size="icon" variant="ghost" title="撤回回應" aria-label="撤回回應" onClick={async () => { if (!window.confirm('撤回這則回應？')) return; setBusy(true); try { await request(`${path}/${comment.id}`, 'DELETE'); await q.refetch(); await client.invalidateQueries({ queryKey: [base] }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><Trash2 className="h-4 w-4" /></Button>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{comment.body}</p></div>)}<Pages page={page} setPage={setPage} count={q.data?.length || 0} />
    </>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </DialogContent></Dialog>;
}

function CareFeed({ id, actor, info, create, busy, act }: { id: string; actor: string; info: Info; create: () => void; busy: boolean; act: Act }) {
  const [watching, setWatching] = useState(false); const [page, setPage] = useState(0); const [selected, setSelected] = useState<GroupCare | null>(null);
  const q = useGroupQuery<GroupCare[]>(`/${id}/care?offset=${page * 30}&watching=${watching}`);
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={watching} onChange={e => { setWatching(e.target.checked); setPage(0); }} />只看我關注的</label><Button onClick={create}><Plus className="mr-2 h-4 w-4" />新增關懷對象</Button></div>
    {q.isError ? <Notice error={q.error as Error} retry={() => q.refetch()} /> : q.isPending ? <p role="status">正在載入關懷…</p> : <>
      {!q.data.length && <p className="py-6 text-center text-muted-foreground">{watching ? '尚無關注的對象。' : '尚無共同關懷紀錄。'}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{q.data.map(care => <article key={care.id} className="min-w-0 rounded-lg border p-4"><div className="flex items-start justify-between gap-2"><div><span className={`text-xs ${care.status === 'completed' ? 'text-emerald-700' : 'text-muted-foreground'}`}>{careStatuses[care.status]}</span><h3 className="mt-1 text-lg font-semibold">{care.name}</h3></div><Button title={care.watching ? '取消關注' : '關注對象'} aria-label={`${care.watching ? '取消關注' : '關注'} ${care.name}`} aria-pressed={care.watching} variant="ghost" size="icon" disabled={busy} onClick={() => void act(() => request(`/${id}/care/${care.id}/watch`, 'PUT', { watch: !care.watching }))}><Star className={`h-5 w-5 ${care.watching ? 'fill-amber-200 text-amber-700' : ''}`} /></Button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{care.need}</p><dl className="mt-4 space-y-2 border-t pt-3 text-sm"><div><dt className="text-muted-foreground">負責人</dt><dd>{info.members.find(m => m.id === care.responsibleId)?.name || (care.responsibleId ? '原負責人已離組，請重新指派' : '尚未認領')}</dd></div><div><dt className="text-muted-foreground">下一步</dt><dd>{care.nextAction || '尚未安排'}</dd></div><div><dt className="text-muted-foreground">跟進日期</dt><dd className={care.dueDate && care.dueDate < taipeiToday() && care.status !== 'completed' && care.status !== 'paused' ? 'text-amber-800' : ''}>{care.dueDate || '未設定'}</dd></div></dl><p className="mt-3 text-xs text-muted-foreground">{care.watcherCount} 人關注 · 更新 {time(care.updatedAt)}</p><div className="mt-4 flex items-center justify-between gap-2"><Button variant="outline" onClick={() => setSelected(care)}><MessageCircle className="mr-2 h-4 w-4" />進度與跟進</Button>{(care.creatorId === actor || info.manager) && <Button disabled={busy} size="icon" variant="ghost" title="撤回關懷對象" aria-label={`撤回關懷 ${care.name}`} onClick={() => { if (window.confirm('撤回此對象及跟進紀錄，讓小組不再看到？')) void act(() => request(`/${id}/care/${care.id}`, 'DELETE')); }}><Trash2 className="h-4 w-4" /></Button>}</div></article>)}</div><Pages page={page} setPage={setPage} count={q.data.length} />
    </>}{selected && <CareProgress id={id} care={q.data?.find(c => c.id === selected.id) || selected} info={info} close={() => setSelected(null)} />}
  </section>;
}
function Assignment({ members, responsibleId, setResponsible, nextAction, setNext, dueDate, setDue }: { members: GroupMember[]; responsibleId: string; setResponsible: (s: string) => void; nextAction: string; setNext: (s: string) => void; dueDate: string; setDue: (s: string) => void }) {
  return <><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Field label="負責人"><select className={selectClass} value={responsibleId} onChange={e => setResponsible(e.target.value)}><option value="">尚未認領</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="跟進日期"><Input type="date" value={dueDate} onChange={e => setDue(e.target.value)} /></Field></div><Field label="下一步行動"><Input maxLength={1000} value={nextAction} onChange={e => setNext(e.target.value)} /></Field></>;
}
function CareComposer({ id, info, close, existing }: { id: string; info: Info; close: () => void; existing?: GroupCare }) {
  const [editVersion] = useState(existing?.version);
  const [mutationId] = useState(() => existing?.id || crypto.randomUUID()); const [name, setName] = useState(existing?.name || ''); const [need, setNeed] = useState(existing?.need || ''); const [responsibleId, setResponsible] = useState(existing?.responsibleId || ''); const [nextAction, setNext] = useState(existing?.nextAction || ''); const [dueDate, setDue] = useState(existing?.dueDate || ''); const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const client = useQueryClient();
  return <Dialog open onOpenChange={open => { if (!open && !busy && (!(name || need || nextAction || dueDate || responsibleId) || window.confirm('放棄尚未送出的關懷資料？'))) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto [overflow-wrap:anywhere]">
    <DialogHeader><DialogTitle>{existing ? '編輯關懷資料' : '新增共同關懷對象'}</DialogTitle><DialogDescription>{info.name} 全體成員可見。</DialogDescription></DialogHeader>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try {
        await request(`/${id}/care/${mutationId}`, existing ? 'PATCH' : 'PUT', { name, need, responsibleId: responsibleId || null, nextAction, dueDate: dueDate || null, consent, ...(existing ? { version: editVersion } : {}) });
        await client.invalidateQueries({ queryKey: [base] }); close();
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="min-w-0 space-y-4">
      <Field label="稱呼或化名"><Input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="共同關懷的需要"><Textarea required rows={4} maxLength={12000} value={need} onChange={e => setNeed(e.target.value)} /></Field>
      <Assignment members={info.members} {...{ responsibleId, setResponsible, nextAction, setNext, dueDate, setDue }} />
      <label className="flex items-start gap-2 text-sm leading-6"><input className="mt-1.5" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />已取得當事人同意，或已匿名且不含可辨識資訊；不記錄私密診斷、住址或未經同意的細節。</label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={!consent || !name.trim() || !need.trim()}>{existing ? '儲存關懷資料' : '加入共同關懷'}</Button>
    </fieldset></form></DialogContent></Dialog>;
}
function CareProgress({ id, care, info, close }: { id: string; care: GroupCare; info: Info; close: () => void }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(care.version); const [status, setStatus] = useState(care.status); const [body, setBody] = useState(''); const [responsibleId, setResponsible] = useState(care.responsibleId && info.members.some(m => m.id === care.responsibleId) ? care.responsibleId : ''); const [nextAction, setNext] = useState(care.nextAction); const [dueDate, setDue] = useState(care.dueDate || ''); const [mutationId, setMutationId] = useState(() => crypto.randomUUID()); const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const client = useQueryClient();
  const path = `/${id}/care/${care.id}/updates`;
  const q = useGroupQuery<CareUpdate[]>(`${path}?offset=${page * 30}`);
  const changed = version !== care.version;
  if (editing) return <CareComposer id={id} info={info} existing={care} close={() => setEditing(false)} />;
  return <Dialog open onOpenChange={open => { if (!open && !busy && (!body || window.confirm('放棄尚未送出的跟進？'))) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl [overflow-wrap:anywhere]"><DialogHeader><DialogTitle>{care.name} · 關懷進度</DialogTitle><DialogDescription>{care.need}</DialogDescription></DialogHeader>
    {(info.manager || care.creatorId === user?.id) && <Button variant="outline" disabled={busy} onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />編輯關懷資料</Button>}
    {q.isError ? <Notice error={q.error as Error} retry={() => q.refetch()} /> : <><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await request(`${path}/${mutationId}`, 'PUT', { body, status, nextAction, responsibleId: responsibleId || null, dueDate: dueDate || null, version }); setBody(''); setMutationId(crypto.randomUUID()); setPage(0); setVersion(version + 1); await client.invalidateQueries({ queryKey: [base] }); } catch (e) { setError((e as Error).message); await client.invalidateQueries({ queryKey: [base] }); } finally { setBusy(false); } }}><fieldset disabled={busy} className="min-w-0 space-y-4"><Field label="本次跟進紀錄"><Textarea required maxLength={4000} rows={3} value={body} onChange={e => setBody(e.target.value)} /></Field><Field label="關懷階段"><select className={selectClass} value={status} onChange={e => setStatus(e.target.value as GroupCare['status'])}>{Object.entries(careStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Assignment members={info.members} {...{ responsibleId, setResponsible, nextAction, setNext, dueDate, setDue }} />
      {changed && <div role="alert" className="space-y-2 text-sm text-amber-800"><p>已有新的跟進。請先載入最新安排；本次紀錄文字會保留。</p><Button type="button" variant="outline" onClick={() => { setVersion(care.version); setStatus(care.status); setNext(care.nextAction); setDue(care.dueDate || ''); setResponsible(info.members.some(m => m.id === care.responsibleId) ? care.responsibleId! : ''); setMutationId(crypto.randomUUID()); setError(''); }}>載入最新安排</Button></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={!body.trim() || changed}>儲存本次跟進</Button></fieldset></form>
      <h3 className="border-t pt-4 font-semibold">跟進紀錄</h3>{!q.data?.length && <p className="text-sm text-muted-foreground">尚無跟進紀錄。</p>}{q.data?.map(h => <div key={h.id} className="border-l-2 border-emerald-200 pl-4"><p className="text-xs text-muted-foreground">{h.authorName} · {time(h.createdAt)} · {careStatuses[h.status]}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{h.body}</p>{h.nextAction && <p className="mt-2 text-sm">下一步：{h.nextAction}{h.dueDate && ` (${h.dueDate})`}</p>}</div>)}<Pages page={page} setPage={setPage} count={q.data?.length || 0} /></>}
  </DialogContent></Dialog>;
}

function Members({ id, info, actor, close }: { id: string; info: Info; actor: string; close: () => void }) {
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const client = useQueryClient(); const navigate = useNavigate();
  async function act(path: string, method: string, body?: unknown) { setBusy(true); setError(''); try { await request(path, method, body); await client.invalidateQueries({ queryKey: [base] }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto [overflow-wrap:anywhere]"><DialogHeader><DialogTitle>小組成員</DialogTitle><DialogDescription>{info.name}</DialogDescription></DialogHeader>
    {info.manager && <div className="space-y-3 border-b pb-4"><Button disabled={busy} variant="outline" onClick={async () => { if (!window.confirm('產生七天有效的新邀請碼？舊邀請碼會失效，新成員仍須審核。')) return; setBusy(true); setError(''); try { setInvite(await request(`/${id}/invite`, 'POST', {})); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>產生新邀請碼</Button>{invite && <><Field label="小組邀請碼"><Input readOnly value={invite.token} onFocus={e => e.target.select()} /></Field><p className="text-xs text-muted-foreground">有效至 {new Date(invite.expiresAt).toLocaleString('zh-TW')}</p></>}{info.requests.map(r => <div key={r.id} className="flex flex-wrap items-center gap-2 border-t pt-3"><span className="mr-auto">{r.name} · 申請加入</span><Button size="sm" disabled={busy} onClick={() => void act(`/${id}/requests/${r.id}`, 'POST', { approve: true })}>同意</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void act(`/${id}/requests/${r.id}`, 'POST', { approve: false })}>婉拒</Button></div>)}</div>}
    {info.members.map(m => <div key={m.id} className="flex items-center justify-between gap-3 border-b py-2"><span className="text-sm">{m.name}{m.manager ? ' · 小組同工' : ''}{m.id === actor ? '（我）' : ''}</span>{!m.manager && info.manager && m.id !== actor && <Button size="icon" variant="ghost" disabled={busy} title="移出成員" aria-label={`移出 ${m.name}`} onClick={() => { if (window.confirm(`移出 ${m.name}？對方將不能再讀取小組內容。`)) void act(`/${id}/members/${m.id}`, 'DELETE'); }}><Trash2 className="h-4 w-4" /></Button>}</div>)}
    {!info.manager && <Button variant="outline" disabled={busy} onClick={async () => { if (!window.confirm('退出小組？已分享的內容會保留在組內，請先撤回不想保留的內容。')) return; setBusy(true); try { await request(`/${id}/members/${actor}`, 'DELETE'); close(); navigate('/groups'); await client.invalidateQueries({ queryKey: [base] }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>退出小組</Button>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </DialogContent></Dialog>;
}
