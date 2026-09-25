import { useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Heart, NotebookPen, PenLine, RotateCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScriptureSection } from './ChurchScriptureSection';
import type { ChurchReadingSummary } from '@/lib/churchReading';
import { devotionalSections, type DevotionalSection } from '@/lib/devotionalSections';
import './devotional-reader.css';

const FONT_KEY = 'wechurch-devotion-font-size';
const DEFAULT_SIZE = 20;
function savedFontSize() {
  try {
    const value = Number(localStorage.getItem(FONT_KEY));
    return Number.isInteger(value) && value >= 16 && value <= 26 ? value : DEFAULT_SIZE;
  } catch { return DEFAULT_SIZE; }
}

function ProseSection({ title, body }: { title: string; body: string }) {
  return <section className="reader-section">
    <h2 className="reader-section-title">{title}</h2>
    <div className="reader-prose space-y-5">
      {body.split(/\r?\n[ \t]*\r?\n/).filter(part => part.trim()).map((part, index) => (
        <p className="whitespace-pre-wrap" key={index}>{part}</p>
      ))}
    </div>
  </section>;
}

export function DevotionalReader({ reading, retry, onNote }: {
  reading: ChurchReadingSummary; retry: () => void; onNote: () => void;
}) {
  const [fontSize, setFontSize] = useState(savedFontSize);
  const [panel, setPanel] = useState('scripture');
  const fontId = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => devotionalSections(reading.devotionalText), [reading.devotionalText]);
  const focus = reading.focus || reading.headline || reading.devotionalTitle;
  const devotion = sections.filter(section => section.panel === 'devotion' && !(
    ['每日重點', '今日重點'].includes(section.title) && section.body.trim() === focus?.trim()
  ));
  const prayer: DevotionalSection[] = sections.filter(section => section.panel === 'prayer');
  if (reading.prayer) prayer.push({ title: '今日愛神', body: reading.prayer, panel: 'prayer' });
  if (reading.keyVerse) prayer.push({ title: '今日金句', body: reading.keyVerse, panel: 'prayer' });
  const displayedDate = reading.date
    ? new Date(`${reading.date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })
    : '今天';

  function changeFont(value: number) {
    setFontSize(value);
    try { localStorage.setItem(FONT_KEY, String(value)); } catch { /* Reading works without storage. */ }
  }
  function nextPanel(value: string) {
    setPanel(value);
    tabsRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-reader-tab="${value}"]`)?.focus({ preventScroll: true });
  }

  return <article className="church-reader" style={{ '--reader-font-size': `${fontSize}px` } as CSSProperties}>
    <header className="space-y-4 pb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-4 w-4" />{displayedDate}</p>
        {reading.dayNumber > 0 && <span className="font-medium text-primary">第 {reading.dayNumber} 天</span>}
      </div>
      <h1 className="break-words text-2xl font-bold leading-snug sm:text-3xl">{reading.scriptureReference || reading.devotionalTitle}</h1>
      {focus && <p className="border-l-2 border-secondary pl-4 text-base leading-7 text-foreground">{focus}</p>}
      <details className="text-sm text-muted-foreground">
        <summary className="w-fit cursor-pointer py-2 marker:text-primary">讀經課表</summary>
        <p className="pb-2 pt-1 leading-6">{reading.planName}</p>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onNote}><PenLine aria-hidden="true" className="mr-2 h-4 w-4" />寫靈修筆記</Button>
        <Button asChild variant="ghost"><Link to="/learn/my-notes"><NotebookPen aria-hidden="true" className="mr-2 h-4 w-4" />回看筆記</Link></Button>
      </div>
    </header>

    <div className="reader-font-control">
      <label htmlFor={fontId} className="shrink-0 text-sm font-medium">字級</label>
      <input id={fontId} type="range" min="16" max="26" step="1" value={fontSize} aria-valuetext={`${fontSize} 像素`} onChange={event => changeFont(Number(event.target.value))} />
      <output htmlFor={fontId} className="w-6 shrink-0 text-center text-sm tabular-nums">{fontSize}</output>
      <Button variant="ghost" size="icon" aria-label="重設閱讀字級" title="重設閱讀字級" onClick={() => changeFont(DEFAULT_SIZE)}><RotateCcw aria-hidden="true" className="h-4 w-4" /></Button>
    </div>

    <Tabs value={panel} onValueChange={setPanel} className="pt-3">
      <div ref={tabsRef} className="reader-tabs-anchor">
        <TabsList aria-label="每日靈修內容" className={`reader-tabs grid w-full ${prayer.length ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="scripture" data-reader-tab="scripture"><BookOpen aria-hidden="true" className="mr-1.5 h-4 w-4" />經文</TabsTrigger>
          <TabsTrigger value="devotion" data-reader-tab="devotion"><NotebookPen aria-hidden="true" className="mr-1.5 h-4 w-4" />靈修</TabsTrigger>
          {prayer.length > 0 && <TabsTrigger value="prayer" data-reader-tab="prayer"><Heart aria-hidden="true" className="mr-1.5 h-4 w-4" />禱告</TabsTrigger>}
        </TabsList>
      </div>
      <TabsContent value="scripture" forceMount hidden={panel !== 'scripture'}>
        <ScriptureSection reading={reading} retry={retry} defaultExpanded />
        <div className="reader-next"><Button variant="outline" onClick={() => nextPanel('devotion')}>閱讀靈修短文<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Button></div>
      </TabsContent>
      <TabsContent value="devotion" forceMount hidden={panel !== 'devotion'}>
        {reading.devotionalTitle !== focus && <h2 className="pt-6 text-xl font-semibold leading-8">{reading.devotionalTitle}</h2>}
        {devotion.map((section, index) => <ProseSection key={index} {...section} />)}
        {reading.loveAction && <ProseSection title="今日愛人" body={reading.loveAction} />}
        {Boolean(reading.workCommands?.length) && <ProseSection title="今日工作指令" body={reading.workCommands!.join('\n\n')} />}
        {Boolean(reading.startupSteps?.length) && <ProseSection title="7:00 啟動流程" body={reading.startupSteps!.map(step => `${step.label}\n${step.text}`).join('\n\n')} />}
        {!devotion.length && !reading.loveAction && !reading.workCommands?.length && !reading.startupSteps?.length && <p className="py-8 text-muted-foreground">今天沒有另外的靈修短文。</p>}
        <div className="reader-next"><Button variant="outline" onClick={() => prayer.length ? nextPanel('prayer') : onNote()}>{prayer.length ? '進入今日禱告' : '寫下今天的領受'}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Button></div>
      </TabsContent>
      {prayer.length > 0 && <TabsContent value="prayer" forceMount hidden={panel !== 'prayer'}>
        {prayer.map((section, index) => <ProseSection key={index} {...section} />)}
        <div className="reader-next"><Button onClick={onNote}><PenLine aria-hidden="true" className="mr-2 h-4 w-4" />寫下今天的領受</Button></div>
      </TabsContent>}
    </Tabs>
    <footer className="mt-4 border-t border-border pt-4">
      <Button asChild variant="ghost"><Link to="/groups"><Users aria-hidden="true" className="mr-2 h-4 w-4" />與小組一起讀經</Link></Button>
    </footer>
  </article>;
}
