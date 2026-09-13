import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Briefcase, CalendarDays, CheckCircle2, Clock, HandHeart, Heart, PenLine, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { ScriptureSection } from '@/components/scripture/ChurchScriptureSection';
import { Skeleton } from '@/components/ui/skeleton';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { fetchChurchReadingForToday, getChurchReadingForToday } from '@/lib/churchReading';



const ChurchReadingPage = () => {
  const fallbackReading = useMemo(() => getChurchReadingForToday(), []);
  const { data: syncedReading, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/church-reading/today'],
    queryFn: () => fetchChurchReadingForToday(),
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    retry: 1,
    staleTime: 30000,
  });
  const reading = syncedReading || fallbackReading;
  const [noteOpen, setNoteOpen] = useState(false);
  const verseText = reading.scriptureText || reading.previewVerses.map((verse) => `${verse.verse} ${verse.text}`).join('\n');
  const displayedDate = reading.date
    ? new Date(`${reading.date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })
    : '今天';

  return (
      <div className="min-h-screen bg-brand-warm">
      <Header variant="compact" title="每日靈修" backTo="/" />

      <main className="mx-auto max-w-2xl px-3 py-3 sm:px-4 sm:py-5">
        <Link to="/groups" className="mb-3 inline-flex min-h-11 items-center text-sm font-medium text-primary">與小組一起讀經</Link>
        <section className="space-y-3">
          {isLoading ? <p role="status" className="py-8">正在載入教會靈修課表…</p> : isError ? (
            <div role="alert" className="space-y-3 py-8"><p>暫時無法取得教會靈修課表。</p><Button variant="outline" onClick={() => refetch()}>重新載入</Button></div>
          ) : reading.sourceStatus === 'unpublished' ? (
            <div className="space-y-3 py-8"><h1 className="text-xl font-semibold">{reading.devotionalTitle}</h1><p className="text-sm text-muted-foreground">{displayedDate}</p><Button asChild variant="outline"><Link to="/learn/bible">閱讀聖經</Link></Button></div>
          ) : <>
          {reading.sourceStatus === 'fallback' && <p role="status" className="text-sm text-muted-foreground">目前顯示備用內容，非已發佈的教會課表。</p>}
          <article className="min-w-0">
            <div>
              <div className="pb-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {displayedDate}
                    </p>
                    <h1 className="mt-2 text-2xl font-bold leading-snug text-foreground">
                      {reading.headline || reading.devotionalTitle || reading.scriptureReference}
                    </h1>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      {reading.scriptureReference} · {reading.planName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {isLoading && !syncedReading && (
                  <div className="space-y-2 rounded-lg border bg-white/70 p-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                )}

                {(reading.keyVerse || reading.focus) && (
                  <div className="border-l-2 border-secondary/50 pl-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold text-foreground">今日重點</p>
                    </div>
                    {reading.focus && <h2 className="text-base font-bold text-foreground">{reading.focus}</h2>}
                    {reading.keyVerse && (
                      <p className="mt-2 text-base leading-7 text-foreground">{reading.keyVerse}</p>
                    )}
                  </div>
                )}

                <ScriptureSection key={`${reading.date}:${reading.scriptureReference}`} reading={reading} retry={() => refetch()} />

                <div className="py-2">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sky-600" />
                    <p className="text-sm font-semibold text-foreground">靈修短文</p>
                  </div>
                  {reading.devotionalTitle !== (reading.headline || reading.devotionalTitle) && <h2 className="text-xl font-semibold text-foreground">{reading.devotionalTitle}</h2>}
                  <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-foreground">
                    {reading.devotionalText}
                  </p>
                </div>

                <div className="space-y-5 border-t pt-5">
                  {reading.prayer && (
                    <div className="border-l-2 border-primary/40 pl-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Heart className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">今日愛神</p>
                      </div>
                      <p className="text-base leading-8 text-foreground">{reading.prayer}</p>
                    </div>
                  )}

                  {reading.loveAction && (
                    <div className="border-l-2 border-secondary/40 pl-4">
                      <div className="mb-2 flex items-center gap-2">
                        <HandHeart className="h-4 w-4 text-emerald-700" />
                        <p className="text-sm font-semibold text-foreground">今日愛人</p>
                      </div>
                      <p className="text-base leading-8 text-foreground">{reading.loveAction}</p>
                    </div>
                  )}
                </div>

                {Boolean(reading.workCommands?.length) && (
                  <div className="border-t pt-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-700" />
                      <p className="text-sm font-semibold text-foreground">今日工作指令</p>
                    </div>
                    <div className="space-y-2">
                      {reading.workCommands?.map((command, index) => (
                        <div key={`${command}-${index}`} className="flex gap-2 py-2">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                          <p className="text-sm leading-6 text-muted-foreground">{command}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Boolean(reading.startupSteps?.length) && (
                  <div className="border-t pt-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-violet-700" />
                      <p className="text-sm font-semibold text-foreground">7:00 啟動流程</p>
                    </div>
                    <div className="grid gap-2">
                      {reading.startupSteps?.map((step) => (
                        <div key={step.label} className="py-2">
                          <p className="text-xs font-semibold text-violet-700">{step.label}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 border-t pt-5 sm:grid-cols-2">
                  <Button className="h-11 rounded-lg" onClick={() => setNoteOpen(true)}>
                    <PenLine className="mr-2 h-4 w-4" />
                    寫靈修筆記
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-lg">
                    <Link to="/learn/my-notes">回看筆記</Link>
                  </Button>
                </div>
              </div>
            </div>
          </article>
          </>}
        </section>
      </main>

      <DevotionalNoteDialog
        open={noteOpen && !isError && reading.sourceStatus !== 'unpublished'}
        onOpenChange={setNoteOpen}
        verseReference={reading.scriptureReference}
        verseText={verseText}
      />
      </div>
  );
};

export default ChurchReadingPage;
