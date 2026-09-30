import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { FeatureGate } from '@/components/ui/feature-gate';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { DevotionWallShareDialog } from '@/components/scripture/DevotionWallShareDialog';
import { ImportedReadingHistory } from '@/components/scripture/ImportedReadingHistory';
import { NotesLoadNotice } from '@/components/scripture/NotesLoadNotice';
import { ReadingPreferencesControl } from '@/components/theme/ReadingPreferences';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiError, apiRequest } from '@/lib/queryClient';
import { removeLocalDevotionalNote } from '@/lib/localDevotionalNotes';
import { useDevotionalNotes } from '@/hooks/useDevotionalNotes';
import { createDevotionShareDraft } from '@/lib/devotionShareDraft';
import { hasJournalContent, journalDate, journalMarkdown, journalSearchText, journalSections, loadJournalPosition, saveJournalPosition, sortJournal, type JournalNote } from '@/lib/noteJournal';
import { BookOpen, ChevronLeft, ChevronRight, Download, EyeOff, List, Loader2, MoreHorizontal, Pencil, Search, Share2, Trash2, X } from 'lucide-react';
import './note-journal.css';

const displayDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : date;
const displayMonth = (month: string) => /^\d{4}-\d{2}$/.test(month) ? `${month.slice(0, 4)}年${Number(month.slice(5))}月` : month;

function exportNotes(notes: JournalNote[], partial: boolean) {
  const content = `${partial ? '> 尚未取得完整最新資料；以下僅包含目前可用的筆記。\n\n' : ''}# 我的生命札記\n\n` + notes.map(journalMarkdown).join('\n\n---\n\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = '我的生命札記.md'; link.click(); URL.revokeObjectURL(url);
}

function NoteChapter({ note, onExport, editing, setEditing }: { note: JournalNote; onExport: () => void; editing: boolean; setEditing: (open: boolean) => void }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [confirmation, setConfirmation] = useState<'delete' | 'hide' | null>(null);
  const [error, setError] = useState('');
  const local = note.id.startsWith('local-devotional-');
  const pending = local || note.syncStatus === 'pending' || note.syncStatus === 'blocked';
  const sections = journalSections(note);
  const mutation = useMutation({
    mutationFn: async (kind: 'delete' | 'hide') => {
      if (!user || note.userId !== user.id) throw new Error('Invalid note owner');
      if (!local) await apiRequest(kind === 'delete' ? 'DELETE' : 'PATCH', `/api/devotional-notes/${note.id}${kind === 'hide' ? '/hidden' : ''}`, kind === 'delete' ? { version: note.version } : { hidden: true });
      removeLocalDevotionalNote(note.id, user.id);
    },
    onSuccess: async (_, kind) => {
      setConfirmation(null);
      await client.cancelQueries({ queryKey: ['/api/devotional-notes'] });
      client.setQueryData<JournalNote[]>(['/api/devotional-notes', user?.id], notes => notes?.filter(n => n.id !== note.id));
      client.removeQueries({ queryKey: ['/api/devotional-notes', note.id], exact: true });
      void client.invalidateQueries({ queryKey: ['/api/devotional-notes'] });
      void client.invalidateQueries({ queryKey: ['devotion-wall'] });
      void client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string' && /^\/api\/(devotion-wall|life-groups|user-reading-plans)/.test(q.queryKey[0]) });
      toast({ title: kind === 'delete' ? '筆記已刪除' : '筆記已隱藏' });
    },
    onError: e => setError(e instanceof ApiError && [409, 428].includes(e.status) ? '筆記已更新，請重新載入並確認內容後再刪除。' : '未能完成操作，筆記仍保留。請稍後重試。'),
  });

  return <>
    <article className="note-chapter" data-testid={`card-devotional-note-${note.id}`} aria-label={`${displayDate(journalDate(note))}的筆記`}>
      <header className="note-chapter-heading">
        <time dateTime={/^\d{4}-\d{2}-\d{2}$/.test(journalDate(note)) ? journalDate(note) : undefined}>{displayDate(journalDate(note))}</time>
        <h2 tabIndex={-1} id="journal-chapter-title" data-testid={`text-verse-ref-${note.id}`}>{note.verseReference}</h2>
        {note.titlePhrase && <p className="note-chapter-title">{note.titlePhrase}</p>}
        {note.sourceLabel && <p className="note-source">{note.sourceLabel} · 讀經日期</p>}
        {pending && <p role="status" className="note-source">此裝置草稿，尚未同步</p>}
      </header>
      {note.verseText && <details className="note-scripture"><summary>筆記保存的經文</summary><p className="reading-copy">{note.verseText}</p></details>}
      <div id={`note-content-${note.id}`} className="note-chapter-body">
        {sections.map(section => <section key={section.title}><h3>{section.title}</h3><p className="reading-copy">{section.body}</p></section>)}
        {note.heartbeatVerse && note.coreInsightNote && <section><h3>觸動我的經文</h3><p className="reading-copy">{note.heartbeatVerse}</p></section>}
        {!hasJournalContent(note) && <p className="text-muted-foreground">這篇尚未寫下心得。</p>}
      </div>
      <footer className="note-chapter-tools">
        <Button variant="outline" disabled={editing} onClick={() => setEditing(true)} data-testid={`button-edit-note-${note.id}`} aria-expanded={editing}><Pencil aria-hidden="true" />編輯筆記</Button>
        <Button variant="ghost" disabled={pending || editing} onClick={() => setSharing(true)}><Share2 aria-hidden="true" />分享筆記</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button disabled={editing} variant="ghost" size="icon" aria-label="筆記選單" title="筆記選單"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-[calc(100vw-24px)]">
            {note.readingPlanId && <DropdownMenuItem asChild><Link to={`/learn/reading-plans/${note.readingPlanId}/read${note.dayNumber ? `?day=${note.dayNumber}` : ''}`}><BookOpen />前往閱讀</Link></DropdownMenuItem>}
            <DropdownMenuItem onSelect={onExport} data-testid="button-export-notes"><Download />匯出所有筆記</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { setError(''); setConfirmation('hide'); }}><EyeOff />隱藏筆記</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => { setError(''); setConfirmation('delete'); }} data-testid={`button-delete-note-${note.id}`}><Trash2 />刪除筆記</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </footer>
    </article>
    {editing && <DevotionalNoteDialog inline open onOpenChange={setEditing} verseReference={note.verseReference} verseText={note.verseText || ''} noteId={note.id} />}
    {sharing && <DevotionWallShareDialog allowGroup draft={createDevotionShareDraft(note)} close={() => setSharing(false)} />}
    <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open && !mutation.isPending) { setConfirmation(null); setError(''); } }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmation === 'delete' ? '刪除這則筆記？' : '隱藏筆記？'}</AlertDialogTitle>
        <AlertDialogDescription>{confirmation === 'delete' ? `${note.verseReference}。${local ? '移除此裝置的草稿後無法復原；已同步到雲端的筆記不受影響。' : '刪除後無法復原；這則筆記在小家及靈修牆的相關分享也會撤回。讀經打卡不受影響。'}` : '隱藏後不會刪除資料，但不再顯示。'}</AlertDialogDescription></AlertDialogHeader>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>保留筆記</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending} className={confirmation === 'delete' ? 'bg-destructive text-destructive-foreground' : ''} onClick={e => { e.preventDefault(); setError(''); if (confirmation) mutation.mutate(confirmation); }}>{mutation.isPending ? '處理中…' : confirmation === 'delete' ? '確定刪除' : '確定隱藏'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

function JournalReader({ userId }: { userId: string }) {
  const query = useDevotionalNotes<JournalNote>(userId);
  const notes = sortJournal(query.data);
  const readable = notes.filter(n => hasJournalContent(n) || n.syncStatus === 'pending' || n.syncStatus === 'blocked' || n.id.startsWith('local-devotional-'));
  const [selected, setSelected] = useState(() => loadJournalPosition(userId)?.noteId || '');
  const current = notes.find(n => n.id === selected) || readable[0];
  const [directory, setDirectory] = useState(false);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [source, setSource] = useState('all');
  const [editing, setEditing] = useState(false);
  const lastY = useRef(0);
  const restoring = useRef(false);
  const focusChapter = useRef(false);
  const chapterId = current?.id;
  const months = [...new Set(notes.map(n => journalDate(n).slice(0, 7)))];
  const results = notes.filter(n => (month === 'all' || journalDate(n).startsWith(month)) && (source === 'all' || (source === 'plan' ? !!n.readingPlanId : !n.readingPlanId)) && journalSearchText(n).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const index = readable.findIndex(n => n.id === chapterId);
  const older = index >= 0 ? readable[index + 1] : undefined;
  const newer = index > 0 ? readable[index - 1] : undefined;

  useEffect(() => { if (!query.isLoading && !selected && chapterId) setSelected(chapterId); }, [query.isLoading, selected, chapterId]);
  useEffect(() => { if (directory) window.scrollTo({ top: 0, behavior: 'instant' }); }, [directory]);

  // Store only this member's chapter ID and scroll offset, never the note text.
  useLayoutEffect(() => {
    if (!chapterId || directory || editing || query.isLoading) return;
    const saved = loadJournalPosition(userId);
    lastY.current = saved?.noteId === chapterId ? saved.y : 0;
    restoring.current = true;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: lastY.current, behavior: 'instant' });
      if (focusChapter.current) { document.getElementById('journal-chapter-title')?.focus({ preventScroll: true }); focusChapter.current = false; }
      restoring.current = false;
    });
    const remember = () => { if (!restoring.current) lastY.current = Math.max(0, window.scrollY); };
    const save = () => saveJournalPosition(userId, chapterId, lastY.current);
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('pagehide', save);
    return () => { save(); cancelAnimationFrame(frame); window.removeEventListener('scroll', remember); window.removeEventListener('pagehide', save); };
  }, [chapterId, directory, editing, query.isLoading, userId]);

  const openNote = (note: JournalNote) => { focusChapter.current = true; setSelected(note.id); setDirectory(false); };
  const exportAll = () => exportNotes(notes, query.isError);
  return <main className="note-journal" data-testid="my-notes-page">
    <header className="note-journal-toolbar">
      <div><h1>我的筆記</h1><p>我的生命札記</p></div>
      <div className="note-journal-actions">
        <Button variant="outline" disabled={editing} onClick={() => setDirectory(v => !v)} aria-expanded={directory} aria-controls={directory ? 'journal-directory' : undefined}><List aria-hidden="true" />{directory ? '回到閱讀' : '目錄／搜尋'}</Button>
        <ReadingPreferencesControl />
      </div>
    </header>
    {query.isError && <NotesLoadNotice onRetry={() => { void query.refetch(); }} busy={query.isFetching} />}
    {directory ? <section id="journal-directory" aria-label="筆記目錄" className="note-directory">
      <div className="note-directory-filters">
        <label><span>月份</span><select value={month} onChange={e => setMonth(e.target.value)}><option value="all">所有月份</option>{months.map(m => <option key={m} value={m}>{displayMonth(m)}</option>)}</select></label>
        <label><span>來源</span><select value={source} onChange={e => setSource(e.target.value)}><option value="all">所有筆記</option><option value="devotional">靈修筆記</option><option value="plan">讀經計畫</option></select></label>
      </div>
      <div className="note-search"><Search aria-hidden="true" /><Input type="search" aria-label="搜尋筆記" placeholder="搜尋日期、經文或心得" value={search} onChange={e => setSearch(e.target.value)} />{search && <Button size="icon" variant="ghost" aria-label="清除搜尋" onClick={() => setSearch('')}><X /></Button>}</div>
      <p role="status" className="text-sm text-muted-foreground">找到 {results.length} 則</p>
      <ol className="note-directory-list">{results.map(note => <li key={note.id}><button aria-label={`${displayDate(journalDate(note))} ${note.titlePhrase || note.verseReference}`} onClick={() => openNote(note)} aria-current={note.id === chapterId ? 'page' : undefined}><time>{displayDate(journalDate(note))}</time><strong>{note.titlePhrase || note.verseReference}</strong><span>{hasJournalContent(note) ? journalSections(note).map(s => s.body).join(' ').slice(0, 100) : '尚未寫下心得'}{note.syncStatus === 'pending' || note.syncStatus === 'blocked' ? ' · 尚未同步' : ''}</span></button></li>)}</ol>
      {!results.length && !query.isLoading && <p>{search || month !== 'all' || source !== 'all' ? '沒有符合的筆記，試試其他日期或關鍵字。' : '還沒有靈修筆記'}</p>}
      <div className="note-directory-links"><Button variant="ghost" onClick={exportAll} disabled={!notes.length} data-testid="button-export-notes"><Download />{query.isError ? '匯出目前可用筆記' : '匯出所有筆記'}</Button><Link to="/groups?view=note">小家靈修分享</Link><Link to="/devotion-wall">今日靈修牆</Link></div>
      <ImportedReadingHistory userId={userId} />
    </section> : query.isLoading ? <div role="status" className="note-empty"><Loader2 className="animate-spin" />載入筆記中…</div> : current ? <>
      <NoteChapter key={current.id} note={current} onExport={exportAll} editing={editing} setEditing={setEditing} />
      <nav aria-label="篇章導覽" className="note-chapter-navigation">
        <Button variant="ghost" disabled={!older || editing} onClick={() => older && openNote(older)}><ChevronLeft /><span>上一篇{older && <small>{displayDate(journalDate(older))}</small>}</span></Button>
        <Button variant="ghost" disabled={!newer || editing} onClick={() => newer && openNote(newer)}><span>下一篇{newer && <small>{displayDate(journalDate(newer))}</small>}</span><ChevronRight /></Button>
      </nav>
    </> : !query.isError && <section className="note-empty"><BookOpen /><h2>{notes.length ? '還沒有寫下心得' : '還沒有靈修筆記'}</h2><Button asChild><Link to="/learn/church-reading">開始今日靈修</Link></Button><Link to="/groups?view=note">小家靈修分享</Link></section>}
    {!directory && <Link className="note-today-link" to="/learn/church-reading">今日靈修<ChevronRight aria-hidden="true" /></Link>}
  </main>;
}

export default function MyNotesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate('/login?returnTo=%2Flearn%2Fmy-notes', { replace: true }); }, [user, loading, navigate]);
  return <FeatureGate featureKeys={['we_learn']} title="筆記功能維護中" description="筆記功能目前暫時關閉，請稍後再試"><div className="min-h-screen bg-background"><Header variant="compact" title="我的筆記" backTo="/learn" />{user ? <JournalReader key={user.id} userId={user.id} /> : <main className="note-empty"><Loader2 className="animate-spin" data-testid="loading-spinner" /></main>}</div></FeatureGate>;
}
