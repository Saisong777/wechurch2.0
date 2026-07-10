import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Flag,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Header } from '@/components/layout/Header';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { LoveJourneyProgressDay, PastoralPersonDetail } from '@/hooks/usePastoralJourneys';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

type SelfLoveJourneyResponse = PastoralPersonDetail | {
  schemaReady: false;
  error?: string;
};

function splitWeeks(days: LoveJourneyProgressDay[]) {
  return [
    days.filter((day) => day.dayNumber <= 7),
    days.filter((day) => day.dayNumber > 7 && day.dayNumber <= 14),
    days.filter((day) => day.dayNumber > 14 && day.dayNumber <= 21),
    days.filter((day) => day.dayNumber > 21),
  ];
}

function isDetail(data: SelfLoveJourneyResponse | undefined): data is PastoralPersonDetail {
  return Boolean(data && data.schemaReady !== false && 'person' in data);
}

function JourneyDayReading({ day }: { day: LoveJourneyProgressDay }) {
  if (!day.scriptureReference && !day.bodyMarkdown) return null;

  return (
    <details className="mt-3 rounded-lg border bg-background/80 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-primary">閱讀今日內容</summary>
      <div className="mt-3 space-y-3">
        {day.scriptureReference && (
          <p className="rounded-md bg-primary/5 px-3 py-2 leading-7 text-primary">
            {day.scriptureReference}
          </p>
        )}
        {day.bodyMarkdown && (
          <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 px-3 py-2 leading-7 text-foreground">
            {day.bodyMarkdown}
          </div>
        )}
      </div>
    </details>
  );
}

export default function LoveJourneyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const journeyQuery = useQuery<SelfLoveJourneyResponse>({
    queryKey: ['/api/me/love-journey'],
    queryFn: async () => {
      const response = await fetch('/api/me/love-journey', { credentials: 'include' });
      if (response.status === 401) throw new Error('請先登入');
      if (!response.ok) throw new Error('無法取得愛的旅程');
      return response.json();
    },
    enabled: !!user,
  });

  const detail = isDetail(journeyQuery.data) ? journeyQuery.data : null;
  const loveJourney = detail?.loveJourney ?? null;
  const days = loveJourney?.progress ?? [];
  const weeks = useMemo(() => splitWeeks(days), [days]);
  const selectedDays = weeks[selectedWeek] ?? [];
  const completedDays = days.filter((day) => day.status === 'completed').length;
  const completion = days.length ? Math.round((completedDays / days.length) * 100) : 0;
  const nextDay = days.find((day) => day.status !== 'completed' && day.status !== 'skipped') ?? null;

  useEffect(() => {
    if (!loveJourney?.id) return;
    setDrafts(Object.fromEntries(days.map((day) => [day.id, day.responseText || ''])));
    const focusDay = days.find((day) => day.status !== 'completed' && day.status !== 'skipped');
    if (focusDay) setSelectedWeek(Math.min(3, Math.floor((focusDay.dayNumber - 1) / 7)));
  }, [loveJourney?.id]);

  const startJourney = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/me/love-journey/start');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/love-journey'] });
      toast.success('愛的旅程已啟動');
    },
    onError: () => toast.error('啟動失敗，請稍後再試'),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ day, status, responseText }: { day: LoveJourneyProgressDay; status?: string; responseText?: string }) => {
      const response = await apiRequest('PATCH', `/api/me/love-journey/progress/${day.id}`, {
        status,
        responseText,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/love-journey'] });
    },
    onError: () => toast.error('更新失敗，請稍後再試'),
  });

  const toggleDay = (day: LoveJourneyProgressDay, checked: boolean) => {
    updateProgress.mutate({ day, status: checked ? 'completed' : 'in_progress', responseText: drafts[day.id] ?? day.responseText ?? '' });
  };

  const saveResponse = (day: LoveJourneyProgressDay) => {
    updateProgress.mutate({ day, status: day.status === 'not_started' ? 'in_progress' : day.status, responseText: drafts[day.id] ?? '' });
    toast.success('回應已保存');
  };

  return (
    <FeatureGate featureKey="pastoral_beta" title="愛的旅程 beta 測試中" description="愛的旅程目前只開放給 beta 同工">
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header title="愛的旅程" subtitle="28 天同行與操練" variant="compact" />

      <main className="container mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <Button asChild variant="ghost" className="gap-2 px-2">
            <Link to="/me">
              <ArrowLeft className="h-4 w-4" />
              回個人管理
            </Link>
          </Button>

          {!user ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="font-semibold">請先登入</p>
                <Button asChild className="mt-4">
                  <Link to="/login">登入</Link>
                </Button>
              </CardContent>
            </Card>
          ) : journeyQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="h-72 rounded-lg" />
            </div>
          ) : journeyQuery.data?.schemaReady === false ? (
            <Card className="border-amber-200 bg-amber-50/70">
              <CardContent className="py-8 text-center text-amber-900">
                牧養資料表尚未啟用，請先完成資料庫同步。
              </CardContent>
            </Card>
          ) : !loveJourney ? (
            <section className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold">開始 28 天愛的旅程</h1>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      每天一個操練，陪你從認識、扎根、同行，到找到下一步。
                    </p>
                  </div>
                </div>
                <Button className="gap-2" onClick={() => startJourney.mutate()} disabled={startJourney.isPending}>
                  {startJourney.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  啟動旅程
                </Button>
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">愛的旅程</p>
                    <h1 className="mt-1 text-2xl font-bold">{loveJourney.name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {nextDay ? `下一步：Day ${nextDay.dayNumber} ・ ${nextDay.title}` : '這段旅程已完成'}
                    </p>
                  </div>
                  <Badge variant={completion >= 100 ? 'default' : 'secondary'}>{completion}%</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{completedDays}/{days.length} 天完成</span>
                    <span className="text-muted-foreground">第 {selectedWeek + 1} 週</span>
                  </div>
                  <Progress value={completion} />
                </div>
              </section>

              <div className="grid gap-2 sm:grid-cols-4">
                {weeks.map((weekDays, index) => {
                  const selected = selectedWeek === index;
                  const weekCompleted = weekDays.filter((day) => day.status === 'completed').length;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedWeek(index)}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-lg border bg-card p-3 text-left transition hover:border-primary/60 hover:bg-muted/40',
                        selected && 'border-primary bg-primary/5'
                      )}
                    >
                      <p className="font-medium">第 {index + 1} 週</p>
                      <p className="mt-1 text-xs text-muted-foreground">{weekCompleted}/{weekDays.length} 天</p>
                    </button>
                  );
                })}
              </div>

              <section className="space-y-3">
                {selectedDays.map((day) => {
                  const completed = day.status === 'completed';
                  return (
                    <Card key={day.id} className={cn(completed && 'border-emerald-200 bg-emerald-50/60')}>
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={completed}
                              onCheckedChange={(checked) => toggleDay(day, checked === true)}
                              aria-label={`完成 Day ${day.dayNumber}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-bold">Day {day.dayNumber} ・ {day.title}</h2>
                                {completed ? (
                                  <Badge className="gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    完成
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1">
                                    <Circle className="h-3 w-3" />
                                    進行中
                                  </Badge>
                                )}
                                {day.milestoneKey && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Flag className="h-3 w-3" />
                                    里程碑
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{day.actionPrompt}</p>
                              {day.reflectionPrompt && (
                                <div className="mt-3 rounded-lg border bg-background/80 p-3">
                                  <div className="flex items-start gap-2 text-sm">
                                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <p className="leading-6">{day.reflectionPrompt}</p>
                                  </div>
                                </div>
                              )}
                              <JourneyDayReading day={day} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Textarea
                              value={drafts[day.id] ?? ''}
                              onChange={(event) => setDrafts((current) => ({ ...current, [day.id]: event.target.value }))}
                              placeholder="寫下今天的回應"
                              className="min-h-24 resize-y bg-white/80"
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => saveResponse(day)}
                                disabled={updateProgress.isPending}
                              >
                                保存回應
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </main>
      </div>
    </FeatureGate>
  );
}
