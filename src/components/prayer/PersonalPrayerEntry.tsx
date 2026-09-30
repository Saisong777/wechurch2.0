import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, ChevronDown, Save, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { isGraceRecord, responseStatus, type PersonalPrayer } from '@shared/personalPrayer';
import { taipeiToday } from '@shared/churchDevotion';
import type { usePersonalPrayers } from '@/hooks/usePersonalPrayers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { ApiError } from '@/lib/queryClient';

const options = [
  { value: 'keep_waiting', label: '繼續等候' },
  { value: 'grace', label: '蒙應允' },
  { value: 'ended', label: '已結束' },
  { value: 'blocked', label: '神的攔阻' },
  { value: 'other', label: '其他帶領' },
] as const;
type ResponseType = typeof options[number]['value'];

export function PersonalPrayerEntry({ record, save, selected, onSelect, hasPublicShare, children, onEditorState }: {
  record: PersonalPrayer; save: ReturnType<typeof usePersonalPrayers>['save']; selected: boolean;
  onSelect: (selected: boolean) => void; hasPublicShare: boolean; children: ReactNode;
  onEditorState: (id: string, open: boolean, dirty: boolean) => void;
}) {
  const graceStory = record.recordKind === 'grace';
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<PersonalPrayer | null>(null);
  const [mode, setMode] = useState<'edit' | 'response' | null>(null);
  const [response, setResponse] = useState('');
  const [type, setType] = useState<ResponseType>('keep_waiting');
  const [closePublic, setClosePublic] = useState(false);
  const [error, setError] = useState('');
  const [base, setBase] = useState<PersonalPrayer | null>(null);
  const dirty = !!draft && !!base && (draft.title !== base.title || draft.prayer !== base.prayer || draft.occurredOn !== base.occurredOn || !!response.trim() || type !== 'keep_waiting' || closePublic);
  useEffect(() => {
    onEditorState(record.id, !!mode, dirty);
    return () => onEditorState(record.id, false, false);
  }, [record.id, mode, dirty, onEditorState]);
  const close = () => { setMode(null); setDraft(null); setBase(null); setResponse(''); setClosePublic(false); setError(''); };
  const open = (next: 'edit' | 'response') => {
    setBase(record); setDraft({ ...record }); setMode(next); setResponse(''); setType('keep_waiting'); setClosePublic(false); setError('');
  };
  const submit = async () => {
    if (!draft || !base || save.isPending) return;
    const isResponse = mode === 'response';
    const entry = response.trim();
    if (isResponse && !entry && type === 'keep_waiting') { setError('請寫下這次的近況。'); return; }
    const nextResponse = isResponse ? [base.response, `${new Date().toLocaleDateString('zh-TW')} · ${options.find(o => o.value === type)?.label}${entry ? `\n${entry}` : ''}`].filter(Boolean).join('\n\n') : base.response;
    if (nextResponse.length > 10000) { setError('回應紀錄已達上限，這次文字尚未儲存。請縮短內容後再試。'); return; }
    try {
      await save.mutateAsync({ id: record.id, input: { ...draft, expectedUpdatedAt: base.updatedAt,
        response: nextResponse, status: isResponse ? responseStatus(type) : base.status,
        responseType: isResponse ? type : base.responseType,
        occurredOn: isResponse && type === 'grace' ? base.occurredOn || taipeiToday() : draft.occurredOn,
        closePublicShare: isResponse && type !== 'keep_waiting' && closePublic,
      } });
      close(); setExpanded(true);
      toast.success(isResponse ? type === 'keep_waiting' ? '近況已保留，繼續為這件事禱告' : type === 'grace' ? '已存入恩典記錄簿' : '已保留在禱告歷史' : '已更新私人紀錄，分享副本不變');
    } catch (e) {
      const message = e instanceof ApiError && [409, 428].includes(e.status) ? '這筆禱告已在另一頁更新。請保留你的文字，重新載入核對後再編輯。' : '尚未儲存，文字仍保留。請確認連線後重試。';
      setError(message);
    }
  };
  const reopen = async () => {
    try {
      await save.mutateAsync({ id: record.id, input: { ...record, status: 'waiting', expectedUpdatedAt: record.updatedAt } });
      toast.success('已放回禱告清單，原有回應已保留；不會自動重新公開');
    } catch { toast.error('尚未更新，請重新載入確認最新狀態。'); }
  };
  const status = graceStory ? '恩典事蹟' : record.status === 'waiting' ? '等候中' : record.status === 'answered' ? '蒙應允' : options.find(o => o.value === record.responseType)?.label || '恩典回應';
  return <article className="min-w-0 rounded-lg border bg-card" aria-label={`${graceStory ? '恩典事蹟' : '個人禱告'}：${record.title}`}>
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 font-semibold [overflow-wrap:anywhere]"><input type="checkbox" className="h-4 w-4 shrink-0" aria-label={`選取 ${record.title}`} checked={selected} onChange={e => onSelect(e.target.checked)} />{record.title}</label>
        <Badge variant="outline" className="mt-2 shrink-0">{status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{record.occurredOn ? `${record.occurredOn} · 發生日期` : `${new Date(record.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })} · 建立日期`}</p>
      <p className={`${expanded ? '' : 'line-clamp-3'} whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]`}>{record.prayer || '沒有補充內容'}</p>
      {record.response && expanded && <section className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">禱告與恩典歷程</h3><p className="whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{record.response}</p></section>}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><ChevronDown className={`h-4 w-4 ${expanded ? 'rotate-180' : ''}`} />{expanded ? '收起' : '閱讀全文與歷程'}</Button>
        {!mode && <><Button variant="outline" onClick={() => open('edit')}><Pencil className="h-4 w-4" />編輯</Button>{!graceStory && <><Button variant="outline" onClick={() => open('response')}><NotebookPen className="h-4 w-4" />記錄</Button>{record.status !== 'waiting' && <Button variant="ghost" disabled={save.isPending} onClick={reopen}>放回清單</Button>}</>}</>}
      </div>
      {mode && draft && <form className="space-y-4 border-t pt-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
          {mode === 'edit' ? <>
            <div className="space-y-2"><Label htmlFor={`title-${record.id}`}>{graceStory ? '恩典標題' : '禱告標題'}</Label><Input id={`title-${record.id}`} required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
            {isGraceRecord(record) && <div className="space-y-2"><Label htmlFor={`date-${record.id}`}>發生日期</Label><Input id={`date-${record.id}`} type="date" required={graceStory} value={draft.occurredOn || ''} onChange={e => setDraft({ ...draft, occurredOn: e.target.value || null })} /></div>}
            <div className="space-y-2"><Label htmlFor={`prayer-${record.id}`}>{graceStory ? '恩典事蹟與感謝' : '私人禱告內容'}</Label><AutoResizeTextarea id={`prayer-${record.id}`} required={graceStory} minRows={3} maxRows={16} maxLength={10000} value={draft.prayer} onChange={e => setDraft({ ...draft, prayer: e.target.value })} /></div>
            <p className="text-sm text-muted-foreground">僅修改私人原稿，不會覆蓋已分享的內容。</p>
          </> : <>
            <label className="block space-y-2 text-sm"><span>這次的進展</span><select className="h-11 w-full rounded-md border bg-background px-3" value={type} onChange={e => { setType(e.target.value as ResponseType); setClosePublic(false); }}>
              {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <div className="space-y-2"><Label htmlFor={`response-${record.id}`}>近況與恩典回應（僅自己可見）</Label><AutoResizeTextarea id={`response-${record.id}`} minRows={3} maxRows={12} maxLength={10000} value={response} onChange={e => setResponse(e.target.value)} /></div>
            {hasPublicShare && type !== 'keep_waiting' && <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1.5" checked={closePublic} onChange={e => setClosePublic(e.target.checked)} />同時結束禱告牆上的代禱（保留本人紀錄，不公開這段回應）</label>}
            {type !== 'keep_waiting' && <p className="text-sm text-muted-foreground">小家分享仍會保留，可在分享紀錄中另行撤回。</p>}
          </>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!draft.title.trim()}><Save className="h-4 w-4" />{save.isPending ? '儲存中…' : mode === 'edit' ? '儲存修改' : '儲存進展'}</Button><Button type="button" variant="outline" onClick={() => { if (!dirty || window.confirm('捨棄尚未儲存的修改？')) close(); }}>取消</Button></div>
        </fieldset>
      </form>}
    </div>
    {children}
  </article>;
}
