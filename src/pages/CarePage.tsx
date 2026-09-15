import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CheckCircle2, Heart, LockKeyhole, Pencil, Plus, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { LeaveConfirmation, UnsavedChangesGuard } from '@/components/layout/UnsavedChangesGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCareContacts, type CareContact, type CareContactInput } from '@/hooks/useCareContacts';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const blank: CareContactInput = { name: '', need: '', nextAction: '', prayer: '' };

export function CarePage() {
  const { user, loading } = useAuth();
  const care = useCareContacts();
  const [tab, setTab] = useState('active');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank);
  const [baseline, setBaseline] = useState(blank);
  const [confirmClose, setConfirmClose] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CareContact | null>(null);
  const [saveError, setSaveError] = useState('');
  const active = care.contacts.filter(contact => !contact.lastCaredAt);
  const history = care.contacts.filter(contact => contact.lastCaredAt);
  const contacts = tab === 'active' ? active : history;
  const busy = care.isCreating || care.isUpdating;
  const dirty = editorOpen && JSON.stringify(draft) !== JSON.stringify(baseline);
  function changeEditor(open: boolean) {
    if (busy) return;
    if (!open && dirty) setConfirmClose(true);
    else setEditorOpen(open);
  }

  function edit(contact?: CareContact) {
    const initial = contact ? { name: contact.name, need: contact.need, nextAction: contact.nextAction, prayer: contact.prayer } : blank;
    setDraft(initial);
    setBaseline(initial);
    setConfirmClose(false);
    setEditingId(contact?.id || null);
    setSaveError('');
    setEditorOpen(true);
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || busy) return;
    setSaveError('');
    const callbacks = {
      onSuccess: () => { setEditorOpen(false); setDraft(blank); toast.success(editingId ? '已更新關懷對象' : '已加入關懷清單'); },
      onError: () => setSaveError('儲存失敗，內容仍保留在這裡，請重試。'),
    };
    const input = { ...draft, name: draft.name.trim() };
    if (editingId) care.updateContact({ id: editingId, input }, callbacks);
    else care.createContact(input, callbacks);
  }
  function record(contactId: string, actionType: 'care' | 'prayer') {
    care.recordAction({ contactId, actionType }, {
      onSuccess: () => { toast.success(actionType === 'care' ? '已記錄這次關心' : '已記下代禱'); },
      onError: () => toast.error('尚未儲存成功，請重試'),
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <UnsavedChangesGuard dirty={dirty} />
      <LeaveConfirmation open={confirmClose} onStay={() => setConfirmClose(false)} onLeave={() => { setConfirmClose(false); setEditorOpen(false); }} />
      <Header title="關懷紀錄" variant="compact" backTo="/" />
      <main className="container mx-auto px-4 py-5 md:px-6 md:py-8">
        <div className="mx-auto max-w-3xl space-y-5 [overflow-wrap:anywhere]">
          {loading ? <p role="status">正在載入...</p> : !user ? (
            <div className="space-y-4 py-8">
              <h2 className="text-xl font-semibold">我的關懷清單</h2>
              <p className="text-sm text-muted-foreground">登入查看自己的關懷對象與紀錄。</p>
              <Button asChild><Link to="/login">登入</Link></Button>
            </div>
          ) : <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />僅自己可見</p>
              <Button onClick={() => edit()} className="min-h-11 gap-2"><Plus className="h-4 w-4" />新增對象</Button>
            </div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">待關心{!care.isLoading && !care.isError && ` (${active.length})`}</TabsTrigger>
                <TabsTrigger value="history">已關心{!care.isLoading && !care.isError && ` (${history.length})`}</TabsTrigger>
              </TabsList>
            </Tabs>
            {care.isLoading ? <p role="status" className="py-6 text-muted-foreground">正在載入關懷清單...</p> : care.isError ? (
              <div role="alert" className="space-y-3 py-6">
                <p>暫時無法載入關懷資料。</p>
                <Button variant="outline" onClick={() => void care.refetch()} className="gap-2"><RefreshCw className="h-4 w-4" />重新載入</Button>
              </div>
            ) : contacts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{tab === 'active' ? '目前沒有待關心的對象。' : '還沒有關懷紀錄。'}</p>
            ) : (
              <ul className="divide-y border-y">
                {contacts.map(contact => (
                  <li key={contact.id} className="space-y-3 py-5" data-testid={`care-contact-${contact.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold">{contact.name}</h2>
                        {contact.lastCaredAt && <p className="mt-1 text-xs text-muted-foreground">上次關心：{new Date(contact.lastCaredAt).toLocaleDateString('zh-TW')}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" aria-label={`編輯${contact.name}`} title="編輯" onClick={() => edit(contact)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`封存${contact.name}`} title="封存" onClick={() => setArchiveTarget(contact)}><Archive className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {contact.need && <p className="whitespace-pre-wrap text-sm leading-6">{contact.need}</p>}
                    {contact.nextAction && <p className="whitespace-pre-wrap text-sm leading-6"><span className="font-medium">下一步：</span>{contact.nextAction}</p>}
                    {contact.prayer && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground"><span className="font-medium">代禱：</span>{contact.prayer}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" className="min-h-11 gap-2" disabled={care.isRecording} onClick={() => record(contact.id, 'prayer')}><Heart className="h-4 w-4" />已代禱{contact.prayerCount > 0 && ` (${contact.prayerCount})`}</Button>
                      <Button variant="secondary" className="min-h-11 gap-2" disabled={care.isRecording} onClick={() => record(contact.id, 'care')}><CheckCircle2 className="h-4 w-4" />{contact.lastCaredAt ? '再次關心' : '已關心'}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>}
        </div>
      </main>
      <Dialog open={editorOpen} onOpenChange={changeEditor}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? '編輯關懷對象' : '新增關懷對象'}</DialogTitle><DialogDescription>僅自己可見</DialogDescription></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="care-name">名字</Label><Input id="care-name" maxLength={80} required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></div>
            {([{ key: 'need', label: '目前需要' }, { key: 'nextAction', label: '下一步' }, { key: 'prayer', label: '代禱方向' }] as const).map(field => (
              <div key={field.key} className="space-y-2"><Label htmlFor={`care-${field.key}`}>{field.label}</Label><AutoResizeTextarea id={`care-${field.key}`} minRows={2} maxRows={5} maxLength={field.key === 'nextAction' ? 300 : 500} value={draft[field.key] || ''} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} /></div>
            ))}
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => changeEditor(false)}>取消</Button><Button type="submit" disabled={busy || !draft.name.trim()}>{busy ? '儲存中...' : '儲存'}</Button></DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!archiveTarget} onOpenChange={open => { if (!open && !care.isArchiving) setArchiveTarget(null); }}>
        <DialogContent><DialogHeader><DialogTitle>封存關懷對象？</DialogTitle><DialogDescription>{archiveTarget?.name}將移出清單，既有紀錄仍會保留。</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={care.isArchiving} onClick={() => setArchiveTarget(null)}>取消</Button><Button disabled={care.isArchiving} onClick={() => archiveTarget && care.archiveContact(archiveTarget.id, { onSuccess: () => { setArchiveTarget(null); toast.success('已封存'); }, onError: () => toast.error('封存失敗，請重試') })}>{care.isArchiving ? '封存中...' : '確認封存'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CarePage;
