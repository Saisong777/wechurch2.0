import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookHeart, Plus, Share2, Search, RefreshCw } from 'lucide-react';
import { UnsavedChangesGuard } from '@/components/layout/UnsavedChangesGuard';
import { PersonalPrayerShareDialog, PrayerDeliveries, usePrayerSharing } from '@/components/prayer/PersonalPrayerSharing';
import { PersonalPrayerEntry } from '@/components/prayer/PersonalPrayerEntry';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { usePersonalPrayers } from '@/hooks/usePersonalPrayers';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function PersonalPrayerPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: records = [], save, isPending, isError, refetch, isFetching } = usePersonalPrayers();
  const deliveries = usePrayerSharing();
  const createId = useRef<string | null>(null);
  const [title, setTitle] = useState('');
  const [prayer, setPrayer] = useState('');
  const [composerOpen, setComposerOpen] = useState(() => searchParams.get('new') === '1');
  const [selected, setSelected] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'waiting' | 'history' | 'all'>('waiting');
  const [limit, setLimit] = useState(20);
  const [editors, setEditors] = useState<Record<string, { open: boolean; dirty: boolean }>>({});
  const onEditorState = useCallback((id: string, open: boolean, dirty: boolean) => {
    setEditors(current => { const next = { ...current }; if (open) next[id] = { open, dirty }; else delete next[id]; return next; });
  }, []);
  const editing = Object.values(editors).some(editor => editor.open);
  const waitingCount = records.filter(r => r.status === 'waiting').length;
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return records.filter(r => (view === 'all' || (view === 'waiting' ? r.status === 'waiting' : r.status !== 'waiting')) &&
      (!needle || `${r.title}\n${r.prayer}\n${r.response}`.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));
  }, [records, search, view]);
  const handleAdd = async () => {
    if (save.isPending || (!title.trim() && !prayer.trim())) return;
    createId.current ||= crypto.randomUUID();
    try {
      await save.mutateAsync({ id: createId.current, create: true, input: {
        title: title.trim() || '今天的禱告', prayer: prayer.trim(), status: 'waiting', response: '', responseType: null,
      } });
      createId.current = null;
      setTitle(''); setPrayer(''); setComposerOpen(false); setSearch(''); setView('waiting'); setLimit(20);
      toast.success('已儲存個人禱告');
    } catch { toast.error('尚未儲存，文字仍保留在此頁。請確認連線與登入狀態後重試。'); }
  };
  return <div className="bg-background">
    <UnsavedChangesGuard dirty={!!user && (!!title.trim() || !!prayer.trim() || Object.values(editors).some(editor => editor.dirty))} />
    <Header title="個人禱告" subtitle="禱告清單與恩典紀錄簿" variant="compact" backTo="/" />
    <main className="container mx-auto px-3 py-4 sm:px-4 md:py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
          <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><BookHeart className="h-6 w-6 text-primary" />個人禱告</h1>
            <p className="mt-2 text-sm text-muted-foreground">私人原稿 · 僅自己可見</p>
            <p className="mt-2 text-sm text-muted-foreground">正在禱告 {waitingCount} · 恩典紀錄 {records.length - waitingCount}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/prayer-wall"><Share2 className="h-4 w-4" />禱告牆</Link></Button>
            {user && !isPending && !isError && <Button aria-expanded={composerOpen} aria-controls="personal-prayer-composer" onClick={() => setComposerOpen(!composerOpen)}><Plus className="h-4 w-4" />{composerOpen ? '收起新增' : '新增禱告'}</Button>}
          </div>
        </section>
        {!user ? <Button asChild><Link to="/login">登入個人禱告</Link></Button>
          : isPending ? <p role="status">正在載入個人禱告…</p>
          : isError ? <div role="alert"><p>目前無法載入個人禱告，既有紀錄沒有被刪除。</p><Button variant="outline" onClick={() => refetch()}>重新載入</Button></div>
          : <>
            <section id="personal-prayer-composer" hidden={!composerOpen} className="space-y-4 border-b pb-5">
              <h2 className="text-lg font-semibold">新增一筆禱告</h2>
              <div className="space-y-2"><Label htmlFor="grace-title">標題</Label><Input id="grace-title" maxLength={160} disabled={save.isPending} value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：家人的健康" /></div>
              <div className="space-y-2"><Label htmlFor="grace-prayer">禱告內容</Label><AutoResizeTextarea id="grace-prayer" maxLength={10000} disabled={save.isPending} minRows={3} maxRows={12} value={prayer} onChange={e => setPrayer(e.target.value)} /></div>
              <Button onClick={handleAdd} disabled={save.isPending || (!title.trim() && !prayer.trim())}><Plus className="h-4 w-4" />{save.isPending ? '儲存中…' : '開始禱告'}</Button>
            </section>
            <section className="space-y-3" aria-label="禱告篩選">
              <fieldset disabled={editing} className="flex flex-wrap gap-2" aria-label="禱告狀態">
                {(['waiting', 'history', 'all'] as const).map(value => <Button key={value} variant={view === value ? 'default' : 'outline'} aria-pressed={view === value} onClick={() => { setView(value); setLimit(20); }}>{value === 'waiting' ? '正在禱告' : value === 'history' ? '恩典紀錄' : '全部'}</Button>)}
                <Button className="ml-auto" variant="ghost" size="icon" title="重新載入禱告" aria-label="重新載入禱告" disabled={isFetching} onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
              </fieldset>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input disabled={editing} className="pl-9" type="search" aria-label="搜尋個人禱告" placeholder="搜尋禱告與回應" value={search} onChange={e => { setSearch(e.target.value); setLimit(20); }} /></div>
            </section>
            {selected.length > 0 && <div className="flex flex-wrap items-center gap-3 border-y py-3" role="region" aria-label="分享選取的禱告"><p className="text-sm">已選 {selected.length} 筆</p><Button variant="outline" onClick={() => setSharing(true)}><Share2 className="h-4 w-4" />分享選取的禱告</Button><Button variant="ghost" onClick={() => setSelected([])}>取消選取</Button></div>}
            {deliveries.isError && <p role="alert" className="text-sm text-destructive">暫時無法確認分享狀態。<button className="ml-2 min-h-11 underline" onClick={() => deliveries.refetch()}>重新載入</button></p>}
            <section className="space-y-4" aria-label="個人禱告清單">
              <p className="text-sm text-muted-foreground" role="status">{filtered.length} 筆禱告</p>
              {filtered.slice(0, limit).map(record => <PersonalPrayerEntry key={record.id} onEditorState={onEditorState} record={record} save={save} selected={selected.includes(record.id)} onSelect={checked => {
                if (checked && selected.length >= 20) { toast.error('每次最多分享 20 筆'); return; }
                setSelected(current => checked ? [...new Set([...current, record.id])] : current.filter(id => id !== record.id));
              }} hasPublicShare={!!deliveries.data?.some(d => d.prayerId === record.id && d.destination === 'public')}>
                <PrayerDeliveries items={deliveries.data?.filter(d => d.prayerId === record.id) || []} busy={deliveries.withdraw.isPending} onWithdraw={d => deliveries.withdraw.mutate(d)} />
              </PersonalPrayerEntry>)}
              {!filtered.length && <p className="py-8 text-center text-muted-foreground">{search ? '找不到符合的禱告，試試其他關鍵字。' : view === 'waiting' ? '目前沒有正在等候的禱告' : '還沒有恩典回應紀錄'}</p>}
              {filtered.length > limit && <Button variant="outline" className="w-full" onClick={() => setLimit(current => current + 20)}>顯示更多禱告</Button>}
            </section>
          </>}
      </div>
    </main>
    {sharing && user && <PersonalPrayerShareDialog records={records.filter(r => selected.includes(r.id))} close={() => setSharing(false)} done={() => { setSharing(false); setSelected([]); }} />}
  </div>;
}

export default function GraceRecordPage() {
  const { user } = useAuth();
  // Never carry one member's drafts into another member's session.
  return <PersonalPrayerPage key={user?.id || 'guest'} />;
}
