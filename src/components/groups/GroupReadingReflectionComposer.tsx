import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { churchFetch, churchScopeKey } from '@/lib/churchFetch';
import { familyBase, familyRequest } from '@/lib/familyApi';
import { queryClient as personalQueryClient } from '@/lib/queryClient';
import { readingReflectionInput, readingReflectionResult, readingNoteResponse, type ReadingNoteResponse, type ReadingReflectionInput } from '@shared/lifeGroup';
import { toast } from 'sonner';

const fields = [['observation', '看見'], ['receiving', '領受'], ['response', '回應']] as const;
type ShareField = typeof fields[number][0];
type Draft = { observation: string; receiving: string; response: string; shareFields: ShareField[]; markRead: boolean; noteId: string | null; noteVersion: number | null; comparisonRequired?: boolean; attempt?: { id: string; input: ReadingReflectionInput; conflict?: boolean; rejectedStatus?: number } };
const knownRejections = new Set([400, 401, 403, 404, 409, 413, 422, 428]);
function draftStorageKey(actor: string, scope: string, groupId: string, date: string, devotionId: string) {
  return `wechurch:group-reading-draft:${JSON.stringify([actor, scope, groupId, date, devotionId])}`;
}
function readDraft(key: string): Draft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!draft || !fields.every(([field]) => typeof draft[field] === 'string') || !Array.isArray(draft.shareFields) || !draft.shareFields.every((field: string) => fields.some(([name]) => name === field)) || typeof draft.markRead !== 'boolean') return null;
    if (draft.attempt && (!/^[a-f0-9-]{36}$/i.test(draft.attempt.id) || !readingReflectionInput.safeParse(draft.attempt.input).success)) return null;
    return draft;
  } catch { return null; }
}
function PreservedDraft({ draft }: { draft: Draft }) {
  const copy = useRef<HTMLTextAreaElement>(null);
  return <section className="min-w-0 space-y-3" aria-label="保留的私人草稿">
    <p className="text-sm text-muted-foreground">草稿仍在此裝置。暫時無法確認筆記或分享權限，請先複製保存，或回看私人筆記；確認權限前不會再次送出。</p>
    <Textarea ref={copy} aria-label="可複製的私人草稿" readOnly rows={10} value={fields.map(([field, label]) => `${label}\n${draft[field]}`).join('\n\n')} />
    <Button type="button" variant="outline" onClick={() => { copy.current?.focus(); copy.current?.select(); }}>選取草稿以複製</Button>
  </section>;
}
export function GroupReadingReflectionComposer({ actor, scope, groupId, groupName, date, entry, close }: {
  actor: string; scope: string; groupId: string; groupName: string; date: string;
  entry: { id: string; version: number; reference: string }; close: () => void;
}) {
  const note = useQuery({
    queryKey: [familyBase, actor, scope, groupId, 'reading-note', date],
    queryFn: async () => readingNoteResponse.parse(await familyRequest<ReadingNoteResponse>(`/${groupId}/reading/note?date=${encodeURIComponent(date)}`)),
    retry: false, staleTime: 0, gcTime: 0,
  });
  if (note.isPending) return <p role="status">正在載入這一天的私人筆記…</p>;
  if (note.isError) {
    const saved = readDraft(draftStorageKey(actor, scope, groupId, date, entry.id));
    return <section className="min-w-0 space-y-3 border-y py-5"><p role="alert">私人筆記載入失敗，請重新載入後再寫，避免覆蓋原稿。</p>{saved && <PreservedDraft draft={saved} />}<Button variant="outline" onClick={() => void note.refetch()}>重新載入私人筆記</Button><Button variant="ghost" asChild><Link to="/learn/my-notes">回看私人筆記</Link></Button><Button variant="ghost" onClick={close}>收起</Button></section>;
  }
  return <Editor key={JSON.stringify([actor, scope, groupId, date, entry.id])} {...{ actor, scope, groupId, groupName, date, entry, close }} initial={note.data} reload={async () => { const result = await note.refetch(); if (result.isError) throw result.error; return result.data!; }} />;
}

function Editor({ actor, scope, groupId, groupName, date, entry, close, initial, reload }: {
  actor: string; scope: string; groupId: string; groupName: string; date: string; entry: { id: string; version: number; reference: string };
  close: () => void; initial: ReadingNoteResponse; reload: () => Promise<ReadingNoteResponse>;
}) {
  const draftKey = draftStorageKey(actor, scope, groupId, date, entry.id);
  const [draft, setDraft] = useState<Draft>(() => readDraft(draftKey) || { observation: initial.note?.observation || '', receiving: initial.note?.receiving || '', response: initial.note?.response || '', noteId: initial.note?.id || null, noteVersion: initial.note?.version || null, shareFields: [], markRead: true });
  const [latestNote, setLatestNote] = useState(initial.note);
  const [compareRequired, setCompareRequired] = useState(!!draft.comparisonRequired);
  const [compareConfirmed, setCompareConfirmed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState(draft.attempt?.conflict ? '上次送出已被拒絕，請重新載入筆記版本並比對保留的草稿。' : draft.attempt ? '上次送出尚未確認，草稿已保留。請先確認原送出結果。' : '');
  const heading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const client = useQueryClient();
  useEffect(() => { mounted.current = true; heading.current?.focus({ preventScroll: true }); return () => { mounted.current = false; }; }, []);
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* Keep the mounted draft when storage is unavailable. */ } }, [draft, draftKey]);
  useEffect(() => { if (preview) previewHeading.current?.focus({ preventScroll: true }); }, [preview]);
  function update(next: Partial<Draft>) { setDraft(previous => ({ ...previous, ...next })); setConsent(false); setPreview(false); setError(''); }
  const selected = fields.filter(([field]) => draft.shareFields.includes(field));
  const staleVersion = (latestNote?.id || null) !== draft.noteId || (latestNote?.version || null) !== draft.noteVersion;
  // Resolve an uncertain original attempt before considering a newer private version.
  // It may already be the result of that attempt; rebasing first could duplicate sharing.
  const needsRebase = draft.attempt ? !!draft.attempt.conflict : staleVersion;
  const canPreview = !needsRebase && (!compareRequired || compareConfirmed) && selected.length > 0 && selected.every(([field]) => draft[field].trim());
  const currentScope = () => churchScopeKey() === scope;
  async function send() {
    if (sending.current || needsRebase || !currentScope() || (!draft.attempt && (!preview || !consent || !canPreview))) return;
    const parsed = readingReflectionInput.safeParse({ devotionVersion: entry.version, noteId: draft.noteId, noteVersion: draft.noteVersion, observation: draft.observation, receiving: draft.receiving, response: draft.response, shareFields: draft.shareFields, markRead: draft.markRead, consent: true });
    if (!draft.attempt && !parsed.success) { setError(parsed.error.issues[0]?.message || '請核對筆記內容。'); return; }
    const attempt = draft.attempt || { id: crypto.randomUUID(), input: parsed.data! };
    if (attempt.conflict) return;
    sending.current = true; setBusy(true); setError('');
    setDraft(previous => ({ ...previous, attempt }));
    try {
      const response = await churchFetch(`${familyBase}/${groupId}/reading/${entry.id}/reflections/${attempt.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.input) });
      // A known HTTP rejection is recoverable even if its error body cannot decode.
      // Transport errors and 5xx responses keep the immutable original attempt.
      if (!response.ok && knownRejections.has(response.status) && mounted.current) setDraft(previous => ({ ...previous, attempt: { ...attempt, conflict: true, rejectedStatus: response.status } }));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || (knownRejections.has(response.status) ? '這次送出已被拒絕，請重新載入筆記並核對。' : '尚未確認送出結果，草稿已保留。'));
      }
      readingReflectionResult.parse(data);
      if (!mounted.current || !currentScope()) return;
      try { sessionStorage.removeItem(draftKey); } catch { /* Storage is optional. */ }
      await Promise.all([
        client.invalidateQueries({ queryKey: [familyBase] }),
        client.invalidateQueries({ queryKey: ['/api/devotional-notes'] }),
        client.invalidateQueries({ queryKey: ['/api/notebook'] }),
        personalQueryClient.invalidateQueries({ queryKey: ['/api/devotional-notes', actor] }),
        personalQueryClient.invalidateQueries({ queryKey: ['/api/notebook'] }),
        client.invalidateQueries({ queryKey: ['/api/church-reading/today'] }),
        client.invalidateQueries({ predicate: query => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/user-reading-') }),
      ]);
      if (!mounted.current || !currentScope()) return;
      toast.success(attempt.input.markRead ? '筆記已儲存、領受已分享，也已標記讀完' : '筆記已儲存，領受已分享至小家');
      close();
    } catch (cause) { if (mounted.current && currentScope()) setError((cause as Error).message); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="min-w-0 scroll-mt-28 space-y-4 border-y py-5" aria-label="這一天的靈修筆記">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">寫下這一天的領受</h3><Button type="button" variant="ghost" disabled={busy} onClick={close}>收起，保留草稿</Button></div>
    <p className="text-sm text-muted-foreground">{date} · {entry.reference}。三欄完整內容會儲存在你的私人筆記；只有勾選的欄位會分享給 {groupName}。</p>
    {(staleVersion || compareRequired) && <section aria-label="最新私人原稿比對" className="space-y-3 border-y py-4 text-sm"><h4 className="font-semibold text-primary">最新私人原稿 · 請與下方草稿比對</h4>{latestNote ? fields.map(([field, label]) => <div key={field}><p className="font-medium">{label}</p><p className="whitespace-pre-wrap leading-7">{latestNote[field] || '（未填寫）'}</p></div>) : <p>這一天目前沒有私人筆記，原稿可能已被移除。</p>}{compareRequired && <label className="flex min-h-11 items-start gap-2 leading-6"><input className="mt-1.5" type="checkbox" checked={compareConfirmed} disabled={busy} onChange={event => { setCompareConfirmed(event.target.checked); setDraft(previous => ({ ...previous, comparisonRequired: !event.target.checked })); setPreview(false); setConsent(false); }} />我已比對最新原稿，確認用下方整理後的三欄儲存私人筆記。</label>}</section>}
    <form onSubmit={event => { event.preventDefault(); void send(); }} className="min-w-0 space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        {fields.map(([field, label]) => <div key={field} className="min-w-0 space-y-2"><label className="block space-y-2 text-sm"><span className="font-medium">{label}</span><Textarea value={draft[field]} readOnly={!!draft.attempt} rows={4} maxLength={5000} className="text-base" onChange={event => { if (!draft.attempt) update({ [field]: event.target.value }); }} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!!draft.attempt} checked={draft.shareFields.includes(field)} onChange={event => update({ shareFields: event.target.checked ? [...draft.shareFields, field] : draft.shareFields.filter(value => value !== field) })} />分享「{label}」給小家</label></div>)}
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!!draft.attempt} checked={draft.markRead} onChange={event => update({ markRead: event.target.checked })} />同時標記已讀完這天進度</label>
        <Button type="button" variant="outline" disabled={!canPreview || !!draft.attempt} onClick={() => { setPreview(true); setConsent(false); }}>預覽要分享的內容</Button>
        {!canPreview && <p className="text-sm text-muted-foreground">請勾選至少一個已有內容的欄位，再預覽分享。</p>}
      </fieldset>
      {preview && <div className="space-y-3 border-y py-4"><h4 ref={previewHeading} tabIndex={-1} className="font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">分享預覽 · {groupName}</h4>{selected.map(([field, label]) => <div key={field}><p className="text-sm font-medium text-primary">{label}</p><p className="mt-1 whitespace-pre-wrap leading-7">{draft[field]}</p></div>)}<p className="text-sm text-muted-foreground">{draft.markRead ? '這次也會標記已讀完。' : '這次不會變更已讀進度。'}</p><label className="flex min-h-11 items-start gap-2 text-sm leading-6"><input className="mt-1.5" type="checkbox" checked={consent} disabled={busy || !!draft.attempt} onChange={event => setConsent(event.target.checked)} />我確認預覽內容可分享給 {groupName}，不包含未經同意的他人私密資訊。</label></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error} 草稿仍保留在這一天。</p>}
      {needsRebase ? <Button type="button" disabled={busy} variant="outline" onClick={async () => {
        if (!currentScope() || !window.confirm('保留目前草稿，重新載入最新筆記版本後再核對分享？')) return;
        setBusy(true);
        try { const latest = await reload(); await client.invalidateQueries({ queryKey: [familyBase] }); if (mounted.current && currentScope()) { setLatestNote(latest.note); setCompareRequired(true); setCompareConfirmed(false); update({ noteId: latest.note?.id || null, noteVersion: latest.note?.version || null, attempt: undefined, comparisonRequired: true }); setError('最新原稿已列在上方；草稿保留在下方。請先比對整理，再預覽並確認分享。'); } } catch (cause) { setError((cause as Error).message); } finally { if (mounted.current) setBusy(false); }
      }}>重新載入筆記版本，保留草稿</Button> : <Button type="submit" disabled={busy || (!draft.attempt && (!preview || !consent || !canPreview))}>{busy ? '正在確認送出…' : draft.attempt ? '重新確認原送出結果' : '儲存筆記並分享至小家'}</Button>}
    </form>
    <Button variant="ghost" asChild><Link to="/learn/my-notes">回看私人筆記</Link></Button>
  </section>;
}
