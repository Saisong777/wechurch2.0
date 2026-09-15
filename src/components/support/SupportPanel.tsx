import { useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UnsavedChangesGuard } from '@/components/layout/UnsavedChangesGuard';
import { mayTransitionSupport, supportStatusLabels, supportStatuses, type SupportEvent, type SupportRequest, type SupportStatus, type SupportTarget } from '@shared/support';

const base = '/api/support';
const selectClass = 'min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm';
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(base + path, { method, credentials: 'include', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '暫時無法完成，請保留輸入後重試。');
  return data;
}
function useSupport<T>(path: string, enabled = true) {
  const { user } = useAuth();
  return useQuery<T>({ queryKey: [base, user?.id, path], queryFn: () => request<T>(path), enabled: !!user && enabled, staleTime: 0, retry: false });
}
export const useSupportAccess = () => useSupport<{ canWork: boolean; canConfigure: boolean }>('/access');
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-sm"><span>{label}</span>{children}</label>;
}
function Failure({ error, retry }: { error: Error | null; retry: () => void }) {
  return <div role="alert" className="space-y-3"><p>{error?.message || '無法載入。'}</p><Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />重試</Button></div>;
}
const targetKey = (target: SupportTarget) => `${target.kind}:${target.id}:${target.receiverId}`;
function TargetPicker({ targets, value, change }: { targets: SupportTarget[]; value: string; change: (value: string) => void }) {
  return <Field label="分享對象"><select required className={selectClass} value={value} onChange={e => change(e.target.value)}><option value="">選擇一位陪伴者</option>{targets.map(t => <option key={targetKey(t)} value={targetKey(t)}>{t.name} · {t.receiverName}</option>)}</select></Field>;
}

export function SupportPanel({ mode }: { mode: 'personal' | 'work' }) {
  const { user, loading } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [page, setPage] = useState(0);
  const filter = search.get('supportFilter') || (mode === 'work' ? 'active' : 'all');
  const id = search.get('support');
  const q = useSupport<{ requests: SupportRequest[]; hasMore: boolean }>(`/requests?mode=${mode}&offset=${page * 30}&filter=${encodeURIComponent(filter)}`);
  const [creating, setCreating] = useState(false);
  const select = (next: string | null) => setSearch(previous => { const params = new URLSearchParams(previous); if (next) params.set('support', next); else params.delete('support'); return params; });
  if (loading) return <p role="status">載入中…</p>;
  if (!user) return <Button asChild><Link to={`/login?returnTo=${encodeURIComponent(mode === 'work' ? '/work' : '/support')}`}>登入後繼續</Link></Button>;
  if (id) return <SupportDetail key={`${user.id}:${id}`} id={id} back={() => select(null)} />;
  if (creating) return <SupportComposer key={user.id} cancel={() => setCreating(false)} done={next => { flushSync(() => setCreating(false)); select(next); }} />;
  return <section className="space-y-5 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{mode === 'personal' ? '我的求助與陪伴' : '待辦與承接'}</h2><div className="flex gap-2"><Button size="icon" variant="ghost" title="重新載入" aria-label="重新載入" onClick={() => void q.refetch()}><RefreshCw className="h-4 w-4" /></Button>{mode === 'personal' && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />尋求陪伴</Button>}</div></div>
    <Field label="篩選事項"><select className={selectClass} value={filter} onChange={e => { const value=e.target.value; setPage(0); setSearch(previous => { const params=new URLSearchParams(previous);params.set('supportFilter',value);return params; }); }}><option value="all">全部</option><option value="active">待處理</option><option value="open">待承接</option><option value="waiting">等待回覆或支援</option><option value="closed">已結束</option></select></Field>
    {q.isError ? <Failure error={q.error} retry={() => void q.refetch()} /> : q.isPending ? <p role="status">載入事項中…</p> : <>
      {!q.data.requests.length && <p className="border-y py-8 text-muted-foreground">{mode === 'work' ? '目前沒有交給你的事項。' : '目前沒有求助事項。'}</p>}
      <ul className="divide-y border-y">{q.data.requests.map(r => <li key={r.id}><button onClick={() => select(r.id)} className="flex w-full min-w-0 items-center justify-between gap-4 py-4 text-left hover:bg-muted/40"><div className="min-w-0"><p className="font-medium">{r.title}</p><p className="mt-1 text-sm text-muted-foreground">{mode === 'work' ? r.senderName : r.receiverName} · {supportStatusLabels[r.status]}{r.dueDate ? ` · ${r.dueDate}` : ''}</p>{r.nextAction && <p className="mt-2 text-sm">下一步：{r.nextAction}</p>}</div><ArrowRight className="h-4 w-4 shrink-0" /></button></li>)}</ul>
      <div className="flex items-center justify-center gap-4"><Button size="icon" variant="outline" aria-label="上一頁" title="上一頁" disabled={!page} onClick={() => setPage(page - 1)}><ArrowLeft className="h-4 w-4" /></Button><span className="text-sm">第 {page + 1} 頁</span><Button size="icon" variant="outline" aria-label="下一頁" title="下一頁" disabled={!q.data.hasMore} onClick={() => setPage(page + 1)}><ArrowRight className="h-4 w-4" /></Button></div>
    </>}
  </section>;
}

function SupportComposer({ cancel, done }: { cancel: () => void; done: (id: string) => void }) {
  const targets = useSupport<SupportTarget[]>('/targets');
  const client = useQueryClient();
  const operation = useRef(crypto.randomUUID());
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [target, setTarget] = useState('');
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dirty = !!(title || body);
  async function submit() {
    setBusy(true); setError('');
    try {
      const selected = targets.data?.find(t => targetKey(t) === target);
      if (!selected || !consent) throw new Error('請選擇陪伴者並確認分享。');
      const { kind, id, receiverId } = selected;
      const result = await request<{ id: string }>(`/requests/${operation.current}`, 'PUT', { title, body, target: { kind, id, receiverId }, consent });
      await client.invalidateQueries({ queryKey: [base] }); setTitle(''); setBody(''); done(result.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={e => { e.preventDefault(); if(!busy)void submit(); }}><fieldset disabled={busy} className="min-w-0 space-y-4">
    <UnsavedChangesGuard dirty={dirty} /><h2 className="text-lg font-semibold">尋求陪伴</h2>
    {targets.isError ? <Failure error={targets.error} retry={() => void targets.refetch()} /> : targets.isPending ? <p role="status">載入陪伴者中…</p> : !targets.data.length ? <p>目前沒有可選的陪伴者，請先加入小組，或聯絡教會安排。</p> : <TargetPicker targets={targets.data} value={target} change={setTarget} />}
    <Field label="事項"><Input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></Field>
    <Field label="希望得到的陪伴"><Textarea required maxLength={10000} rows={6} value={body} onChange={e => setBody(e.target.value)} /></Field>
    <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />我同意將這項內容分享給所選陪伴者；不會公開到小組或牆上。</label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !consent || !target}><Send className="mr-2 h-4 w-4" />{busy ? '送出中…' : '送出'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm('放棄尚未送出的內容？')) cancel(); }}>取消</Button></div>
  </fieldset></form>;
}

function SupportDetail({ id, back }: { id: string; back: () => void }) {
  const q = useSupport<{ request: SupportRequest; events: SupportEvent[]; hasOlderEvents: boolean }>(`/requests/${id}`);
  const targets = useSupport<SupportTarget[]>('/targets');
  const client = useQueryClient();
  const [reply, setReply] = useState(''), [privateNote, setPrivateNote] = useState(false), [nextAction, setNextAction] = useState<string>(), [date, setDate] = useState<string>();
  const [status, setStatus] = useState<SupportStatus>('accepted'), [target, setTarget] = useState(''), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const replyId = useRef(crypto.randomUUID());
  const dirty = !!reply || nextAction !== undefined || date !== undefined || !!target;
  async function act(path: string, method: string, body: unknown, after?: () => void) {
    setBusy(true); setError('');
    try { await request(path, method, body); after?.(); await client.invalidateQueries({ queryKey: [base] }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (q.isError) return <div className="space-y-4"><Button variant="ghost" onClick={back}><ArrowLeft className="mr-2 h-4 w-4" />事項列表</Button><Failure error={q.error} retry={() => void q.refetch()} /></div>;
  if (!q.data) return <p role="status">載入事項中…</p>;
  const r = q.data.request;
  const options = supportStatuses.filter(s => mayTransitionSupport(r.status, s, r.isSender));
  const selectedStatus = options.includes(status) ? status : options[0];
  const selectedTarget = targets.data?.find(t => targetKey(t) === target);
  return <section className="space-y-5 [overflow-wrap:anywhere]">
    <UnsavedChangesGuard dirty={dirty} /><div className="flex items-center justify-between"><Button variant="ghost" onClick={() => { if (!dirty || window.confirm('放棄尚未儲存的內容？')) back(); }}><ArrowLeft className="mr-2 h-4 w-4" />事項列表</Button><Button variant="ghost" size="icon" title="重新載入最新狀態，保留輸入" aria-label="重新載入最新狀態，保留輸入" onClick={() => void q.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
    <div className="space-y-2 border-b pb-5"><h2 className="text-xl font-semibold">{r.title}</h2><p className="text-sm text-muted-foreground">{r.senderName} → {r.receiverName} · {supportStatusLabels[r.status]}</p><p className="whitespace-pre-wrap leading-7">{r.body}</p>{r.nextAction && <p>下一步：{r.nextAction}</p>}{r.dueDate && <p>預定跟進：{r.dueDate}</p>}</div>
    <h3 className="font-semibold">跟進紀錄</h3>{q.data.hasOlderEvents && <p className="text-sm text-muted-foreground">顯示最近 500 則紀錄。</p>}
    {!q.data.events.length && <p className="text-muted-foreground">尚未有回覆。</p>}
    <ol className="divide-y">{q.data.events.map(e => <li key={e.id} className="space-y-2 py-4"><p className="text-sm text-muted-foreground">{e.authorName} · {new Date(e.createdAt).toLocaleString('zh-TW')}{e.private && ' · 僅自己可見'}</p><p className="whitespace-pre-wrap leading-7">{e.body}</p></li>)}</ol>
    {r.status !== 'cancelled' && <form className="space-y-3 border-t pt-5" onSubmit={e => { e.preventDefault(); void act(`/requests/${id}/replies/${replyId.current}`, 'PUT', { version: r.version, body: reply, private: privateNote }, () => { setReply(''); replyId.current = crypto.randomUUID(); }); }}><Field label="回覆"><Textarea required maxLength={10000} rows={4} value={reply} onChange={e => setReply(e.target.value)} /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={privateNote} onChange={e => setPrivateNote(e.target.checked)} />僅自己備註，不傳給對方</label><Button disabled={busy || !reply.trim()} type="submit"><Send className="mr-2 h-4 w-4" />{privateNote ? '儲存私人備註' : '傳送回覆'}</Button></form>}
    {!!options.length && <form className="space-y-3 border-t pt-5" onSubmit={e => { e.preventDefault(); if (selectedStatus) void act(`/requests/${id}`, 'PATCH', { version: r.version, status: selectedStatus, nextAction: nextAction ?? r.nextAction, dueDate: (date ?? r.dueDate) || null }, () => { setNextAction(undefined); setDate(undefined); }); }}><Field label="更新狀態"><select className={selectClass} value={selectedStatus} onChange={e => setStatus(e.target.value as SupportStatus)}>{options.map(s => <option key={s} value={s}>{supportStatusLabels[s]}</option>)}</select></Field>{!r.isSender && <><Field label="下一步或退回原因"><Textarea maxLength={1000} value={nextAction ?? r.nextAction ?? ''} onChange={e => setNextAction(e.target.value)} /></Field><Field label="預定跟進日期"><Input type="date" value={date ?? r.dueDate ?? ''} onChange={e => setDate(e.target.value)} /></Field></>}<Button type="submit" disabled={busy}>確認更新</Button></form>}
    {r.isSender && <details className="border-t pt-5"><summary className="min-h-11 cursor-pointer font-medium">更換陪伴者</summary><div className="space-y-3 pt-3"><TargetPicker targets={targets.data || []} value={target} change={setTarget} /><label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />我同意將事項與雙方公開回覆交給新陪伴者。原陪伴者將無法繼續存取；私人備註不轉交。</label><Button disabled={busy || !selectedTarget || !consent} onClick={() => { if (selectedTarget) { const { kind, id: targetId, receiverId } = selectedTarget; void act(`/requests/${id}/transfer`, 'POST', { version: r.version, target: { kind, id: targetId, receiverId }, consent }, () => { setTarget(''); setConsent(false); }); } }}>確認轉交</Button></div></details>}
    {error && <div role="alert" className="space-y-2 text-destructive"><p>{error}</p><Button variant="outline" onClick={() => void q.refetch()}>載入最新狀態，保留輸入</Button></div>}
  </section>;
}

export function SupportDestinations() {
  const q = useSupport<{ destinations: Array<{ id: string; name: string; isActive: boolean }>; receivers: Array<{ id: string; name: string; church: string }> }>('/config');
  const client = useQueryClient();
  const [name, setName] = useState(''), [ownerId, setOwnerId] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function act(path: string, method: string, body: unknown) { setBusy(true); setError(''); try { await request(path, method, body); setName(''); await client.invalidateQueries({ queryKey: [base] }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <section className="space-y-4"><h2 className="text-lg font-semibold">教會陪伴窗口</h2>{q.isError ? <Failure error={q.error} retry={() => void q.refetch()} /> : !q.data ? <p role="status">載入中…</p> : <><ul className="divide-y">{q.data.destinations.map(d => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{d.name}</span><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={d.isActive} disabled={busy} onChange={e => { if (e.target.checked || window.confirm('停用後，陪伴者將無法存取此窗口的既有事項。請先請本人轉交尚未完成的事項。確定停用？')) void act(`/config/${d.id}`, 'PATCH', { isActive: e.target.checked }); }} />啟用</label></li>)}</ul><form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); void act('/config', 'POST', { name, ownerId }); }}><Field label="窗口名稱"><Input required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="負責同工"><select required className={selectClass} value={ownerId} onChange={e => setOwnerId(e.target.value)}><option value="">選擇同工</option>{q.data.receivers.map(r => <option key={r.id} value={r.id}>{r.church} · {r.name}</option>)}</select></Field><Button type="submit" disabled={busy || !ownerId}><Plus className="mr-2 h-4 w-4" />新增窗口</Button></form></>}{error && <p role="alert" className="text-destructive">{error}</p>}</section>;
}
