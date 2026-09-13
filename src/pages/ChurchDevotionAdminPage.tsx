import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowLeftRight, CalendarClock, Download, FileSpreadsheet, History, Loader2, Pencil, Plus, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { dailyFocusTitle, devotionFields, devotionInput, devotionSheetRows, MAX_DEVOTION_HEADER_ROWS, missingDevotionFields, needsDevotionImportYear, selectDevotionHeaderRow, suggestDevotionImportOptions, suggestDevotionMapping, taipeiToday, type DevotionEntry, type DevotionImportOptions, type DevotionInput, type ImportPreview, type ImportSheet } from '@shared/churchDevotion';
import { toast } from 'sonner';
import { devotionChanges, devotionGaps } from '@shared/devotionGovernance';

const base = '/api/admin/church-devotions';
const selectClass = 'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const historyLabels: Record<string, string> = { create: '新增', edit: '編輯', import: '匯入', publish: '發佈', draft: '撤回草稿', shift: '調整日期', swap: '交換日期', restore: '回復為草稿' };
async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(base + path, { credentials: 'include', method, ...(body instanceof FormData ? { body } : body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作未完成，請重試。');
  return data;
}
const initialDraft = (): DevotionInput => ({ date: taipeiToday(), planName: '教會每日靈修', dayNumber: 1, scriptureReference: '', scriptureText: '', devotionalTitle: '', devotionalText: '', prayer: '', loveAction: '', status: 'draft' });

export default function ChurchDevotionAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const client = useQueryClient();
  const today = taipeiToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(`${today.slice(0, 4)}-12-31`);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DevotionEntry | null>(null);
  const [draft, setDraft] = useState<DevotionInput>(initialDraft);
  const [editError, setEditError] = useState('');
  const [history, setHistory] = useState<Array<{ id: string; action: string; before: DevotionEntry | null; after: DevotionEntry; createdAt: string }> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sheets, setSheets] = useState<ImportSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [importOptions, setImportOptions] = useState<DevotionImportOptions>({});
  const [mode, setMode] = useState<'skip' | 'replace'>('skip');
  const [googleUrl, setGoogleUrl] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [days, setDays] = useState(1);
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => Promise<void> } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: entries = [], isPending, isError, refetch } = useQuery<DevotionEntry[]>({
    queryKey: [base, user?.id, from, to],
    queryFn: () => request(`?from=${from}&to=${to}`, undefined, 'GET'), enabled: !!user && isAdmin && !!from && !!to && from <= to,
  });
  const visible = entries.filter(entry => (filter === 'all' || entry.status === filter) && `${entry.planName} ${entry.scriptureReference} ${entry.devotionalTitle}`.includes(search));
  const gaps = devotionGaps(entries, from, to);
  const chosen = entries.filter(entry => selected.includes(entry.id));
  const sheet = sheets[sheetIndex];
  const missingFields = missingDevotionFields(mapping, importOptions);
  const headerRow = (sheet?.preamble?.length || 0) + 1;
  const needsYear = sheet && needsDevotionImportYear(sheet.rows, mapping);
  const invalidYear = needsYear && (importOptions.year == null || !Number.isInteger(importOptions.year) || importOptions.year < 1900 || importOptions.year > 2199);
  const firstImportRow = sheet?.rows.find(row => row.some(cell => cell.trim()));

  async function refresh() {
    setSelected([]);
    await client.invalidateQueries({ queryKey: [base] });
    await client.invalidateQueries({ queryKey: ['/api/church-reading/today'] });
  }
  async function act(work: () => Promise<void>, onError = setError) {
    setBusy(true); onError('');
    try { await work(); } catch (err) { onError(err instanceof Error ? err.message : '操作未完成'); }
    finally { setBusy(false); }
  }
  function openEditor(entry?: DevotionEntry) {
    setEditing(entry || null); setDraft(entry ? devotionInput.parse(entry) : initialDraft());
    setEditError(''); setHistory(null); setEditorOpen(true);
  }
  function closeEditor(open: boolean) {
    if (busy) return;
    if (!open && JSON.stringify(draft) !== JSON.stringify(editing ? devotionInput.parse(editing) : initialDraft()) && !window.confirm('尚有未儲存的修改，確定關閉？')) return;
    setEditorOpen(open);
  }
  function acceptSheets(data: { sheets: ImportSheet[] }) {
    setSheets(data.sheets); setSheetIndex(0); configureImportSheet(data.sheets[0]);
  }
  function configureImportSheet(next: ImportSheet) {
    const suggested = suggestDevotionMapping(next.headers);
    setMapping(suggested); setImportOptions(suggestDevotionImportOptions(next, suggested)); setPreview(null); setImportError('');
  }
  function batch(action: 'publish' | 'draft' | 'shift' | 'swap') {
    const title = action === 'publish' ? '發佈選取課程' : action === 'draft' ? '撤回為草稿' : action === 'swap' ? '交換兩天的課程' : '調整課程日期';
    setConfirm({ title, text: action === 'shift' ? `${chosen.length} 筆課程${days > 0 ? '順延' : '提前'} ${Math.abs(days)} 天，經文、短文與第幾天會一起保留。` : action === 'publish' ? `${chosen.length} 筆課程將按日期供會友閱讀。` : action === 'draft' ? `${chosen.length} 筆課程將不再顯示給會友；個人筆記不受影響。` : '兩筆課程互換日期，原有內容不變。', run: async () => {
      await request('/batch', { items: chosen.map(({ id, version }) => ({ id, version })), action, days });
      setConfirm(null); await refresh(); toast.success('課表已更新');
    } });
  }

  if (authLoading || roleLoading) return <p role="status" className="p-6">正在確認權限…</p>;
  if (!user) return <div className="p-6"><Button asChild><Link to="/login">登入管理後台</Link></Button></div>;
  if (!isAdmin) return <div className="space-y-4 p-6"><p role="alert">每日靈修課表限管理員與主任牧師管理。</p><Link to="/">返回首頁</Link></div>;

  return (
    <div className="min-h-screen bg-background pb-8 [overflow-wrap:anywhere]">
      <header className="border-b px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Button asChild size="icon" variant="ghost" title="返回後台"><Link to="/admin" aria-label="返回後台"><ArrowLeft className="h-5 w-5" /></Link></Button><h1 className="text-xl font-semibold">每日靈修課表</h1></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setImportOpen(true); setImportError(''); }}><Upload className="mr-2 h-4 w-4" />匯入課表</Button>
            <Button onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />新增一天</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-sm">開始日期<Input aria-label="開始日期" type="date" value={from} onChange={e => { setFrom(e.target.value); setSelected([]); }} /></label>
          <label className="space-y-1 text-sm">結束日期<Input aria-label="結束日期" type="date" value={to} onChange={e => { setTo(e.target.value); setSelected([]); }} /></label>
          <label className="space-y-1 text-sm">狀態<select className={selectClass} value={filter} onChange={e => { setFilter(e.target.value); setSelected([]); }}><option value="all">全部</option><option value="draft">草稿</option><option value="published">已發佈</option></select></label>
          <label className="space-y-1 text-sm lg:col-span-2">搜尋<Input value={search} onChange={e => { setSearch(e.target.value); setSelected([]); }} placeholder="課表、經文或標題" /></label>
        </div>
        {from > to && <p role="alert" className="text-sm text-destructive">結束日期須晚於開始日期。</p>}
        {!isPending && !isError && gaps.length > 0 && <details className="border-y py-3 text-sm">
          <summary className="cursor-pointer font-medium">課表待補：{gaps.filter(g => g.status === 'missing').length} 天未排定、{gaps.filter(g => g.status === 'draft').length} 天未發布（所選範圍前 366 天）</summary>
          <ul className="mt-2 max-h-48 overflow-y-auto divide-y">{gaps.map(g => <li key={g.date} className="flex min-h-11 items-center justify-between gap-3"><span>{g.date} · {g.status === 'missing' ? '未排定' : '草稿'}</span><Button size="sm" variant="ghost" onClick={() => { openEditor(entries.find(e => e.date === g.date)); if(g.status === 'missing') setDraft({...initialDraft(),date:g.date}); }}>{g.status === 'missing' ? '補上課程' : '檢查草稿'}</Button></li>)}</ul>
        </details>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{visible.length} 筆課程 · {chosen.length} 筆已選取</span><a href={`${base}/export.xlsx?from=${from}&to=${to}`} className="inline-flex min-h-10 items-center gap-2"><Download className="h-4 w-4" />匯出 Excel</a></div>
        {chosen.length > 0 && <fieldset disabled={busy} className="flex flex-wrap items-center gap-2 border-y bg-muted/30 py-3">
          <Button size="sm" onClick={() => batch('publish')}>發佈所選</Button><Button size="sm" variant="outline" onClick={() => batch('draft')}>撤回草稿</Button>
          <Input aria-label="調整天數，負數為提前" type="number" min={-366} max={366} value={days} onChange={e => setDays(Number(e.target.value))} className="w-24" />
          <Button size="sm" variant="outline" disabled={!days || Math.abs(days) > 366} onClick={() => batch('shift')}><CalendarClock className="mr-2 h-4 w-4" />調整日期</Button>
          <Button size="sm" variant="outline" disabled={chosen.length !== 2} onClick={() => batch('swap')}><ArrowLeftRight className="mr-2 h-4 w-4" />交換日期</Button>
        </fieldset>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {isPending ? <p role="status">正在載入課表…</p> : isError ? <div role="alert"><p>無法載入課表，請確認資料庫已更新。</p><Button variant="outline" onClick={() => refetch()}>重新載入</Button></div> : (
          <div className="relative overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-muted/40"><tr><th className="p-3"><input type="checkbox" aria-label="選取目前所有課程" checked={visible.length > 0 && visible.every(entry => selected.includes(entry.id))} onChange={e => setSelected(e.target.checked ? visible.map(entry => entry.id) : [])} /></th><th className="p-3">日期</th><th className="p-3">課表／進度</th><th className="p-3">經文與短文</th><th className="p-3">狀態</th><th className="p-3"><span className="sr-only">編輯</span></th></tr></thead>
              <tbody>{visible.map(entry => <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20"><td className="p-3"><input type="checkbox" aria-label={`選取 ${entry.date}`} checked={selected.includes(entry.id)} onChange={e => setSelected(current => e.target.checked ? [...current, entry.id] : current.filter(id => id !== entry.id))} /></td><td className="whitespace-nowrap p-3">{entry.date}</td><td className="max-w-52 p-3"><p>{entry.planName}</p><p className="text-muted-foreground">第 {entry.dayNumber} 天</p></td><td className="max-w-80 p-3"><p className="font-medium">{entry.devotionalTitle}</p><p className="text-muted-foreground">{entry.scriptureReference}</p></td><td className="whitespace-nowrap p-3 text-muted-foreground">{entry.status === 'published' ? '已發佈' : '草稿'}</td><td className="p-2"><Button variant="ghost" size="icon" title={`編輯 ${entry.date}`} aria-label={`編輯 ${entry.date}`} onClick={() => openEditor(entry)}><Pencil className="h-4 w-4" /></Button></td></tr>)}</tbody>
            </table>
            {!visible.length && <p className="p-8 text-center text-sm text-muted-foreground">這段日期尚無課程。</p>}
          </div>
        )}
      </main>

      <Dialog open={editorOpen} onOpenChange={closeEditor}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing ? '編輯每日靈修' : '新增每日靈修'}</DialogTitle><DialogDescription>{editing ? `版本 ${editing.version} · ${new Date(editing.updatedAt).toLocaleString('zh-TW')}` : '新課程預設為草稿。'}</DialogDescription></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); const parsed = devotionInput.safeParse(draft); if (!parsed.success) { setEditError(parsed.error.issues.map(issue => issue.message).join('；')); return; } void act(async () => { await request(editing ? `/${editing.id}` : '/', { ...parsed.data, ...(editing ? { version: editing.version } : {}) }, editing ? 'PUT' : 'POST'); setEditorOpen(false); await refresh(); toast.success('靈修已儲存'); }, setEditError); }}>
          <fieldset disabled={busy} className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm">日期<Input type="date" required value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label><label className="space-y-1 text-sm">第幾天<Input type="number" required min={1} max={10000} value={draft.dayNumber} onChange={e => setDraft({ ...draft, dayNumber: Number(e.target.value) })} /></label></div>
            {devotionFields.filter(field => !['date', 'dayNumber'].includes(field.key)).map(field => <div key={field.key} className="space-y-1"><Label htmlFor={`devotion-${field.key}`}>{field.label}{!field.required && '（選填）'}</Label>{['devotionalText', 'scriptureText', 'prayer', 'loveAction'].includes(field.key) ? <Textarea id={`devotion-${field.key}`} required={field.required} rows={field.key === 'devotionalText' ? 8 : 3} value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })} /> : <Input id={`devotion-${field.key}`} required={field.required} value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })} />}</div>)}
            <label className="block space-y-1 text-sm">狀態<select className={selectClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as DevotionInput['status'] })}><option value="draft">草稿，會友尚不可見</option><option value="published">發佈，按日期顯示</option></select></label>
            {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
            <div className="flex flex-wrap gap-2"><Button type="submit">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{draft.status === 'published' ? '儲存並發佈' : '儲存草稿'}</Button>{editing && <Button type="button" variant="outline" onClick={() => void act(async () => setHistory(await request(`/${editing.id}/history`, undefined, 'GET')), setEditError)}><History className="mr-2 h-4 w-4" />修改紀錄</Button>}</div>
          </fieldset>
        </form>
        {history && <div className="border-t pt-3">{history.map((item, index) => <details key={index} className="border-b py-2 text-sm"><summary className="cursor-pointer">{new Date(item.createdAt).toLocaleString('zh-TW')} · {historyLabels[item.action] || item.action}</summary><p className="mt-2">{item.before?.date || '新增'} → {item.after.date} · {item.after.status === 'published' ? '已發佈' : '草稿'}</p><p className="mt-2 font-medium">{item.after.devotionalTitle}</p><p className="whitespace-pre-wrap">{item.after.devotionalText}</p><Button type="button" variant="outline" size="sm" className="mt-3" disabled={busy || !editing || item.after.version === editing.version} onClick={() => {
  if (!editing || !window.confirm('將此版本的內容回復為草稿？保留目前日期，需要重新確認發布。未儲存的編輯將被取代。')) return;
  void act(async () => {
    const restored = await request<DevotionEntry>(`/${editing.id}/restore`, { historyId: item.id, version: editing.version });
    openEditor(restored); await refresh(); toast.success('已回復為草稿，尚未發布');
  }, setEditError);
}}>回復此版為草稿</Button></details>)}</div>}
      </DialogContent></Dialog>

      <Dialog open={importOpen} onOpenChange={open => { if (!busy) setImportOpen(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>匯入靈修課表</DialogTitle><DialogDescription>Excel、CSV 或 Google Sheets；確認後存為草稿。一次最多 1,000 筆、3 MB。</DialogDescription></DialogHeader>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><a className="inline-flex min-h-10 items-center gap-2 text-primary" href={`${base}/template.xlsx`}><Download className="h-4 w-4" />Excel 範本</a><a className="inline-flex min-h-10 items-center gap-2 text-primary" href={`${base}/template.csv`}><Download className="h-4 w-4" />CSV 範本</a></div>
          <div className="space-y-3 border-y py-3">
            <input ref={fileInput} type="file" accept=".xlsx,.csv" aria-label="選擇 Excel 或 CSV" className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-2" onChange={e => { const file = e.target.files?.[0]; setPreview(null); setSheets([]); if (file) void act(async () => { const form = new FormData(); form.append('file', file); acceptSheets(await request('/read', form)); }, setImportError); }} />
            <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Google Sheets 連結" placeholder="Google Sheets 連結" value={googleUrl} onChange={e => { setGoogleUrl(e.target.value); setPreview(null); setSheets([]); }} /><Button variant="outline" disabled={!googleUrl} onClick={() => void act(async () => { setPreview(null); setSheets([]); acceptSheets(await request('/google-sheet', { url: googleUrl })); }, setImportError)}><FileSpreadsheet className="mr-2 h-4 w-4" />讀取試算表</Button></div>
          </div>
          {sheet && <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0 space-y-1 text-sm">工作表<select className={selectClass} value={sheetIndex} onChange={e => { const index = Number(e.target.value); setSheetIndex(index); configureImportSheet(sheets[index]); }}>{sheets.map((item, index) => <option key={index} value={index}>{item.name}（{item.rows.length} 列）</option>)}</select></label>
              <label className="block min-w-0 space-y-1 text-sm">欄位名稱所在列<select className={selectClass} value={headerRow - 1} onChange={e => {
                const next = selectDevotionHeaderRow(sheet, Number(e.target.value));
                setSheets(current => current.map((item, index) => index === sheetIndex ? next : item));
                configureImportSheet(next);
              }}>{devotionSheetRows(sheet).slice(0, MAX_DEVOTION_HEADER_ROWS).map((row, index) => <option key={index} value={index}>第 {index + 1} 列 · {row.filter(value => value.trim()).join(' / ').slice(0, 90) || '空白列'}</option>)}</select></label>
            </div>
            {needsYear && <label className="block space-y-1 text-sm">年份（原表只有月／日）<Input aria-label="匯入年份" type="number" min={1900} max={2199} placeholder="請填寫年份" value={importOptions.year ?? ''} onChange={e => { setImportOptions(current => ({ ...current, year: e.target.value ? Number(e.target.value) : undefined })); setPreview(null); }} /></label>}
            {missingFields.length > 0 && <p role="alert" className="text-sm text-destructive">尚待選擇欄位：{missingFields.map(field => field.label).join('、')}。</p>}
            <div className="grid gap-3 sm:grid-cols-3">{devotionFields.map(field => <div key={field.key} className="min-w-0 space-y-1 text-sm">
              <label htmlFor={`import-${field.key}`}>{field.label}{field.required ? ' *' : ''}</label>
              <select id={`import-${field.key}`} aria-invalid={missingFields.some(missing => missing.key === field.key)} className={selectClass} value={mapping[field.key] ?? (field.key === 'planName' ? 'fixed' : field.key === 'devotionalTitle' && importOptions.titleFromDailyFocus ? 'dailyFocus' : '')} onChange={e => {
                const value = e.target.value;
                setMapping(current => { const next = { ...current }; if (['', 'fixed', 'dailyFocus'].includes(value)) delete next[field.key]; else next[field.key] = Number(value); return next; });
                if (field.key === 'devotionalTitle') setImportOptions(current => ({ ...current, titleFromDailyFocus: value === 'dailyFocus' }));
                setPreview(null);
              }}>
                <option value="">{field.required ? '請選欄位' : '不匯入'}</option>
                {field.key === 'planName' && <option value="fixed">整份課表共用名稱</option>}
                {field.key === 'devotionalTitle' && <option value="dailyFocus">取自短文的「每日重點」</option>}
                {sheet.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header.trim() || '未命名欄位'}</option>)}
              </select>
              {field.key === 'planName' && mapping.planName === undefined && <Input aria-label="整份課表名稱" maxLength={200} placeholder="課表名稱" value={importOptions.planName || ''} onChange={e => { setImportOptions(current => ({ ...current, planName: e.target.value })); setPreview(null); }} />}
              {field.key === 'devotionalTitle' && mapping.devotionalTitle === undefined && importOptions.titleFromDailyFocus && <p className="line-clamp-2 text-xs text-muted-foreground">{dailyFocusTitle(firstImportRow?.[mapping.devotionalText] || '') || '首筆短文沒有「每日重點」'}</p>}
              {mapping[field.key] !== undefined && <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{firstImportRow?.[mapping[field.key]]?.slice(0, 160) || '首筆資料為空白'}</p>}
            </div>)}</div>
            <label className="block space-y-1 text-sm">附在短文末尾的金句卡<select className={selectClass} value={importOptions.verseCardColumn ?? ''} onChange={e => { setImportOptions(current => ({ ...current, verseCardColumn: e.target.value === '' ? undefined : Number(e.target.value) })); setPreview(null); }}><option value="">不附加</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header.trim() || '未命名欄位'}</option>)}</select></label>
            <label className="block space-y-1 text-sm">資料庫已有相同日期<select className={selectClass} value={mode} onChange={e => { setMode(e.target.value as 'skip' | 'replace'); setPreview(null); }}><option value="skip">略過，保留原本內容</option><option value="replace">取代內容並撤回為草稿</option></select></label>
            {(!sheet.rows.length || sheet.rows.length > 1000) && <p role="alert" className="text-sm text-destructive">{!sheet.rows.length ? '欄名列之後沒有資料。' : '資料超過 1,000 列，請分批匯入。'}</p>}
            <Button variant="outline" disabled={missingFields.length > 0 || invalidYear || !sheet.rows.length || sheet.rows.length > 1000} onClick={() => void act(async () => { setPreview(await request('/preview', { rows: sheet.rows, mapping, mode, headerRow, options: importOptions })); }, setImportError)}>檢查並預覽</Button>
          </>}
          {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />處理中…</p>}
          {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}
          {preview && <div className="space-y-3 border-t pt-3">
            {preview.issues.length > 0 ? <div role="alert" className="max-h-60 overflow-auto text-sm text-destructive">{preview.issues.map((issue, index) => <p key={index}>第 {issue.row} 列：{issue.message}</p>)}</div> : <>
              <p className="text-sm">新增 {preview.rows.filter(row => row.action === 'create').length} 筆 · 取代 {preview.rows.filter(row => row.action === 'replace').length} 筆 · 略過 {preview.rows.filter(row => row.action === 'skip').length} 筆</p>
              <div className="max-h-64 overflow-auto border"><table className="w-full min-w-[520px] text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-2">列</th><th className="p-2">日期</th><th className="p-2">課表／內容</th><th className="p-2">結果</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.row} className="border-t"><td className="p-2">{row.row}</td><td className="whitespace-nowrap p-2">{row.entry.date}</td><td className="max-w-md p-2"><details><summary className="cursor-pointer">{row.entry.devotionalTitle} · {row.entry.scriptureReference}</summary><p>{row.entry.planName} · 第 {row.entry.dayNumber} 天</p><p className="whitespace-pre-wrap">{row.entry.devotionalText}</p>{row.before && <div className="mt-3 border-t pt-2"><p className="font-medium">與目前版本比較</p>{devotionChanges(row.before,row.entry).length === 0 ? <p>內容相同</p> : devotionChanges(row.before,row.entry).map(change => <div key={change.key} className="mt-2"><p className="font-medium">{change.label}</p><p className="whitespace-pre-wrap text-muted-foreground">原本：{change.before || '空白'}</p><p className="whitespace-pre-wrap">匯入：{change.after || '空白'}</p></div>)}</div>}</details></td><td className="p-2">{row.action === 'create' ? '新增草稿' : row.action === 'replace' ? '取代為草稿' : '略過'}</td></tr>)}</tbody></table></div>
              <Button disabled={!preview.id || preview.rows.every(row => row.action === 'skip')} onClick={() => void act(async () => {
                const result = await request<{ created: number; replaced: number; skipped: number }>(`/imports/${preview.id}/commit`, {});
                const dates = preview.rows.filter(row => row.action !== 'skip').map(row => row.entry.date).sort();
                if (dates.length) { setFrom(dates[0]); setTo(dates[dates.length - 1]); }
                setFilter('all'); setSearch(''); setImportOpen(false); setPreview(null); setSheets([]); if (fileInput.current) fileInput.current.value = '';
                await refresh(); toast.success(`已匯入 ${result.created + result.replaced} 筆草稿，略過 ${result.skipped} 筆`);
              }, setImportError)}>確認匯入草稿</Button>
            </>}
          </div>}
        </fieldset>
      </DialogContent></Dialog>

      <Dialog open={!!confirm} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}><DialogContent><DialogHeader><DialogTitle>{confirm?.title}</DialogTitle><DialogDescription>{confirm?.text}</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Button disabled={busy} onClick={() => confirm && void act(confirm.run)}>確認{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}</Button><Button disabled={busy} variant="outline" onClick={() => setConfirm(null)}>取消</Button></div></DialogContent></Dialog>
    </div>
  );
}
