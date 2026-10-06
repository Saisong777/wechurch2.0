import { churchFetch as fetch } from '@/lib/churchFetch';
import { ChurchPageBoundary } from '@/contexts/ChurchContext';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ChevronDown, ChevronUp, Heart, LockKeyhole, Pencil, Plus, RefreshCw, Search, Users, HandHeart, Undo2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { LeaveConfirmation, UnsavedChangesGuard } from '@/components/layout/UnsavedChangesGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useCareContacts, useCareHistory, type CareContact, type CareContactInput } from '@/hooks/useCareContacts';
import { CareVisits, VisitComposer } from '@/components/care/CareVisits';
import { useAuth } from '@/contexts/AuthContext';
import { careActionLabels, careToday, needsCare } from '@shared/care';
import { toast } from 'sonner';
import { CareReminder } from '@/components/care/CareReminder';

const blank: CareContactInput = { name: '', relationship: '', need: '', nextAction: '', prayer: '', nextCareDate: null };
const selectClass = 'min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base';
const time = (s: string) => new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function CarePage() {
  const { user, loading } = useAuth();
  return <div className="min-h-screen bg-background">
    <Header title="關懷的人" variant="compact" backTo="/" />
    <main className="mx-auto max-w-3xl px-4 py-5 md:py-8 [overflow-wrap:anywhere]">
      {loading ? <p role="status">正在載入...</p> : !user ? <div className="space-y-4 py-8"><h2 className="text-xl font-semibold">我的關懷清單</h2><p>登入查看自己的關懷對象與紀錄。</p><Button asChild><Link to="/login">登入</Link></Button></div> : <CareWorkspace key={user.id} />}
    </main>
  </div>;
}

function CareWorkspace() {
  const care = useCareContacts(true);
  const [params, setParams] = useSearchParams();
  const visits = params.get('view') === 'visits';
  const [tab, setTab] = useState('due'), [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ id: string | null; initial: CareContactInput } | null>(null);
  const [archive, setArchive] = useState<CareContact | null>(null);
  const [visit, setVisit] = useState<CareContact | null>(null);
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [visitEditing, setVisitEditing] = useState(false);
  const locked = !!editor || !!visit || !!activeForm || visitEditing;
  const today = care.today || careToday();
  const active = care.contacts.filter(c => !c.isArchived), due = active.filter(c => needsCare(c, today)), archived = care.contacts.filter(c => c.isArchived);
  const list = (tab === 'due' ? due : tab === 'archived' ? archived : active)
    .filter(c => `${c.name} ${c.relationship || ''} ${c.need}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => (a.nextCareDate || '9999').localeCompare(b.nextCareDate || '9999') || a.name.localeCompare(b.name, 'zh-TW'));
  const editingContact = activeForm ? care.contacts.find(c => c.id === activeForm) : null;
  if (editingContact && !list.some(c => c.id === activeForm)) list.push(editingContact);
  function edit(c?: CareContact) { setEditor({ id: c?.id || null, initial: c ? { name: c.name, relationship: c.relationship || '', need: c.need, nextAction: c.nextAction, prayer: c.prayer, nextCareDate: c.nextCareDate || null } : blank }); }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2 border-b pb-4">
      <Button variant={!visits ? 'secondary' : 'ghost'} disabled={locked} aria-pressed={!visits} onClick={() => setParams({})}>我的關懷</Button>
      <Button variant={visits ? 'secondary' : 'ghost'} disabled={locked} aria-pressed={visits} onClick={() => setParams({ view: 'visits' })}>牧者探訪</Button>
      {!locked && <Button asChild variant="ghost" className="gap-2"><Link to="/groups?view=care"><Users className="h-4 w-4" />小家共同關懷</Link></Button>}
    </div>
    {visits ? <ChurchPageBoundary><CareVisits onEditing={setVisitEditing} /></ChurchPageBoundary> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />僅自己可見</p><Button onClick={() => edit()} disabled={locked} className="min-h-11 gap-2"><Plus className="h-4 w-4" />新增對象</Button></div>
      {editor && <ContactEditor key={editor.id || 'new'} initial={editor.initial} editing={!!editor.id} care={care} id={editor.id} close={() => setEditor(null)} />}
      {visit && <ChurchPageBoundary><VisitComposer contact={visit} close={() => setVisit(null)} /></ChurchPageBoundary>}
      <div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" /><Input type="search" aria-label="搜尋關懷對象" placeholder="搜尋名字、關係或需要" className="min-h-11 pl-10" disabled={locked} value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div role="group" aria-label="關懷清單篩選" className="grid grid-cols-3 gap-1 border-b pb-3">{([['due', '待關心', due.length], ['all', '全部', active.length], ['archived', '已封存', archived.length]] as const).map(([key, label, count]) => <Button key={key} disabled={locked} variant={tab === key ? 'secondary' : 'ghost'} aria-pressed={tab === key} onClick={() => setTab(key)} className="min-h-11 min-w-0 px-1 text-sm">{label}{!care.isLoading && !care.isError && ` (${count})`}</Button>)}</div>
      {care.isLoading ? <p role="status" className="py-6">正在載入關懷清單...</p> : care.isError ? <div role="alert" className="space-y-3 py-6"><p>暫時無法載入關懷資料。</p><Button variant="outline" onClick={() => void care.refetch()}><RefreshCw className="mr-2 h-4 w-4" />重新載入</Button></div> : !list.length ? <div className="space-y-2 py-8 text-center"><HandHeart className="mx-auto h-8 w-8 text-primary" /><p>{search ? '沒有符合的對象。' : tab === 'due' ? '今天沒有待關心的對象。' : tab === 'archived' ? '沒有封存的對象。' : '從一位你想關心的人開始。'}</p></div> : <ul className="divide-y border-b">{list.map(c => <ContactRow key={c.id} contact={c} care={care} locked={locked && activeForm !== c.id} onRecord={open => setActiveForm(open ? c.id : null)} edit={() => edit(c)} archive={() => setArchive(c)} visit={() => setVisit(c)} />)}</ul>}
    </>}
    <Dialog open={!!archive} onOpenChange={open => { if (!open && !care.isArchiving) setArchive(null); }}><DialogContent><DialogHeader><DialogTitle>封存關懷對象？</DialogTitle><DialogDescription>{archive?.name}將移出清單，既有紀錄仍保留，可隨時恢復。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={care.isArchiving} onClick={() => setArchive(null)}>取消</Button><Button disabled={care.isArchiving} onClick={() => archive && care.archiveContact(archive.id, { onSuccess: () => { setArchive(null); toast.success('已封存'); }, onError: () => toast.error('封存失敗，請重試') })}>確認封存</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

type Care = ReturnType<typeof useCareContacts>;
function ContactEditor({ initial, editing, id, care, close }: { initial: CareContactInput; editing: boolean; id: string | null; care: Care; close: () => void }) {
  const [draft, setDraft] = useState(initial), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial), busy = care.isCreating || care.isUpdating;
  return <section aria-label={editing ? '編輯關懷對象' : '新增關懷對象'} className="space-y-4 border-y py-5">
    <UnsavedChangesGuard dirty={dirty} /><LeaveConfirmation open={confirm} onStay={() => setConfirm(false)} onLeave={close} />
    <h2 className="text-lg font-semibold">{editing ? '編輯關懷對象' : '新增關懷對象'}</h2>
    <form onSubmit={e => { e.preventDefault(); if (busy) return; setError(''); const callbacks = { onSuccess: () => { close(); toast.success('已儲存關懷對象'); }, onError: () => setError('儲存失敗，內容仍保留在這裡，請重試。') }; if (id) care.updateContact({ id, input: draft }, callbacks); else care.createContact(draft, callbacks); }}>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="care-name">名字</Label><Input autoFocus id="care-name" maxLength={80} required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="care-relationship">與我的關係</Label><Input id="care-relationship" maxLength={80} value={draft.relationship || ''} onChange={e => setDraft({ ...draft, relationship: e.target.value })} /></div></div>
        <details className="space-y-4"><summary className="min-h-11 cursor-pointer py-3 text-sm text-muted-foreground">補充資料（選填）</summary>
          {([{ key: 'need', label: '目前需要' }, { key: 'prayer', label: '代禱方向' }, ...(initial.nextAction ? [{ key: 'nextAction', label: '先前記下的約定' } as const] : [])] as const).map(f => <div key={f.key} className="space-y-2"><Label htmlFor={`care-${f.key}`}>{f.label}</Label><AutoResizeTextarea id={`care-${f.key}`} minRows={2} maxRows={5} maxLength={f.key === 'nextAction' ? 300 : 500} value={draft[f.key] || ''} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} /></div>)}
        </details>
        <CareReminder value={draft.nextCareDate || ''} onChange={value => setDraft({ ...draft, nextCareDate: value || null })} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => dirty ? setConfirm(true) : close()}>取消</Button><Button type="submit" disabled={busy || !draft.name.trim()}>{busy ? '儲存中...' : '儲存'}</Button></div>
      </fieldset>
    </form>
  </section>;
}

function ContactRow({ contact: c, care, locked, onRecord, edit, archive, visit }: { contact: CareContact; care: Care; locked: boolean; onRecord: (open: boolean) => void; edit: () => void; archive: () => void; visit: () => void }) {
  const [expanded, setExpanded] = useState(false), [recording, setRecording] = useState(false);
  const history = useCareHistory(c.id, expanded), today = care.today || careToday();
  const latestNote = history.data?.pages.flatMap(p => p.actions).find(a => !!a.note?.trim());
  function record(open: boolean) { setRecording(open); onRecord(open); }
  return <li className="py-4" data-testid={`care-contact-${c.id}`}>
    <button className="flex min-h-11 w-full min-w-0 items-center gap-3 text-left" aria-expanded={expanded} aria-controls={`care-detail-${c.id}`} disabled={recording} onClick={() => setExpanded(!expanded)}><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{Array.from(c.name)[0]}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{c.name}<span className="ml-2 text-xs font-normal text-muted-foreground">{c.relationship}</span></span><span className="mt-1 block truncate text-sm text-muted-foreground">{c.need || c.nextAction || '尚未填寫近況'}</span></span>{expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}</button>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className={`text-xs ${c.nextCareDate && c.nextCareDate < today ? 'text-destructive' : 'text-muted-foreground'}`}>{c.isArchived ? '已封存' : c.nextCareDate ? `${c.nextCareDate < today ? '提醒已到期' : c.nextCareDate === today ? '今天提醒' : '提醒我關心'} · ${c.nextCareDate}` : c.lastCaredAt ? `上次關心 ${time(c.lastCaredAt)}` : '尚未聯絡'}</p>{!c.isArchived && <div className="flex gap-1"><Button variant="ghost" className="min-h-11 gap-1 px-2 text-sm" disabled={locked || recording || care.isRecording} onClick={() => care.recordAction({ id: crypto.randomUUID(), contactId: c.id, actionType: 'prayer' }, { onSuccess: () => toast.success('已記下代禱'), onError: () => toast.error('尚未儲存成功，請重試') })}><Heart className="h-4 w-4" />代禱{c.prayerCount > 0 ? ` ${c.prayerCount}` : ''}</Button><Button variant="outline" className="min-h-11 gap-1 px-3 text-sm" disabled={locked || recording} onClick={() => { setExpanded(true); record(true); }}><Pencil className="h-4 w-4" />記錄關心</Button></div>}</div>
    <div id={`care-detail-${c.id}`} hidden={!expanded} className="mt-4 space-y-4 border-t pt-4">
      {recording && <>
        {latestNote && <div className="border-l-2 border-primary/30 pl-3"><p className="text-xs text-muted-foreground">上次記下 · {time(latestNote.createdAt)}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-7">{latestNote.note}</p></div>}
        <CareRecord contact={c} care={care} close={() => record(false)} />
      </>}
      {c.need && <p className="whitespace-pre-wrap text-sm leading-7">{c.need}</p>}{c.nextAction && <p className="whitespace-pre-wrap text-sm">先前記下的約定：{c.nextAction}</p>}{c.prayer && <p className="whitespace-pre-wrap text-sm text-muted-foreground">代禱：{c.prayer}</p>}
      <div className="flex flex-wrap gap-2">{c.isArchived ? <Button variant="outline" disabled={locked || care.isUpdating} onClick={() => care.updateContact({ id: c.id, input: { name: c.name, isArchived: false } }, { onSuccess: () => toast.success('已恢復關懷對象'), onError: () => toast.error('恢復失敗，請重試') })}><Undo2 className="mr-2 h-4 w-4" />恢復關懷</Button> : <><Button variant="outline" disabled={locked || recording} onClick={visit}><HandHeart className="mr-2 h-4 w-4" />請牧者協助探訪</Button><Button variant="ghost" size="icon" aria-label={`編輯${c.name}`} title="編輯" disabled={locked || recording} onClick={edit}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`封存${c.name}`} title="封存" disabled={locked || recording} onClick={archive}><Archive className="h-4 w-4" /></Button></>}</div>
      <h3 className="text-sm font-semibold">關懷歷程</h3>
      {history.isPending ? <p role="status">載入中...</p> : history.isError ? <Button variant="outline" onClick={() => void history.refetch()}>重新載入歷程</Button> : <>{!history.data?.pages[0]?.actions.length && <p className="text-sm text-muted-foreground">還沒有關懷紀錄。</p>}<ol className="space-y-4">{history.data?.pages.flatMap(p => p.actions).map(a => <li key={a.id} className="border-l-2 border-primary/30 pl-3"><p className="text-xs text-muted-foreground">{careActionLabels[a.actionType as keyof typeof careActionLabels] || '關懷'} · {time(a.createdAt)}</p>{a.note && <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{a.note}</p>}</li>)}</ol>{history.hasNextPage && <Button variant="outline" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>較早的紀錄</Button>}</>}
    </div>
  </li>;
}

export function CareRecord({ contact, care, close }: { contact: CareContact; care: Care; close: () => void }) {
  const [actionType, setType] = useState<keyof typeof careActionLabels>('care');
  const [note, setNote] = useState(''), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  const [initialDate] = useState(contact.nextCareDate || '');
  const [date, setDate] = useState(initialDate);
  const [id] = useState(() => crypto.randomUUID());
  const dirty = !!note || date !== initialDate || actionType !== 'care';
  return <form className="space-y-4 border-y py-5" aria-label={`記錄${contact.name}的關心`} onSubmit={e => {
    e.preventDefault();
    if (care.isRecording || !note.trim()) return;
    setError('');
    care.recordAction({ id, contactId: contact.id, actionType, note: note.trim(),
      ...(date !== initialDate ? { nextCareDate: date || null } : {}),
    }, { onSuccess: () => { close(); toast.success('已記錄這次關心'); }, onError: () => setError('儲存失敗，輸入仍保留，請重試。') });
  }}>
    <UnsavedChangesGuard dirty={dirty} /><LeaveConfirmation open={confirm} onStay={() => setConfirm(false)} onLeave={close} />
    <fieldset disabled={care.isRecording} className="min-w-0 space-y-4">
      <div><h3 className="font-semibold">記錄這次關心</h3><p className="mt-1 text-xs text-muted-foreground">寫幾句就好，儲存時會記下時間。</p></div>
      <label className="block space-y-2"><span className="text-sm font-medium">這次聊到什麼？</span><AutoResizeTextarea autoFocus required minRows={3} maxRows={8} maxLength={2000} placeholder="例如：最近工作很累，今天聽他聊了聊，約好週末再聯絡。" value={note} onChange={e => setNote(e.target.value)} /></label>
      <CareReminder value={date} onChange={setDate} />
      {initialDate && !date && <p className="text-xs text-muted-foreground" role="status">儲存後會取消原有提醒。</p>}
      <details className="space-y-2"><summary className="min-h-11 cursor-pointer py-3 text-sm text-muted-foreground">{actionType === 'care' ? '補充關心方式（選填）' : `關心方式：${careActionLabels[actionType]}`}</summary><label className="block space-y-2"><span className="text-sm font-medium">這次如何關心</span><select className={selectClass} value={actionType} onChange={e => setType(e.target.value as keyof typeof careActionLabels)}>{Object.entries(careActionLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></details>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3"><Button type="button" variant="outline" className="min-h-11" onClick={() => dirty ? setConfirm(true) : close()}>取消</Button><Button type="submit" className="min-h-11 flex-1" disabled={care.isRecording || !note.trim()}>{care.isRecording ? '儲存中...' : '儲存紀錄'}</Button></div>
    </fieldset>
  </form>;
}
