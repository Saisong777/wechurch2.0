import { churchFetch as fetch } from '@/lib/churchFetch';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { churchDisplayName } from '@shared/churches';
import { useChurchContext } from '@/contexts/ChurchContext';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError, apiRequest } from '@/lib/queryClient';
import { rememberLoginReturn } from '@/lib/loginReturn';
import { categoryLabels, statusLabels, useFeedbackItems, type FeedbackCategory, type FeedbackItem } from '@/hooks/useFeedback';

type Draft = { church: string | null; category: FeedbackCategory; title: string; body: string; urgency: 'normal' | 'blocked' | 'security'; consent: boolean; location: string; requestId?: string; locked?: boolean };
const draftPrefix = 'wechurch:feedback-draft:';
function clearStoredDraft(key: string) { try { sessionStorage.removeItem(key); } catch { sessionStorage.setItem(key, ''); } }
function sameDraft(a: Draft, b: Draft) { return a.church === b.church && a.category === b.category && a.title.trim() === b.title.trim() && a.body.trim() === b.body.trim() && a.location === b.location && a.urgency === b.urgency; }
function decodeDraft(stored: string | null, location: string): Draft | null {
  if (!stored) return null;
  const parsed = JSON.parse(stored);
  if (!['bug','suggestion','question','other'].includes(parsed.category) || !['normal','blocked','security'].includes(parsed.urgency) || typeof parsed.title !== 'string' || typeof parsed.body !== 'string') return null;
  const requestId = typeof parsed.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(parsed.requestId) ? parsed.requestId : undefined;
  return { church: typeof parsed.church === 'string' ? parsed.church : parsed.church === null ? null : 'IM 行動教會', category:parsed.category, title:parsed.title, body:parsed.body, urgency:parsed.urgency, consent:parsed.consent === true, requestId, locked:parsed.locked === true && !!requestId, location:typeof parsed.location === 'string' && /^\/(?!\/)[A-Za-z0-9_./%-]*$/.test(parsed.location) && parsed.location.length <= 200 ? parsed.location : location };
}
function readDraft(userId: string | undefined, location: string, church: string | null): Draft {
  const empty: Draft = { church, category: 'suggestion', title: '', body: '', urgency: 'normal', consent: false, location };
  try {
    const key = draftPrefix + (userId || 'guest'); const own = sessionStorage.getItem(key);
    const stored = own || (userId ? sessionStorage.getItem(draftPrefix + 'guest') : null);
    const draft = decodeDraft(stored, location); if (!draft) return empty;
    // Only consume the guest draft when it was actually moved into an empty owner slot.
    if (userId && !own) { sessionStorage.setItem(key, stored!); clearStoredDraft(draftPrefix + 'guest'); }
    return draft;
  } catch { return empty; }
}
type PendingDraft = { source: 'guest' | 'saved'; draft: Draft };
function readPendingDrafts(userId: string | undefined): PendingDraft[] {
  if (!userId) return [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftPrefix + userId + ':saved') || '[]');
    const pending: PendingDraft[] = Array.isArray(saved) ? saved.map(value => decodeDraft(JSON.stringify(value), '/feedback')).filter((value): value is Draft => !!value).map(draft => ({source:'saved' as const,draft})) : [];
    const guest = decodeDraft(sessionStorage.getItem(draftPrefix + 'guest'), '/feedback');
    if (guest) pending.push({source:'guest',draft:guest});
    const current = decodeDraft(sessionStorage.getItem(draftPrefix + userId), '/feedback');
    return current ? pending.filter(item => !sameDraft(item.draft,current)) : pending;
  } catch { return []; }
}
export default function FeedbackPage() {
  const { user, loading } = useAuth(); const location = useLocation();
  const context = useChurchContext();
  const currentChurch = context ? context.data?.selectedChurch ?? null : 'IM 行動教會';
  const contextReady = !context || (!context.loading && !context.error && !!currentChurch);
  const [draft, setDraft] = useState<Draft>(() => readDraft(user?.id, (location.state as { from?: string } | null)?.from?.split(/[?#]/)[0] || location.pathname, user ? currentChurch : null));
  const [pendingDrafts, setPendingDrafts] = useState<PendingDraft[]>(() => readPendingDrafts(user?.id));
  const [cooldown, setCooldown] = useState(0);
  const [loginRequired, setLoginRequired] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [receipt, setReceipt] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const query = useFeedbackItems(false, user?.id, `?offset=${offset}`);
  const titleLength = Array.from(draft.title.trim()).length; const bodyLength = Array.from(draft.body.trim()).length;
  const validLength = titleLength >= 3 && titleLength <= 120 && bodyLength >= 10 && bodyLength <= 5000;
  const storageKey = draftPrefix + (user?.id || 'guest');
  const wrongChurch = !!draft.church && draft.church !== currentChurch;
  const unboundAttempt = !draft.church && !!draft.requestId;
  const scopeBlocked = !contextReady || wrongChurch || unboundAttempt;
  useEffect(() => { if (user && contextReady && !draft.church && !draft.requestId) setDraft(d => ({...d,church:currentChurch})); }, [user,contextReady,currentChurch,draft.church,draft.requestId]);
  useEffect(() => { try { if (draft.title || draft.body || draft.requestId) sessionStorage.setItem(storageKey, JSON.stringify(draft)); else clearStoredDraft(storageKey); } catch { /* Draft remains in memory; storage is optional. */ } }, [draft, storageKey]);
  useEffect(() => { if (cooldown <= 0) return; const timer = window.setTimeout(() => setCooldown(n => n - 1), 1000); return () => window.clearTimeout(timer); }, [cooldown]);
  const chooseDraft = (index: number) => {
    if (!user || draft.locked || busy) return;
    const selected = pendingDrafts[index]; if (!selected) return;
    const next = pendingDrafts.filter((_,i) => i !== index);
    if (draft.title || draft.body) next.push({source:'saved',draft});
    const keys = [storageKey + ':saved',storageKey,draftPrefix + 'guest'];
    const before = new Map<string,string | null>();
    try {
      for (const key of keys) before.set(key,sessionStorage.getItem(key));
      // Owner drafts never enter the shared guest slot, including after account switching.
      sessionStorage.setItem(storageKey + ':saved', JSON.stringify(next.filter(item => item.source === 'saved').map(item => item.draft)));
      sessionStorage.setItem(storageKey, JSON.stringify(selected.draft));
      if (selected.source === 'guest') clearStoredDraft(draftPrefix + 'guest');
      setPendingDrafts(next); setDraft(selected.draft); setError(''); setReceipt(null);
    } catch {
      // A partial write must not leave a stale saved copy that revives after sending.
      for (const [key,value] of before) { try { if (value === null) clearStoredDraft(key); else sessionStorage.setItem(key,value); } catch { /* Keep both in memory if the browser rejects rollback too. */ } }
      setError('目前無法儲存另一份草稿，尚未切換。請先複製兩份內容，再繼續操作。');
    }
  };
  const update = (patch: Partial<Draft>) => { if (!draft.locked) { setReceipt(null); setDraft(d => ({ ...d, ...patch })); } };
  const submit = async () => {
    if (!user || busy || cooldown > 0 || scopeBlocked || !draft.consent || !validLength) return;
    const requestId = draft.requestId || crypto.randomUUID();
    const payload = { ...draft, title: draft.title.trim(), body: draft.body.trim(), requestId, consent: true as const };
    // Persist the exact attempt before sending. A lost response is retried with this ID.
    const locked = { ...payload, locked: true }; setDraft(locked); setBusy(true); setError(''); setLoginRequired(false);
    try { sessionStorage.setItem(storageKey, JSON.stringify(locked)); } catch { /* Keep exact attempt in memory. */ }
    try {
      const response = await apiRequest('POST', '/api/feedback', { requestId, category: payload.category, title: payload.title, body: payload.body, location: payload.location, urgency: payload.urgency, consent: true });
      const data: { feedback: FeedbackItem } = await response.json();
      const remaining = pendingDrafts.filter(item => !sameDraft(item.draft,payload));
      setPendingDrafts(remaining);
      try {
        sessionStorage.setItem(storageKey + ':saved',JSON.stringify(remaining.filter(item => item.source === 'saved').map(item => item.draft)));
        const guest = decodeDraft(sessionStorage.getItem(draftPrefix + 'guest'),'/feedback');
        if (guest && sameDraft(guest,payload)) clearStoredDraft(draftPrefix + 'guest');
      } catch { /* Receipt is confirmed; never turn a storage error into an uncertain send. */ }
      setReceipt(data.feedback.id); setDraft({ church: currentChurch, category: 'suggestion', title: '', body: '', urgency: 'normal', consent: false, location: location.pathname });
      void query.refetch();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 400) { setDraft(d => ({...d,locked:false,requestId:undefined})); setError('意見格式不正確。標題請填 3～120 字，內容請填 10～5000 字，再重新送出。'); }
      else if (failure instanceof ApiError && failure.status === 429) { setCooldown(60); setError('送出次數較多，請稍後再試。內容與編號已保留，不會重複新增。'); }
      else if (failure instanceof ApiError && failure.status === 401) { setLoginRequired(true); setError('登入已過期。內容與送出編號已保留，登入後可繼續確認。'); }
      else setError('尚未確認送出結果。內容已保留，請按「重新確認送出」；會使用同一筆編號，不重複新增。');
    }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-background"><Header title="意見反饋" backTo="/" /><main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold">讓 WeChurch 更好用</h1><p className="mt-3 leading-7 text-muted-foreground">遇到操作問題、想提出建議，或不知道怎麼使用，都可以在這裡告訴我們。管理團隊會閱讀原文，AI 協助摘要與建議處理順序；意見不會公開給其他會友。</p><p className="mt-2 text-sm leading-6 text-muted-foreground">請勿填入密碼、驗證碼、他人的私人內容或緊急求助資訊。需要立即的協助，請直接聯絡同工。</p>
    {pendingDrafts.length > 0 && <section className="mt-5 rounded-md border p-4"><h2 className="font-semibold">還有其他未完成的草稿</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">每份內容都會保留。選另一份時，目前內容會另存為這個帳號的草稿。{draft.locked ? '目前這份的送出結果尚未確認，請先確認，再切換草稿。' : ''}</p><ul className="mt-3 space-y-2">{pendingDrafts.map((item,index) => <li key={index}><p className="text-sm break-words">{item.source === 'guest' ? '登入前草稿' : '這個帳號的另一份草稿'}：{item.draft.title}</p><Button type="button" variant="outline" className="mt-1" disabled={busy || draft.locked} onClick={() => chooseDraft(index)}>接續這份草稿</Button></li>)}</ul></section>}
    {wrongChurch && <p role="alert" className="mt-5 rounded-md border p-3 leading-6">這份意見是寫給〔{churchDisplayName(draft.church!)}〕，切回該教會後再送出。內容與送出編號已保留。</p>}
    {unboundAttempt && <p role="alert" className="mt-5 leading-6">這份意見的原教會無法確認，請先聯繫管理者；內容與送出編號已保留。</p>}
    {user && !contextReady && <p role="status" className="mt-5 leading-6">{context?.error || (context?.loading ? '正在確認意見送往的教會…' : '教會歸屬等待管理者核定，草稿已保留。')}</p>}
    {user && contextReady && !wrongChurch && !unboundAttempt && <p className="mt-4 text-sm text-muted-foreground">這份意見送往：{churchDisplayName(currentChurch!)}</p>}
    <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={busy || draft.locked} className="space-y-4"><div><label htmlFor="feedback-category" className="block font-medium">意見類型</label><select id="feedback-category" className="mt-2 min-h-11 w-full rounded-md border bg-background px-3" value={draft.category} onChange={e => update({category:e.target.value as FeedbackCategory})}>{Object.entries(categoryLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label htmlFor="feedback-title" className="block font-medium">簡短標題</label><Input id="feedback-title" className="mt-2" aria-describedby="feedback-title-count" aria-invalid={titleLength > 120 || undefined} value={draft.title} required placeholder="例如：讀經後找不到自己的筆記" onChange={e => update({title:e.target.value})} /><p id="feedback-title-count" className={`mt-1 text-sm ${titleLength > 120 ? 'text-destructive' : 'text-muted-foreground'}`}>{titleLength} / 120 字，至少 3 字</p></div>
      <div><label htmlFor="feedback-body" className="block font-medium">內容與操作步驟</label><Textarea id="feedback-body" className="mt-2 min-h-40" aria-describedby="feedback-body-count" aria-invalid={bodyLength > 5000 || undefined} required value={draft.body} placeholder="你在哪個畫面？做了什麼？看到什麼結果？希望如何改善？" onChange={e => update({body:e.target.value})} /><p id="feedback-body-count" className={`mt-1 text-sm ${bodyLength > 5000 ? 'text-destructive' : 'text-muted-foreground'}`}>{bodyLength} / 5000 字，至少 10 字</p></div>
      <div><label htmlFor="feedback-urgency" className="block font-medium">目前的影響</label><select id="feedback-urgency" className="mt-2 min-h-11 w-full rounded-md border bg-background px-3" value={draft.urgency} onChange={e => update({urgency:e.target.value as Draft['urgency']})}><option value="normal">仍能使用，提出疑問或建議</option><option value="blocked">無法完成操作</option><option value="security">疑似資料或帳號安全問題</option></select></div>
      <label className="flex items-start gap-3 py-2 leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.consent} onChange={e => update({consent:e.target.checked})} /><span>我同意管理團隊閱讀這份意見，並由 AI 協助整理與判斷處理順序。</span></label></fieldset>
      {error && <p role="alert" className="text-destructive leading-6">{error}</p>}{loginRequired && <Button asChild variant="outline" onClick={() => rememberLoginReturn('/feedback')}><Link to="/login?returnTo=%2Ffeedback">重新登入後確認</Link></Button>}{receipt && <p role="status" className="rounded-md bg-primary/10 p-3 leading-6">已收到你的意見。可在下面查看處理進度。</p>}
      {loading ? <p role="status">正在確認登入狀態…</p> : !user ? <div className="border-t pt-4"><p className="leading-6">登入後才能送出及查看處理進度。草稿會在這個分頁保留；若瀏覽器禁止儲存，請先複製內容再登入。</p><Button asChild className="mt-3" onClick={() => rememberLoginReturn('/feedback')}><Link to="/login?returnTo=%2Ffeedback">登入後繼續送出</Link></Button></div> : <Button type="submit" className="min-h-11" disabled={busy || cooldown > 0 || scopeBlocked || !draft.consent || !validLength}>{busy ? '正在確認…' : cooldown > 0 ? `請稍候 ${cooldown} 秒` : draft.locked ? '重新確認送出' : '送出意見'}</Button>}
    </form>
    {user && <section className="mt-8 border-t pt-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">我的意見與進度</h2><Button variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>更新進度</Button></div>{query.isPending && <p role="status" className="py-4">正在載入…</p>}{query.isError && <p role="alert" className="py-4">暫時無法取得意見，請按「更新進度」重試。</p>}{!query.isPending && !query.isError && !query.data?.items.length && <p className="py-6 text-muted-foreground">還沒有送出的意見。</p>}<ul className="divide-y">{query.data?.items.map(item => <li key={item.id} className="py-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><span className="text-sm text-primary">{statusLabels[item.status]}</span></div><p className="mt-2 whitespace-pre-wrap leading-7">{item.body}</p><p className="mt-2 text-sm text-muted-foreground">{categoryLabels[item.category]} · {new Date(item.createdAt).toLocaleDateString('zh-TW')}</p>{item.publicReply && <div className="mt-3 border-l-2 border-primary pl-3"><p className="text-sm font-medium">管理團隊回覆</p><p className="mt-1 whitespace-pre-wrap leading-7">{item.publicReply}</p></div>}</li>)}</ul>{(offset > 0 || query.data?.hasMore) && <div className="flex justify-center gap-3"><Button variant="outline" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(n => Math.max(0,n-50))}>上一頁</Button><Button variant="outline" disabled={!query.data?.hasMore || query.isFetching} onClick={() => setOffset(n => n+50)}>下一頁</Button></div>}</section>}
  </main></div>;
}
