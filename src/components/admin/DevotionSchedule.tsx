import { useId, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronsDownUp, ChevronsUpDown, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DevotionEntry } from '@shared/churchDevotion';

type Props = {
  entries: DevotionEntry[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  onEdit: (entry: DevotionEntry) => void;
  today: string;
  searching: boolean;
  busy: boolean;
};

function Selection({ label, ids, selected, onSelect, busy }: {
  label: string; ids: string[]; selected: string[]; onSelect: Props['onSelect']; busy: boolean;
}) {
  const count = ids.filter(id => selected.includes(id)).length;
  return <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
    <input type="checkbox" aria-label={label} disabled={busy}
      className="h-4 w-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      ref={node => { if (node) node.indeterminate = count > 0 && count < ids.length; }}
      checked={ids.length > 0 && count === ids.length}
      onChange={event => onSelect(event.target.checked
        ? [...new Set([...selected, ...ids])]
        : selected.filter(id => !ids.includes(id)))} />
  </label>;
}

export function DevotionSchedule({ entries, selected, onSelect, onEdit, today, searching, busy }: Props) {
  const prefix = useId();
  const topics = useMemo(() => {
    const grouped = new Map<string, DevotionEntry[]>();
    for (const entry of entries) {
      const lessons = grouped.get(entry.planName);
      if (lessons) lessons.push(entry); else grouped.set(entry.planName, [entry]);
    }
    return [...grouped].map(([name, lessons]) => ({ name, lessons: lessons.sort((a, b) => a.date.localeCompare(b.date)) }))
      .sort((a, b) => a.lessons[0].date.localeCompare(b.lessons[0].date) || a.name.localeCompare(b.name, 'zh-TW'));
  }, [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [overrides, setOverrides] = useState<Set<string>>(() => new Set());
  const isOpen = (name: string) => (searching && !overrides.has(name)) || expanded.has(name);
  const allOpen = topics.length > 0 && topics.every(topic => isOpen(topic.name));
  function toggle(name: string) {
    const open = isOpen(name);
    setOverrides(current => new Set([...current, name]));
    setExpanded(current => { const next = new Set(current); if (open) next.delete(name); else next.add(name); return next; });
  }
  if (!entries.length) return <p className="border-y px-4 py-10 text-center text-sm text-muted-foreground">沒有符合條件的課程。</p>;

  return <section aria-label="主題課表" className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <div className="flex min-w-0 items-center gap-1">
        <Selection label="選取目前所有課程" ids={entries.map(entry => entry.id)} {...{ selected, onSelect, busy }} />
        <span className="text-sm">全選篩選結果（含收合課程）</span>
      </div>
      <Button variant="ghost" size="sm" className="min-h-11" onClick={() => {
        setOverrides(new Set(topics.map(topic => topic.name)));
        setExpanded(new Set(allOpen ? [] : topics.map(topic => topic.name)));
      }}>
        {allOpen ? <ChevronsDownUp className="mr-2 h-4 w-4" /> : <ChevronsUpDown className="mr-2 h-4 w-4" />}
        {allOpen ? '全部收合' : '全部展開'}
      </Button>
    </div>
    <p className="py-3 text-sm text-muted-foreground">{topics.length} 個主題 · {entries.length} 筆課程</p>
    <div className="border-t">
      {topics.map((topic, index) => {
        const open = isOpen(topic.name);
        const panelId = `${prefix}-topic-${index}`;
        const draftCount = topic.lessons.filter(entry => entry.status === 'draft').length;
        const selectedCount = topic.lessons.filter(entry => selected.includes(entry.id)).length;
        const includesToday = topic.lessons.some(entry => entry.date === today);
        return <div key={topic.name} className="border-b">
          <div className="flex items-start gap-1 py-3 sm:gap-2">
            <div className="pt-1"><Selection label={`選取主題 ${topic.name}`} ids={topic.lessons.map(entry => entry.id)} {...{ selected, onSelect, busy }} /></div>
            <h2 className="min-w-0 flex-1">
              <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? '收合' : '展開'}主題 ${topic.name}`}
                className="flex min-h-11 w-full min-w-0 items-start gap-3 rounded-md px-1 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2"
                onClick={() => toggle(topic.name)}>
                <BookOpen className="mt-1 hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block break-words text-base font-semibold leading-relaxed">{topic.name}</span>
                  <span className="block text-xs font-normal leading-relaxed text-muted-foreground sm:text-sm">{topic.lessons[0].date} 至 {topic.lessons.at(-1)!.date} · {topic.lessons.length} 天</span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-normal sm:text-sm">
                    <span className="text-muted-foreground">已發佈 {topic.lessons.length - draftCount}</span>
                    <span className={draftCount ? 'font-medium text-primary' : 'text-muted-foreground'}>草稿 {draftCount}</span>
                    {includesToday && <span className="font-medium text-primary">今日課程</span>}
                    {selectedCount > 0 && <span className="font-medium text-primary">已選 {selectedCount}</span>}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground ${open ? 'rotate-180' : ''}`} />
              </button>
            </h2>
          </div>
          <div id={panelId} hidden={!open}>
            {open && <table aria-label={`${topic.name} 每日課程`} className="w-full table-fixed text-left text-sm">
              <thead className="hidden border-y bg-muted/30 text-muted-foreground md:table-header-group">
                <tr><th className="w-11"><span className="sr-only">選取</span></th><th className="w-40 py-3 font-medium">日期／進度</th><th className="py-3 font-medium">經文與短文</th><th className="w-24 py-3 font-medium">狀態</th><th className="w-12"><span className="sr-only">編輯</span></th></tr>
              </thead>
              <tbody className="block divide-y md:table-row-group">
                {topic.lessons.map(entry => <tr key={entry.id} className={`grid grid-cols-[44px_minmax(0,1fr)_48px] items-start py-2 hover:bg-muted/20 md:table-row ${entry.date === today ? 'bg-primary/5' : ''}`}>
                  <td className="col-start-1 row-start-1 md:align-top md:py-2"><Selection label={`選取 ${entry.date}`} ids={[entry.id]} {...{ selected, onSelect, busy }} /></td>
                  <td className="col-start-2 row-start-1 min-w-0 py-2 md:align-top md:py-3 md:pr-3"><span className="block font-medium">{entry.date}{entry.date === today && <span className="ml-2 text-xs text-primary">今天</span>}</span><span className="text-xs text-muted-foreground">第 {entry.dayNumber} 天</span></td>
                  <td className="col-start-2 row-start-2 min-w-0 pb-2 md:align-top md:py-3 md:pr-4"><p className="break-words font-medium leading-relaxed">{entry.devotionalTitle}</p><p className="mt-1 break-words text-muted-foreground">{entry.scriptureReference}</p></td>
                  <td className="col-start-2 row-start-3 pb-2 text-xs text-muted-foreground md:align-top md:py-3 md:text-sm">{entry.status === 'published' ? '已發佈' : '草稿'}</td>
                  <td className="col-start-3 row-start-1 md:align-top md:py-2"><Button variant="ghost" size="icon" className="h-11 w-11" disabled={busy} title={`編輯 ${entry.date}`} aria-label={`編輯 ${entry.date}`} onClick={() => onEdit(entry)}><Pencil className="h-4 w-4" /></Button></td>
                </tr>)}
              </tbody>
            </table>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}
