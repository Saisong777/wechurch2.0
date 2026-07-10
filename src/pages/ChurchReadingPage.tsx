import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Briefcase, CalendarDays, CheckCircle2, Clock, HandHeart, Heart, PenLine, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { FeatureGate } from '@/components/ui/feature-gate';
import { fetchChurchReadingForToday, getChurchReadingForToday } from '@/lib/churchReading';

const ChurchReadingPage = () => {
  const fallbackReading = useMemo(() => getChurchReadingForToday(), []);
  const { data: syncedReading, isLoading } = useQuery({
    queryKey: ['/api/church-reading/today'],
    queryFn: () => fetchChurchReadingForToday(),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });
  const reading = syncedReading || fallbackReading;
  const [noteOpen, setNoteOpen] = useState(false);
  const verseText = reading.previewVerses.map((verse) => `${verse.verse} ${verse.text}`).join('\n');
  const displayedDate = reading.date
    ? new Date(`${reading.date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })
    : '今天';

  return (
    <FeatureGate featureKey="daily_devotion_beta" title="每日靈修 beta 測試中" description="每日靈修目前只開放給 beta 同工">
      <div className="min-h-screen bg-brand-warm">
      <Header variant="compact" title="每日靈修" backTo="/" />

      <main className="mx-auto max-w-2xl px-3 py-3 sm:px-4 sm:py-5">
        <section className="space-y-3">
          <Card className="overflow-hidden rounded-lg border-primary/15 bg-white/95 shadow-sm">
            <CardContent className="p-0">
              <div className="border-b bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {displayedDate}
                    </p>
                    <h1 className="mt-1 text-2xl font-bold leading-tight text-foreground">
                      {reading.headline || reading.scriptureReference}
                    </h1>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      {reading.scriptureReference} · {reading.planName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                {isLoading && !syncedReading && (
                  <div className="space-y-2 rounded-lg border bg-white/70 p-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                )}

                {(reading.keyVerse || reading.focus) && (
                  <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold text-foreground">今日重點</p>
                    </div>
                    {reading.focus && <h2 className="text-base font-bold text-foreground">{reading.focus}</h2>}
                    {reading.keyVerse && (
                      <p className="mt-2 text-[15px] leading-7 text-amber-900">{reading.keyVerse}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2 rounded-lg bg-primary/5 p-3">
                  {reading.previewVerses.map((verse) => (
                    <p key={verse.verse} className="text-[16px] leading-8 text-foreground">
                      {verse.text}
                    </p>
                  ))}
                </div>

                <div className="rounded-lg border border-sky-100 bg-sky-50/80 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sky-600" />
                    <p className="text-sm font-semibold text-foreground">靈修短文</p>
                  </div>
                  <h2 className="text-base font-bold text-foreground">{reading.devotionalTitle}</h2>
                  <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
                    {reading.devotionalText}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {reading.prayer && (
                    <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Heart className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">今日愛神</p>
                      </div>
                      <p className="text-[15px] leading-7 text-muted-foreground">{reading.prayer}</p>
                    </div>
                  )}

                  {reading.loveAction && (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <HandHeart className="h-4 w-4 text-emerald-700" />
                        <p className="text-sm font-semibold text-foreground">今日愛人</p>
                      </div>
                      <p className="text-[15px] leading-7 text-muted-foreground">{reading.loveAction}</p>
                    </div>
                  )}
                </div>

                {Boolean(reading.workCommands?.length) && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-700" />
                      <p className="text-sm font-semibold text-foreground">今日工作指令</p>
                    </div>
                    <div className="space-y-2">
                      {reading.workCommands?.map((command, index) => (
                        <div key={`${command}-${index}`} className="flex gap-2 rounded-lg bg-white/80 p-2">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                          <p className="text-sm leading-6 text-muted-foreground">{command}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Boolean(reading.startupSteps?.length) && (
                  <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-violet-700" />
                      <p className="text-sm font-semibold text-foreground">7:00 啟動流程</p>
                    </div>
                    <div className="grid gap-2">
                      {reading.startupSteps?.map((step) => (
                        <div key={step.label} className="rounded-lg bg-white/75 p-2">
                          <p className="text-xs font-semibold text-violet-700">{step.label}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button className="h-11 rounded-lg" onClick={() => setNoteOpen(true)}>
                    <PenLine className="mr-2 h-4 w-4" />
                    寫靈修筆記
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-lg">
                    <Link to="/learn/my-notes">回看筆記</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <DevotionalNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        verseReference={reading.scriptureReference}
        verseText={verseText}
      />
      </div>
    </FeatureGate>
  );
};

export default ChurchReadingPage;
