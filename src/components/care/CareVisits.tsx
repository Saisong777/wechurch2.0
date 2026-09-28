import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, HandHeart, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { UnsavedChangesGuard, LeaveConfirmation } from '@/components/layout/UnsavedChangesGuard';
import { visitStatusLabels, type VisitRequest } from '@shared/care';
import type { CareContact } from '@/hooks/useCareContacts';
import { toast } from 'sonner';

const base = '/api/care-visits';
const selectClass = 'min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base';
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(base + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '暫時無法處理，請重試。');
  return data as T;
}
function useVisitQuery<T>(path: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({ queryKey: [base, user?.id, path], enabled: !!user && enabled, queryFn: () => request<T>(path), refetchInterval: 30000, retry: false });
}
export function VisitReminder({ always = false }: { always?: boolean }) {
  const q = useVisitQuery<{ canManage: boolean; pending: number; urgent: number }>('/summary');
  if (!q.data?.canManage || (!always && !q.data.pending)) return null;
  return <Link to="/care?view=visits&inbox=1" className="flex min-h-11 flex-wrap items-center gap-2 border-b py-3 font-medium text-primary"><Bell className="h-5 w-5 shrink-0" />牧者探訪{q.data.pending > 0 && <span>待安排 {q.data.pending}</span>}{q.data.urgent > 0 && <span className="text-sm text-destructive">緊急 {q.data.urgent}</span>}</Link>;
}

export function VisitComposer({ contact, close }: { contact?: CareContact; close: () => void }) {
  const [name, setName] = useState(contact?.name || ''), [reason, setReason] = useState(''), [method, setMethod] = useState(''), [urgency, setUrgency] = useState('normal');
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  const id = useRef(crypto.randomUUID()), client = useQueryClient();
  const q = useVisitQuery<{ available: boolean }>('/summary');
  const dirty = name !== (contact?.name || '') || !!reason || !!method || consent || urgency !== 'normal';
  function change(setter: (s: string) => void, value: string) { setter(value); setConsent(false); }
  return <section aria-label="請牧者協助探訪" className="space-y-4 border-y py-5">
    <UnsavedChangesGuard dirty={dirty} /><LeaveConfirmation open={confirm} onStay={() => setConfirm(false)} onLeave={close} />
    <h2 className="flex items-center gap-2 text-lg font-semibold"><HandHeart className="h-5 w-5" />請牧者協助探訪</h2>
    <p className="text-sm text-muted-foreground">以下內容將交給所屬教會的牧者與傳道人。私人關懷筆記不會一併傳送。</p>
    {q.isError ? <p role="alert">無法確認牧者窗口，請稍後重試或直接聯絡教會。</p> : q.data && !q.data.available ? <p role="alert">目前沒有可承接的牧者，請先聯絡教會確認。</p> : null}
    <form onSubmit={async e => { e.preventDefault(); if (busy || !consent) return; setBusy(true); setError(''); try { await request('/' + id.current, 'PUT', { contactId: contact?.id || null, name, reason, contactMethod: method, urgency, consent }); await client.invalidateQueries({ queryKey: [base] }); toast.success('已送至牧者探訪收件匣，可在「牧者探訪」追蹤安排'); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <label className="block space-y-2"><span className="text-sm font-medium">需要探訪的人</span><Input autoFocus required maxLength={80} value={name} onChange={e => change(setName, e.target.value)} /></label>
        <label className="block space-y-2"><span className="text-sm font-medium">希望牧者知道的狀況</span><AutoResizeTextarea required minRows={3} maxRows={8} maxLength={2000} value={reason} onChange={e => change(setReason, e.target.value)} /></label>
        <label className="block space-y-2"><span className="text-sm font-medium">聯絡方式與方便探訪的時間</span><AutoResizeTextarea required minRows={2} maxRows={4} maxLength={300} value={method} onChange={e => change(setMethod, e.target.value)} /></label>
        <fieldset><legend className="mb-2 text-sm font-medium">需要協助的急迫程度</legend><div className="grid grid-cols-2 gap-2">{[['normal', '一般探訪'], ['urgent', '請盡快聯絡']].map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-md border px-3"><input type="radio" name="visit-urgency" value={key} checked={urgency === key} onChange={() => change(setUrgency, key)} />{label}</label>)}</div></fieldset>
        {urgency === 'urgent' && <p role="note" className="text-sm text-destructive">站內申請不保證立即有人看到。請同步電話聯絡教會；有立即生命危險請聯絡緊急救援。</p>}
        <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />我已取得當事人同意，或僅提供必要、可分享的資訊；確認將以上內容送給牧者團隊。</label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => dirty ? setConfirm(true) : close()}>取消</Button><Button type="submit" disabled={busy || !consent || !q.data?.available || !name.trim() || !reason.trim() || !method.trim()}><Send className="mr-2 h-4 w-4" />{busy ? '送出中...' : '確認送給牧者'}</Button></div>
      </fieldset>
    </form>
  </section>;
}

export function CareVisits({ onEditing }: { onEditing: (value: boolean) => void }) {
  const summary = useVisitQuery<{ canManage: boolean; pending: number; urgent: number }>('/summary');
  const [inbox, setInbox] = useState(new URLSearchParams(window.location.search).get('inbox') === '1');
  const [filter, setFilter] = useState('active'), [page, setPage] = useState(0), [compose, setCompose] = useState(false);
  const [selected, setSelected] = useState<VisitRequest | null>(null);
  const manage = inbox && !!summary.data?.canManage;
  const q = useVisitQuery<{ requests: VisitRequest[]; hasMore: boolean }>(`?mode=${manage ? 'inbox' : 'mine'}&filter=${filter}&offset=${page * 30}`, !!summary.data);
  const locked = compose || !!selected;
  useEffect(() => { onEditing(locked); return () => onEditing(false); }, [locked, onEditing]);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{manage ? '牧者探訪收件匣' : '我提出的探訪'}</h2><Button disabled={locked} onClick={() => setCompose(true)}>請牧者協助探訪</Button></div>
    {summary.data?.canManage && <div className="flex gap-2"><Button disabled={locked} aria-pressed={!manage} variant={!manage ? 'secondary' : 'ghost'} onClick={() => { setInbox(false); setPage(0); }}>我提出的</Button><Button disabled={locked} aria-pressed={manage} variant={manage ? 'secondary' : 'ghost'} onClick={() => { setInbox(true); setPage(0); }}>牧者收件匣 ({summary.data.pending})</Button></div>}
    {compose && <VisitComposer close={() => setCompose(false)} />}
    <div className="flex gap-2"><Button disabled={locked} variant={filter === 'active' ? 'secondary' : 'ghost'} aria-pressed={filter === 'active'} onClick={() => { setFilter('active'); setPage(0); }}>待處理與已安排</Button><Button disabled={locked} variant={filter === 'closed' ? 'secondary' : 'ghost'} aria-pressed={filter === 'closed'} onClick={() => { setFilter('closed'); setPage(0); }}>已結束</Button></div>
    {summary.isError || q.isError ? <div role="alert" className="space-y-3"><p>暫時無法載入探訪需求。</p><Button variant="outline" onClick={() => { void summary.refetch(); void q.refetch(); }}>重新載入</Button></div> : !q.data ? <p role="status">載入中...</p> : <>
      {!q.data.requests.length && <p className="py-6 text-muted-foreground">目前沒有這類探訪申請。</p>}
      <ul className="divide-y border-y">{q.data.requests.map(r => <li key={r.id} className="space-y-3 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{r.name}</h3><span className="text-sm">{r.urgency === 'urgent' && <span className="mr-2 font-medium text-destructive">請盡快聯絡</span>}{visitStatusLabels[r.status]}</span></div><p className="line-clamp-2 whitespace-pre-wrap text-sm">{r.reason}</p><p className="text-xs text-muted-foreground">{manage ? `提出者：${r.senderName} · ` : ''}{r.assigneeName ? `負責：${r.assigneeName}` : '尚未指派'}{r.dueDate ? ` · ${r.dueDate}` : ''}</p>{r.nextAction && <p className="text-sm">安排：{r.nextAction}</p>}<Button disabled={locked} variant="outline" onClick={() => setSelected(r)}>{manage ? '查看與安排' : '查看進度'}</Button></li>)}</ul>
      {(page > 0 || q.data.hasMore) && <div className="flex justify-center gap-3"><Button disabled={locked || !page} variant="outline" onClick={() => setPage(page - 1)}>上一頁</Button><Button disabled={locked || !q.data.hasMore} variant="outline" onClick={() => setPage(page + 1)}>下一頁</Button></div>}
    </>}
    {selected && <VisitDetail key={selected.id} initial={selected} manager={manage} close={() => setSelected(null)} />}
  </section>;
}

function VisitDetail({ initial, manager, close }: { initial: VisitRequest; manager: boolean; close: () => void }) {
  const current = useVisitQuery<VisitRequest>('/' + initial.id);
  const row = current.data || initial;
  const [version, setVersion] = useState(row.version), [status, setStatus] = useState(row.status), [assigneeId, setAssignee] = useState(row.assigneeId || ''), [date, setDate] = useState(row.dueDate || ''), [note, setNote] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [page, setPage] = useState(0);
  const events = useVisitQuery<{ events: Array<{ id: string; body: string; authorName: string; createdAt: string }>; hasMore: boolean }>(`/${row.id}/events?offset=${page * 30}`);
  const staff = useVisitQuery<Array<{ id: string; name: string }>>('/staff', manager), client = useQueryClient();
  const dirty = !!note || status !== row.status || assigneeId !== (row.assigneeId || '') || date !== (row.dueDate || '');
  const ended = ['completed', 'cancelled'].includes(row.status), changed = version !== row.version;
  return <section className="space-y-4 border-t pt-4" aria-label="探訪安排與紀錄">
    <UnsavedChangesGuard dirty={dirty} /><LeaveConfirmation open={confirm} onStay={() => setConfirm(false)} onLeave={close} />
    <h3 className="font-semibold">{row.name} · 探訪安排</h3>
    {current.isError && <p role="alert" className="text-destructive">無法取得最新申請或存取權限已變更，暫停更新。</p>}
    <p className="whitespace-pre-wrap text-sm leading-7">{row.reason}</p><p className="whitespace-pre-wrap text-sm">聯絡方式：{row.contactMethod}</p>
    {ended && note && <label className="block space-y-2"><span className="text-sm font-medium">申請已結束，未送出的文字仍保留</span><AutoResizeTextarea readOnly value={note} minRows={3} maxRows={8} /></label>}
    {!ended && <form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await apiRequest('PATCH', base + '/' + row.id, { version, status: manager ? status : 'cancelled', assigneeId: manager ? assigneeId || null : row.assigneeId, dueDate: manager ? date || null : row.dueDate, note }); await client.invalidateQueries({ queryKey: [base] }); toast.success(manager ? '已更新探訪安排' : '已取消申請'); close(); } catch { setError('無法更新，可能已有其他同工處理。請載入最新狀態後重試；你的文字會保留。'); await client.invalidateQueries({ queryKey: [base] }); } finally { setBusy(false); } }}><fieldset disabled={busy || current.isError || current.isPending} className="min-w-0 space-y-4">
      {manager && <><label className="block space-y-2"><span className="text-sm font-medium">探訪狀態</span><select className={selectClass} value={status} onChange={e => setStatus(e.target.value as VisitRequest['status'])}>{Object.entries(visitStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="block space-y-2"><span className="text-sm font-medium">負責探訪的同工</span><select className={selectClass} value={assigneeId} onChange={e => setAssignee(e.target.value)}><option value="">尚未指派</option>{staff.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{staff.isError && <p role="alert">無法載入同工，請重新整理後再安排。</p>}<label className="block min-w-0 space-y-2"><span className="text-sm font-medium">預定探訪日期</span><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></>}
      <label className="block space-y-2"><span className="text-sm font-medium">{manager ? '安排或探訪回報（提出者也看得到）' : '取消原因'}</span><AutoResizeTextarea required minRows={3} maxRows={6} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
      {(changed || error) && <div role="alert" className="space-y-2 text-sm"><p>{error || '其他同工已更新安排，請先載入最新狀態。'}</p><Button type="button" variant="outline" onClick={() => { setVersion(row.version); setStatus(row.status); setAssignee(row.assigneeId || ''); setDate(row.dueDate || ''); setError(''); }}>載入最新安排，保留文字</Button></div>}
      <Button type="submit" disabled={busy || changed || !note.trim() || (manager && staff.isError)}>{busy ? '儲存中...' : manager ? '儲存探訪安排' : '確認取消申請'}</Button>
    </fieldset></form>}
    <h4 className="font-medium">處理紀錄</h4>{events.isError ? <Button variant="outline" onClick={() => void events.refetch()}>重新載入處理紀錄</Button> : events.isPending ? <p role="status">載入中...</p> : <ol className="space-y-3">{events.data?.events.map(e => <li key={e.id} className="border-l-2 pl-3"><p className="text-xs text-muted-foreground">{e.authorName} · {new Date(e.createdAt).toLocaleString('zh-TW')}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-7">{e.body}</p></li>)}</ol>}
    {(page > 0 || events.data?.hasMore) && <div className="flex gap-3"><Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>較新的紀錄</Button><Button variant="outline" disabled={!events.data?.hasMore} onClick={() => setPage(page + 1)}>較早的紀錄</Button></div>}
    <Button variant="ghost" disabled={busy} onClick={() => dirty ? setConfirm(true) : close()}>收起</Button>
  </section>;
}
