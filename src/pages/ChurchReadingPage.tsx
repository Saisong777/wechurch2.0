import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useChurchScopeKey } from '@/contexts/ChurchContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevotionalReader } from '@/components/scripture/DevotionalReader';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { fetchChurchReadingForToday, type ChurchReadingSummary } from '@/lib/churchReading';
import { devotionDate, shiftDevotionDate, taipeiToday } from '@shared/churchDevotion';

// Refresh calendar bounds after midnight and when returning from background.
// Keep the displayed day stable until the reader chooses another day: an open
// unsaved note must not disappear just because the calendar clock changes.
function useTaipeiToday() {
  const [today, setToday] = useState(taipeiToday);
  useEffect(() => {
    const sync = () => setToday(taipeiToday());
    const timer = window.setInterval(sync, 30000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return today;
}

// The date is part of the route, so the existing unsaved-note guard also protects
// date changes, browser Back/Forward and links to a different devotional day.
export default function ChurchReadingPage() {
  const [search, setSearch] = useSearchParams();
  const scope = useChurchScopeKey();
  const [initialDay] = useState(taipeiToday);
  const today = useTaipeiToday();
  const requested = search.get('date') ?? initialDay;
  const valid = devotionDate.safeParse(requested).success && requested <= today;
  function selectDate(date: string) {
    if (!devotionDate.safeParse(date).success || date > today || date === requested) return;
    const next = new URLSearchParams(search);
    next.set('date', date);
    setSearch(next);
  }
  return <div className="min-h-screen bg-brand-warm">
    <Header variant="compact" title="每日靈修" backTo="/" />
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="靈修日期導覽" className="mb-4 border-b border-border pb-2">
        <label htmlFor="devotion-date" className="sr-only">選擇靈修日期</label>
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem_auto] items-center gap-0.5 sm:gap-1">
          <Button variant="outline" size="icon" disabled={!valid || requested <= '1900-01-01'} onClick={() => selectDate(shiftDevotionDate(requested, -1))} aria-label="前一天"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button>
          <Input id="devotion-date" aria-label="靈修日期" className="h-11 min-h-11 min-w-0 w-full px-1 text-base" type="date" min="1900-01-01" max={today} value={valid ? requested : ''} onChange={event => selectDate(event.target.value)} />
          <Button variant="outline" size="icon" disabled={!valid || requested >= today} onClick={() => selectDate(shiftDevotionDate(requested, 1))} aria-label="後一天"><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button>
          <Button variant="ghost" className="h-11 min-w-11 whitespace-nowrap px-2" aria-label="回到今天" disabled={valid && requested === today} onClick={() => selectDate(today)}><span className="sm:hidden">今天</span><span className="hidden sm:inline">回到今天</span></Button>
        </div>
        {valid && requested < today && <p role="status" className="mt-1 text-xs font-medium leading-5 text-primary">正在補讀 {requested} 的靈修</p>}
      </nav>
      {valid ? <ReadingDay key={`${scope}:${requested}`} date={requested} scope={scope} /> : <div role="alert" className="space-y-3 py-8"><p>請選擇今天或之前的有效日期。</p></div>}
    </main>
  </div>;
}

function ReadingDay({ date, scope }: { date: string; scope: string }) {
  const { data: reading, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/church-reading/today', scope, date],
    queryFn: async () => {
      const result = await fetchChurchReadingForToday(date);
      if (result.date !== date) throw new Error('靈修日期不符，請重新載入');
      return result;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    retry: 1,
    staleTime: 30000,
  });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteReading, setNoteReading] = useState<ChurchReadingSummary | null>(null);
  const noteSectionRef = useRef<HTMLDivElement>(null);
  const noteTriggerRef = useRef<HTMLElement | null>(null);
  const openNote = () => {
    noteTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!noteOpen && reading) setNoteReading(reading);
    setNoteOpen(true);
    const heading = noteSectionRef.current?.querySelector('h2');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: 'start' });
  };
  const changeNoteOpen = (open: boolean) => {
    setNoteOpen(open);
    if (!open) { setNoteReading(null); noteTriggerRef.current?.focus(); }
  };
  const displayedDate = new Date(`${date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
  const noteContext = noteReading || reading;
  // Keep an open note mounted on background fetch failures; the unsaved form
  // stays recoverable while stale reading content is hidden and retried.
  return <>
    {isLoading || (!reading && !isError) ? <p role="status" className="py-8">正在載入教會靈修課表…</p> : isError ? (
      <div role="alert" className="space-y-3 py-8"><p>暫時無法取得 {date} 的教會靈修課表。</p><Button variant="outline" onClick={() => refetch()}>重新載入</Button></div>
    ) : reading?.sourceStatus === 'unpublished' ? (
      <div className="space-y-3 py-8"><h1 className="text-xl font-semibold">{reading.devotionalTitle}</h1><p className="text-sm text-muted-foreground">{displayedDate}</p><Button asChild variant="outline"><Link to="/learn/bible">閱讀聖經</Link></Button></div>
    ) : reading ? <>
      {reading.sourceStatus === 'fallback' && <p role="status" className="mb-4 text-sm text-muted-foreground">目前顯示備用內容，非已發佈的教會課表。</p>}
      <DevotionalReader key={`${reading.date}:${reading.scriptureReference}`} reading={reading} retry={() => refetch()} onNote={openNote} />
    </> : null}
    {noteContext && <div ref={noteSectionRef}>
      <DevotionalNoteDialog key={date} inline open={noteOpen} onOpenChange={changeNoteOpen}
        devotionalDate={date} verseReference={noteContext.scriptureReference}
        verseText={noteContext.scriptureText || noteContext.previewVerses.map(verse => `${verse.verse} ${verse.text}`).join('\n')} />
    </div>}
  </>;
}
