import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlignLeft, ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Copy, Image, List, Minus, PenLine, Plus, Search, Share2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeatureGate } from '@/components/ui/feature-gate';
import { DevotionalNoteDialog } from './DevotionalNoteDialog';
import { ScriptureCardCreator } from './ScriptureCardCreator';
import { ScriptureTTS } from './ScriptureTTS';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import './bible-study.css';

type Attribution = { source_id: string; source_name: string; license: string; metadata: Record<string, string> };
type Entry = Attribution & { id: string; body: string; title?: string; preview?: string; definition?: string; word?: string; pronunciation?: string; gloss?: string; original_url?: string; extra?: Record<string, unknown> };
type Verse = Entry & { verse: number; end_verse: number; reference?: string };
type Info = { books: { id: number; name: string; chapters: number }[]; translations: Record<string, string>; default_translation: string; release_id: string; sources: { id: string; name: string; license: string; metadata: Record<string, string> }[]; note_sources: string[] };
type TokenData = { tokens: { word: string; gloss: string; pronunciation: string; morph: string; terms: string[] }[]; language: string; note: string; attributions: Attribution[] };
type Saved = { id: string; verseReference: string };
type Popup = { action: string; title: string; query: Record<string, string | number> };

export async function studyFetch<T>(action: string, query: Record<string, string | number> = {}, signal?: AbortSignal): Promise<T> {
  const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  const response = await fetch(`/api/bible-study/${action}?${params}`, { credentials: 'include', signal });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || '資料暫時無法讀取，請重試。');
  }
  return response.json();
}
function useStudy<T>(action: string, params: Record<string, string | number> = {}, enabled = true) {
  return useQuery<T>({ queryKey: ['bible-study', action, params], queryFn: ({ signal }) => studyFetch<T>(action, params, signal), enabled, staleTime: 3600000 });
}
function safeLink(url?: string) { return url && /^https?:\/\//i.test(url) ? url : undefined; }
export function quoteCredit(value: Attribution) {
  const copyright = value.source_id === 'cmncbt'
    ? 'Copyright © 1979, 2005, 2007, 2012, 2023 by Biblica, Inc.'
    : value.source_id === 'engwebp' ? 'World English Bible · Public Domain' : value.metadata.attribution;
  return `${value.source_name}\n${copyright}\n${value.license} · ${value.metadata.license_url}`;
}
function Credit({ value }: { value: Attribution }) {
  return <details className="study-credit"><summary>{value.source_name} · {value.license}</summary>
    <p>{value.metadata.attribution}</p>
    {safeLink(value.metadata.license_url) && <a href={value.metadata.license_url} target="_blank" rel="noreferrer">授權條款</a>}
    {safeLink(value.metadata.credit_url) && <> · <a href={value.metadata.credit_url} target="_blank" rel="noreferrer">來源署名</a></>}
    {safeLink(value.metadata.repository) && <> · <a href={value.metadata.repository} target="_blank" rel="noreferrer">原始來源</a></>}
    {!value.metadata.repository && safeLink(value.metadata.source) && <> · <a href={value.metadata.source} target="_blank" rel="noreferrer">原始來源</a></>}
    <p>{value.metadata.changes}</p><p>{value.metadata.quality_note}</p>
    {value.metadata.revision && <p>版本：{value.metadata.revision}</p>}
  </details>;
}
function TextEntry({ entry }: { entry: Entry }) {
  return <article className="study-entry">
    {entry.title && <h3>{entry.title}</h3>}
    {entry.word && <p className="study-word" dir="auto">{entry.word} <small dir="ltr">{entry.pronunciation}</small></p>}
    <p className="study-body" dir="auto">{entry.definition || entry.body}</p>
    {entry.extra && <p className="text-sm text-muted-foreground">{entry.extra.review_level && entry.extra.review_level !== 'None' ? `上游審閱標記：${String(entry.extra.review_level)}` : '上游未標示人工審閱'}</p>}
    {safeLink(entry.original_url) && <a href={entry.original_url} target="_blank" rel="noreferrer">查看來源條目</a>}
    <Credit value={entry} />
  </article>;
}
function LoadState({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => unknown }) {
  if (loading) return <p role="status" className="py-6 text-muted-foreground">載入中…</p>;
  if (error) return <div role="alert" className="py-6"><p>{error.message}</p><Button variant="outline" onClick={() => retry()}>重試</Button></div>;
  return null;
}
function Preview({ popup, close }: { popup: Popup | null; close: () => void }) {
  const result = useStudy<Entry | Entry[] | { verses: Verse[] }>(popup?.action || 'info', popup?.query || {}, !!popup);
  // A disabled query may still contain cached info; never render it as a text entry on close.
  const data = popup ? result.data : undefined;
  const entries: Entry[] = !data ? [] : Array.isArray(data) ? data : 'verses' in data ? data.verses.map(v => ({ ...v, title: v.reference })) : [data];
  return <Dialog open={!!popup} onOpenChange={open => { if (!open) close(); }}><DialogContent className="study-popup">
    <DialogHeader><DialogTitle>{popup?.title}</DialogTitle><DialogDescription>關閉後回到原本的經節</DialogDescription></DialogHeader>
    <LoadState loading={result.isPending} error={result.error} retry={result.refetch} />
    {!result.isPending && !result.error && entries.length === 0 && <p>目前沒有對應資料。</p>}
    {entries.map(entry => <TextEntry key={entry.id} entry={entry} />)}
  </DialogContent></Dialog>;
}
function StudyTools({ info, book, chapter, verse, translation, open }: { info: Info; book: number; chapter: number; verse: number; translation: string; open: (p: Popup) => void }) {
  const [tab, setTab] = useState('notes');
  const [source, setSource] = useState(info.note_sources[0]);
  const [item, setItem] = useState(0);
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [filter, setFilter] = useState('');
  const params = { book, chapter, verse };
  const notes = useStudy<Entry[]>('notes', { ...params, source }, tab === 'notes');
  const tokens = useStudy<TokenData>('tokens', params, tab === 'tokens');
  const xrefs = useStudy<{ start: number; end: number; label: string }[]>('xrefs', params, tab === 'xrefs');
  const results = useStudy<Entry[]>('search', { q: submitted, ...(filter ? { source: filter } : {}) }, tab === 'search' && submitted.length >= 2);
  useEffect(() => setItem(0), [book, chapter, verse, source]);
  const current = notes.data?.[Math.min(item, notes.data.length - 1)];
  const xrefSource = info.sources.find(s => s.id === 'openbible-crossrefs');
  return <section className="study-tools" aria-label="經節查考">
    <div className="study-tool-tabs" role="tablist" aria-label="查考類別">{[['notes', '註釋'], ['tokens', '原文'], ['xrefs', '串珠'], ['search', '搜尋']].map(([id, label]) =>
      <button type="button" key={id} role="tab" aria-selected={tab === id} aria-controls="study-tool-content" id={`study-tab-${id}`} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div id="study-tool-content" role="tabpanel" aria-labelledby={`study-tab-${tab}`}>
      {tab === 'notes' && <>
        <label>參考書<select value={source} onChange={e => setSource(e.target.value)}>{info.note_sources.map(id => <option key={id} value={id}>{info.sources.find(s => s.id === id)?.name || id}</option>)}</select></label>
        <LoadState loading={notes.isPending} error={notes.error} retry={notes.refetch} />
        {!notes.isPending && !notes.error && !notes.data?.length && <p className="py-6 text-muted-foreground">這本參考書目前沒有此節的註釋。</p>}
        {!!notes.data?.length && <><label>條目<select value={Math.min(item, notes.data.length - 1)} onChange={e => setItem(Number(e.target.value))}>{notes.data.map((n, i) => <option key={n.id} value={i}>{i + 1}. {n.title}</option>)}</select></label>
          {current && <TextEntry entry={current} />}
          <div className="study-actions"><Button size="icon" variant="outline" aria-label="上一則註釋" disabled={item <= 0} onClick={() => setItem(i => i - 1)}><ChevronLeft /></Button><span>{item + 1} / {notes.data.length}</span><Button size="icon" variant="outline" aria-label="下一則註釋" disabled={item >= notes.data.length - 1} onClick={() => setItem(i => i + 1)}><ChevronRight /></Button></div>
        </>}
      </>}
      {tab === 'tokens' && <>
        <LoadState loading={tokens.isPending} error={tokens.error} retry={tokens.refetch} />
        {tokens.data && <><p className="study-limit">{tokens.data.note}</p>
          <div className="study-tokens" dir={tokens.data.language === 'he' ? 'rtl' : 'ltr'}>{tokens.data.tokens.map((token, i) => <div key={i}>
            <span className="study-word">{token.word}</span><span dir="ltr">{token.pronunciation}</span><span dir="ltr">{token.gloss}</span><small dir="ltr">{token.morph}</small>
            {token.terms.map(t => <button key={t} onClick={() => open({ action: 'dictionary', title: t, query: { term: t } })}>{t}</button>)}
          </div>)}</div>
          {tokens.data.tokens.length === 0 && <p>目前沒有此節的原文資料。</p>}
          {tokens.data.attributions.map(a => <Credit key={a.source_id} value={a} />)}
        </>}
        <form className="study-actions" onSubmit={e => { e.preventDefault(); open({ action: 'dictionary', title: term.toUpperCase(), query: { term } }); }}>
          <Input aria-label="Strong 字號" placeholder="H430 或 G25" value={term} onChange={e => setTerm(e.target.value)} pattern="[GHgh][0-9]{1,5}" required />
          <Button type="submit" size="icon" aria-label="查字典"><Search /></Button>
        </form>
      </>}
      {tab === 'xrefs' && <><LoadState loading={xrefs.isPending} error={xrefs.error} retry={xrefs.refetch} />
        <div className="study-xrefs">{xrefs.data?.map((x, i) => <button key={`${x.start}-${x.end}-${i}`} onClick={() => open({ action: 'preview', title: x.label, query: { start: x.start, end: x.end, translation } })}>{x.label}<ChevronRight size={16} /></button>)}</div>
        {!xrefs.isPending && !xrefs.error && !xrefs.data?.length && <p>目前沒有此節的串珠資料。</p>}
        {xrefSource && <Credit value={{ ...xrefSource, source_id: xrefSource.id, source_name: xrefSource.name }} />}
      </>}
      {tab === 'search' && <>
        <form onSubmit={e => { e.preventDefault(); setSubmitted(search.trim()); }}>
          <label>搜尋範圍<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">所有來源</option>{info.sources.filter(s => s.id !== 'openbible-crossrefs').map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          <div className="study-actions"><Input aria-label="搜尋經文與參考資料" placeholder="輸入至少兩個字" minLength={2} maxLength={100} value={search} onChange={e => setSearch(e.target.value)} required /><Button type="submit" size="icon" aria-label="搜尋"><Search /></Button></div>
        </form>
        {submitted.length >= 2 && <><LoadState loading={results.isPending} error={results.error} retry={results.refetch} />
          {results.data?.map(entry => <button className="study-search-result" key={entry.id} onClick={() => open({ action: 'item', title: entry.title || '搜尋結果', query: { id: entry.id } })}><strong>{entry.title}</strong><span>{entry.preview}</span><small>{entry.source_name}</small></button>)}
          {!results.isPending && !results.error && !results.data?.length && <p>沒有找到符合的資料。</p>}
          {results.data?.length === 40 && <p className="study-limit">顯示前 40 筆結果，請縮小關鍵字或搜尋範圍。</p>}
        </>}
      </>}
    </div>
  </section>;
}

export default function BibleStudyReader() {
  const info = useStudy<Info>('info');
  return <FeatureGate featureKeys={['we_learn', 'bible_reading']} title="聖經閱讀功能維護中" description="聖經閱讀功能目前暫時關閉，請稍後再試">
    <Header variant="compact" title="聖經" backTo="/learn" />
    <main className="study-reader"><LoadState loading={info.isPending} error={info.error} retry={info.refetch} />{info.data && <ReadingSurface info={info.data} />}</main>
  </FeatureGate>;
}
function ReadingSurface({ info }: { info: Info }) {
  const [url, setUrl] = useSearchParams();
  const validInt = (text: string | null, max: number) => Number.isInteger(Number(text)) ? Math.max(1, Math.min(max, Number(text) || 1)) : 1;
  const book = validInt(url.get('book'), 66), chapter = validInt(url.get('chapter'), info.books[book - 1].chapters);
  const [translation, setTranslation] = useState(() => {
    try { const saved = localStorage.getItem('study-translation'); if (saved && Object.keys(info.translations).includes(saved)) return saved; } catch { /* Storage is optional. */ }
    return info.default_translation;
  });
  const [compare, setCompare] = useState(false);
  const [comparison, setComparison] = useState('cmncbt');
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [paragraph, setParagraph] = useState(false);
  const [verse, setVerse] = useState(validInt(url.get('verse'), 176));
  const [fontSize, setFontSize] = useState(() => { try { return Math.max(16, Math.min(30, Number(localStorage.getItem('study-font-size')) || 20)); } catch { return 20; } });
  const [tools, setTools] = useState(false);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [note, setNote] = useState<{ reference: string; text: string } | null>(null);
  const [card, setCard] = useState<{ reference: string; text: string } | null>(null);
  const verseRefs = useRef(new Map<number, HTMLButtonElement>());
  const { user } = useAuth();
  const { toast } = useToast();
  const client = useQueryClient();
  const available = translation !== 'cmnfeb' || book >= 40;
  const primary = useStudy<Verse[]>('chapter', { book, chapter, translation }, available);
  const comparisonIds = Object.keys(info.translations).filter(id => id !== translation && (id !== 'cmnfeb' || book >= 40));
  const other = comparisonIds.includes(comparison) ? comparison : comparisonIds[0];
  const parallel = useStudy<Verse[]>('chapter', { book, chapter, translation: other }, compare);
  const saved = useQuery<Saved[]>({ queryKey: ['/api/saved-verses'], enabled: !!user });
  const chosen = primary.data?.find(v => v.verse <= verse && v.end_verse >= verse) || primary.data?.[0];
  const label = (v: Verse) => `${v.verse}${v.end_verse !== v.verse ? `–${v.end_verse}` : ''}`;
  const reference = chosen ? `${info.books[book - 1].name} ${chapter}:${label(chosen)}（${info.translations[translation]}）` : '';
  const currentSaved = saved.data?.find(s => s.verseReference === reference);
  const selected = primary.data?.filter(v => selection.has(v.verse)) || [];
  const excerpt = selected.length ? selected : chosen ? [chosen] : [];
  const excerptReference = excerpt.length ? `${info.books[book - 1].name} ${chapter}:${excerpt.map(label).join(',')}（${info.translations[translation]}）` : '';
  const excerptText = excerpt.map(v => `${label(v)} ${v.body}`).join('\n');
  const citation = chosen ? quoteCredit(chosen) : '';
  const quoted = chosen ? `${excerptReference}\n${excerptText}\n\n${citation}` : '';
  const save = useMutation({ mutationFn: async () => {
    if (!chosen) return;
    if (currentSaved) await apiRequest('DELETE', `/api/saved-verses/${currentSaved.id}`);
    else await apiRequest('POST', '/api/saved-verses', { verseReference: reference, verseText: chosen.body, bookName: info.books[book - 1].name, chapter, verseStart: chosen.verse, verseEnd: chosen.end_verse, notes: citation });
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: ['/api/saved-verses'] }); toast({ title: currentSaved ? '已取消收藏' : '已收藏' }); }, onError: () => toast({ title: '收藏未完成，請重試', variant: 'destructive' }) });
  useEffect(() => { setVerse(validInt(url.get('verse'), 176)); }, [url]);
  useEffect(() => { setSelection(new Set()); }, [book, chapter, translation]);
  useEffect(() => { try { localStorage.setItem('study-translation', translation); } catch { /* Reading still works without storage. */ } }, [translation]);
  useEffect(() => { try { localStorage.setItem('study-font-size', String(fontSize)); } catch { /* Reading still works without storage. */ } }, [fontSize]);
  const navigate = (b: number, ch: number) => {
    setUrl({ book: String(b), chapter: String(ch) }); setVerse(1); window.scrollTo({ top: 0 });
  };
  const next = (direction: number) => {
    const ch = chapter + direction;
    if (ch > info.books[book - 1].chapters && book < 66) navigate(book + 1, 1);
    else if (ch < 1 && book > 1) navigate(book - 1, info.books[book - 2].chapters);
    else if (ch >= 1 && ch <= info.books[book - 1].chapters) navigate(book, ch);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(quoted); toast({ title: '已複製經文與來源' }); } catch { toast({ title: '複製失敗，請手動選取經文', variant: 'destructive' }); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: excerptReference, text: quoted }); else await copy(); } catch (e) { if ((e as Error).name !== 'AbortError') toast({ title: '分享未完成', variant: 'destructive' }); } };
  const openNote = () => {
    if (!note) setNote({ reference: excerptReference, text: `${excerptText}\n\n${citation}` });
    else document.getElementById('study-note')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <>
    <div className="study-controls">
      <label>書卷<select aria-label="書卷" value={book} onChange={e => navigate(Number(e.target.value), 1)}>{info.books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label>章<select aria-label="章" value={chapter} onChange={e => navigate(book, Number(e.target.value))}>{Array.from({ length: info.books[book - 1].chapters }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
      <label className="study-translation">譯本<select value={translation} aria-label="譯本" onChange={e => setTranslation(e.target.value)}>{Object.entries(info.translations).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="study-check"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />譯本對照</label>
      <div className="study-actions"><Button variant="ghost" size="icon" title="縮小字體" aria-label="縮小字體" disabled={fontSize <= 16} onClick={() => setFontSize(f => f - 2)}><Minus /></Button><span>{fontSize}</span><Button variant="ghost" size="icon" title="放大字體" aria-label="放大字體" disabled={fontSize >= 30} onClick={() => setFontSize(f => f + 2)}><Plus /></Button></div>
      {compare && <label className="study-translation study-comparison">對照譯本<select aria-label="對照譯本" value={other} onChange={e => setComparison(e.target.value)}>{comparisonIds.map(id => <option key={id} value={id}>{info.translations[id]}</option>)}</select></label>}
    </div>
    <div className="study-heading"><h1>{info.books[book - 1].name} {chapter}</h1><div className="study-actions">
      <Button variant="outline" size="icon" aria-label="上一章" disabled={book === 1 && chapter === 1} onClick={() => next(-1)}><ChevronLeft /></Button>
      <Button variant="outline" size="icon" aria-label="下一章" disabled={book === 66 && chapter === info.books[65].chapters} onClick={() => next(1)}><ChevronRight /></Button>
      <Button variant={tools ? 'default' : 'outline'} onClick={() => setTools(t => !t)} aria-expanded={tools} aria-controls="study-references">查考</Button>
    </div></div>
    <div className="study-actions study-member-actions">
      {chosen && <><span className="study-selected">{selected.length ? `已選 ${selected.length} 段` : `第 ${label(chosen)} 節`}</span>
        {selected.length > 0 && <Button variant="ghost" onClick={() => setSelection(new Set())}>清除選取</Button>}
        <Button size="icon" variant="ghost" title="複製經文" aria-label="複製經文" onClick={copy}><Copy /></Button>
        <Button size="icon" variant="ghost" title="分享經文" aria-label="分享經文" onClick={share}><Share2 /></Button>
        <Button size="icon" variant="ghost" title="製作經文圖卡" aria-label="製作經文圖卡" onClick={() => setCard({ reference: `${excerptReference}\n${citation}`, text: excerptText })}><Image /></Button>
        {user ? <><Button size="icon" variant="ghost" title={currentSaved ? '取消收藏' : '收藏經文'} aria-label={currentSaved ? '取消收藏' : '收藏經文'} disabled={save.isPending || saved.isPending || saved.isError} onClick={() => save.mutate()}>{currentSaved ? <BookmarkCheck /> : <Bookmark />}</Button>
          <Button variant="outline" onClick={openNote}><PenLine size={18} className="mr-2" />寫筆記</Button></> : <Button variant="outline" asChild><Link to="/login">登入寫筆記與收藏</Link></Button>}
        <ScriptureTTS compact label={selected.length ? '朗讀已選' : '朗讀整章'} text={(selected.length ? selected : primary.data || []).map(v => v.body).join(' ')} />
        <Button variant="ghost" size="icon" aria-label={paragraph ? '逐節閱讀' : '段落閱讀'} title={paragraph ? '逐節閱讀' : '段落閱讀'} disabled={compare} onClick={() => setParagraph(p => !p)}>{paragraph ? <List /> : <AlignLeft />}</Button>
      </>}
      {saved.isError && <Button variant="ghost" onClick={() => saved.refetch()}>重新載入收藏</Button>}
    </div>
    <div className={`study-layout ${tools ? 'with-tools' : ''}`}>
      <section className={`study-scripture ${tools ? 'mobile-hidden' : ''} ${paragraph && !compare ? 'paragraph' : ''}`} aria-label="經文" style={{ fontSize }}>
        <LoadState loading={available && primary.isPending} error={primary.error} retry={primary.refetch} />
        {!available && <div role="status"><p>免費易讀聖經目前僅收錄新約。</p><div className="study-actions"><Button variant="outline" onClick={() => navigate(40, 1)}>讀馬太福音</Button><Button variant="outline" onClick={() => setTranslation(info.default_translation)}>使用和合本</Button></div></div>}
        {compare && <LoadState loading={parallel.isPending} error={parallel.error} retry={parallel.refetch} />}
        {primary.data && primary.data.length === 0 && <p>目前沒有本章的經文。</p>}
        {primary.data?.map(v => <div className={`study-verse ${compare ? 'compare' : ''}`} key={v.id}>
          <button ref={el => { if (el) verseRefs.current.set(v.verse, el); else verseRefs.current.delete(v.verse); }} aria-pressed={selection.has(v.verse)} data-current={chosen?.id === v.id} className="study-verse-text" onClick={() => { setVerse(v.verse); setSelection(previous => { const next = new Set(previous); if (next.has(v.verse)) next.delete(v.verse); else next.add(v.verse); return next; }); }}>
            <sup>{label(v)}</sup><span>{v.body}</span>
          </button>
          {compare && <div className="study-parallel" lang={other === 'engwebp' ? 'en' : other === 'cmnfeb' ? 'zh-Hans' : 'zh-Hant'}>{parallel.data?.filter(p => p.verse <= v.end_verse && p.end_verse >= v.verse).map(p => <p key={p.id}><sup>{label(p)}</sup>{p.body}</p>)}{parallel.data && !parallel.data.some(p => p.verse <= v.end_verse && p.end_verse >= v.verse) && <p className="text-muted-foreground">此譯本未收錄本節</p>}</div>}
          {chosen?.id === v.id && selection.has(v.verse) && <div className="study-actions study-verse-actions">
            <Button variant="outline" onClick={() => { setTools(true); requestAnimationFrame(() => document.getElementById('study-references')?.scrollIntoView({ block: 'start' })); }}>查考此節</Button>
            {user && <Button variant="outline" onClick={openNote}><PenLine size={18} className="mr-2" />寫下筆記</Button>}
            <Button variant="ghost" size="icon" title="複製所選經文" aria-label="複製所選經文" onClick={copy}><Copy /></Button>
          </div>}
        </div>)}
        {primary.data?.[0] && <Credit value={primary.data[0]} />}
        {compare && parallel.data?.[0] && <Credit value={parallel.data[0]} />}
      </section>
      {tools && <aside id="study-references" className="study-references">
        <Button className="study-return" variant="ghost" onClick={() => { setTools(false); requestAnimationFrame(() => verseRefs.current.get(chosen?.verse || 1)?.scrollIntoView({ block: 'center' })); }}><ArrowLeft size={18} className="mr-2" />返回經文</Button>
        <h2>{info.books[book - 1].name} {chapter}:{chosen ? label(chosen) : verse}</h2>
        {chosen && <p className="study-selected-quote">{chosen.body}</p>}
        <label>經節<select aria-label="查考經節" value={verse} onChange={e => setVerse(Number(e.target.value))}>{Array.from({ length: primary.data?.at(-1)?.end_verse || verse }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
        <StudyTools info={info} book={book} chapter={chapter} verse={verse} translation={translation} open={setPopup} />
      </aside>}
    </div>
    <div className="study-bottom"><Button variant="outline" disabled={book === 1 && chapter === 1} onClick={() => next(-1)}><ChevronLeft size={18} />上一章</Button><Button variant="outline" disabled={book === 66 && chapter === info.books[65].chapters} onClick={() => next(1)}>下一章<ChevronRight size={18} /></Button></div>
    {note && <div id="study-note"><DevotionalNoteDialog inline open onOpenChange={open => { if (!open) setNote(null); }} verseReference={note.reference} verseText={note.text} /></div>}
    <footer className="study-footer"><Link to="/learn/my-notes">我的筆記</Link><a href="/open/licenses" target="_blank" rel="noreferrer">來源與授權</a><span>{info.release_id}</span></footer>
    <Preview popup={popup} close={() => setPopup(null)} />
    <ScriptureCardCreator open={!!card} onOpenChange={open => { if (!open) setCard(null); }} verse={card || { reference: '', text: '' }} />
  </>;
}
