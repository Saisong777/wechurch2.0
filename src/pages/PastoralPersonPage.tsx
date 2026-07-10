import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Flag,
  HeartHandshake,
  Loader2,
  MessageCircle,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Header } from '@/components/layout/Header';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PastoralTimelineEvent,
  usePastoralJourneyMutations,
  usePastoralPersonDetail,
} from '@/hooks/usePastoralJourneys';
import { cn } from '@/lib/utils';

const stageLabels: Record<string, string> = {
  friend: 'Friend / 訪客',
  frame: 'Friend / 訪客',
  newcomer: 'Friend / 訪客',
  family: 'Family / 家人',
  member: 'Family / 家人',
  follow: 'Follow / 門徒',
  follower: 'Follow / 門徒',
  care: 'Follow / 門徒',
  firemaker: 'Firemaker / 領袖',
  inactive: '暫停',
  unknown: '未分階段',
};

const sourceLabels: Record<string, string> = {
  user: '會員',
  potential_member: '新朋友',
  participant: '查經',
  care_contact: '關懷',
};

const timelineToneClasses: Record<PastoralTimelineEvent['tone'], string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

function formatDate(value?: string | null) {
  if (!value) return '尚未安排';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未安排';
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

function getTimelineIcon(type: PastoralTimelineEvent['type']) {
  if (type === 'care') return HeartHandshake;
  if (type === 'prayer') return MessageCircle;
  if (type === 'journey' || type === 'milestone') return Flag;
  if (type === 'study' || type === 'attendance') return BookOpen;
  return CalendarDays;
}

export default function PastoralPersonPage() {
  const { personId } = useParams<{ personId: string }>();
  const [searchParams] = useSearchParams();
  const church = searchParams.get('church') || 'all';
  const detailQuery = usePastoralPersonDetail(personId ?? null, church);
  const mutations = usePastoralJourneyMutations(church);
  const detail = detailQuery.data;
  const person = detail?.person;
  const loveJourney = detail?.loveJourney ?? null;
  const days = loveJourney?.progress ?? [];
  const completedDays = days.filter((day) => day.status === 'completed').length;
  const completion = days.length ? Math.round((completedDays / days.length) * 100) : 0;
  const tasks = detail?.tasks ?? [];
  const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'deferred');

  const createNextTask = async () => {
    if (!personId) return;
    try {
      await mutations.createNextStepTask.mutateAsync(personId);
      toast.success('下一步任務已建立');
    } catch (error) {
      toast.error('任務建立失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const updateTask = async (taskId: string, status: 'open' | 'done' | 'deferred') => {
    if (!personId) return;
    try {
      await mutations.updateTask.mutateAsync({ taskId, personId, updates: { status } });
      toast.success(status === 'done' ? '任務已完成' : '任務已更新');
    } catch (error) {
      toast.error('任務更新失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const startJourney = async () => {
    if (!personId) return;
    try {
      await mutations.startLoveJourney.mutateAsync(personId);
      toast.success('已啟動愛的旅程');
    } catch (error) {
      toast.error('啟動失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  return (
    <FeatureGate featureKey="pastoral_beta" title="牧養檔案 beta 測試中" description="牧養檔案目前只開放給 beta 牧者與同工">
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header title="牧養檔案" subtitle="單一對象的陪伴、任務與時間線" variant="compact" />

      <main className="container mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <Button asChild variant="ghost" className="gap-2 px-2">
            <Link to="/admin/crm">
              <ArrowLeft className="h-4 w-4" />
              回 CRM
            </Link>
          </Button>

          {detailQuery.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
              <Skeleton className="h-72 rounded-lg" />
              <Skeleton className="h-72 rounded-lg" />
            </div>
          ) : !person ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                找不到這位牧養對象。
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UserRound className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-2xl font-bold">{person.displayName}</h1>
                        <Badge>{stageLabels[person.pastoralStage] || person.pastoralStage}</Badge>
                        {detail.access && !detail.access.canViewPersonal && <Badge variant="outline">私人欄位已隱藏</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {person.primaryEmail || '未提供 Email'} ・ {person.church || '未分配教會'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(detail.links ?? []).map((link) => (
                          <Badge key={link.id} variant="secondary">
                            {sourceLabels[link.sourceType] || link.sourceType}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!loveJourney && (
                      <Button className="gap-2" onClick={startJourney} disabled={mutations.startLoveJourney.isPending}>
                        {mutations.startLoveJourney.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        啟動愛的旅程
                      </Button>
                    )}
                    <Button variant="outline" className="gap-2" onClick={createNextTask} disabled={mutations.createNextStepTask.isPending}>
                      {mutations.createNextStepTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                      建立下一步
                    </Button>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">愛的旅程</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!loveJourney ? (
                        <div className="rounded-lg border py-10 text-center">
                          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
                          <p className="mt-3 font-medium">尚未啟動 28 天陪伴</p>
                          <p className="mt-1 text-sm text-muted-foreground">啟動後，這裡會顯示每日操練與里程碑。</p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{loveJourney.name}</span>
                              <span className="text-muted-foreground">{completedDays}/{days.length} 天</span>
                            </div>
                            <Progress value={completion} />
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {days.map((day) => (
                              <div
                                key={day.id}
                                className={cn(
                                  'rounded-lg border p-3',
                                  day.needsFollowUp && 'border-rose-200 bg-rose-50/70',
                                  day.status === 'completed' && 'border-emerald-200 bg-emerald-50/70'
                                )}
                              >
                                <div className="flex items-start gap-2">
                                  {day.status === 'completed' ? (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                  ) : (
                                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-medium">Day {day.dayNumber} ・ {day.title}</p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{day.actionPrompt}</p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {day.needsFollowUp && <Badge variant="destructive">需跟進</Badge>}
                                      {day.milestoneKey && <Badge variant="outline">里程碑</Badge>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">時間線</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(detail.timeline ?? []).map((event) => {
                        const Icon = getTimelineIcon(event.type);
                        return (
                          <div key={event.id} className="grid grid-cols-[auto_1fr] gap-3">
                            <div className={cn('mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border', timelineToneClasses[event.tone])}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 rounded-lg border px-3 py-2">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="font-medium">{event.title}</p>
                                <span className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</span>
                              </div>
                              {event.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.description}</p>}
                            </div>
                          </div>
                        );
                      })}
                      {(detail.timeline ?? []).length === 0 && (
                        <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">目前沒有時間線事件</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <aside className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">任務</CardTitle>
                        <Badge variant="secondary">{openTasks.length} 未完成</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {tasks.map((task) => {
                        const done = task.status === 'done';
                        return (
                          <div key={task.id} className={cn('rounded-lg border p-3', done && 'bg-muted/40 text-muted-foreground')}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium">{task.title}</p>
                                {task.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{task.description}</p>}
                                <p className="mt-1 text-xs text-muted-foreground">到期：{formatDate(task.dueAt)}</p>
                              </div>
                              <Badge variant={done ? 'secondary' : 'default'}>{done ? '完成' : task.status === 'deferred' ? '延後' : '開啟'}</Badge>
                            </div>
                            <div className="mt-3 flex gap-2">
                              {!done && (
                                <Button size="sm" variant="outline" className="h-8" onClick={() => updateTask(task.id, 'deferred')}>
                                  延後
                                </Button>
                              )}
                              <Button size="sm" className="h-8" variant={done ? 'outline' : 'default'} onClick={() => updateTask(task.id, done ? 'open' : 'done')}>
                                {done ? '重開' : '完成'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {tasks.length === 0 && (
                        <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">尚無任務</div>
                      )}
                    </CardContent>
                  </Card>

                  {loveJourney && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">里程碑</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {loveJourney.milestones.map((milestone) => (
                          <div key={milestone.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{milestone.title}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(milestone.scheduledAt || milestone.completedAt)}</p>
                            </div>
                            <Badge variant={milestone.status === 'completed' ? 'default' : 'outline'}>
                              {milestone.status === 'completed' ? '完成' : '待安排'}
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
      </div>
    </FeatureGate>
  );
}
