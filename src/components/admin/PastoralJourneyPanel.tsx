import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  Database,
  ExternalLink,
  Flag,
  GitMerge,
  HeartHandshake,
  ListFilter,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  LoveJourneyProgressDay,
  PastoralTimelineEvent,
  PastoralPersonSummary,
  usePastoralJourneyMutations,
  usePastoralPersonDetail,
  usePastoralPersons,
  usePersonMergeSuggestions,
} from '@/hooks/usePastoralJourneys';
import { cn } from '@/lib/utils';

interface PastoralJourneyPanelProps {
  selectedChurch: string;
  currentChurchName: string;
}

type PersonFilter = 'all' | 'tasks' | 'follow-up' | 'active' | 'not-started' | 'completed';

const stageLabels: Record<string, string> = {
  frame: 'Friend / 訪客',
  friend: 'Friend / 訪客',
  family: 'Family / 家人',
  follow: 'Follow / 門徒',
  follower: 'Follower / 門徒',
  firemaker: 'Firemaker / 領袖',
  newcomer: 'Friend / 訪客',
  member: 'Family / 家人',
  care: 'Follow / 門徒',
  inactive: '暫停',
  unknown: '未分階段',
};

const sourceLabels: Record<string, string> = {
  user: '會員',
  potential_member: '新朋友',
  participant: '查經',
  care_contact: '關懷',
};

function getCompletion(person: PastoralPersonSummary) {
  if (!person.totalDays) return 0;
  return Math.round((person.completedDays / person.totalDays) * 100);
}

function isJourneyCompleted(person: PastoralPersonSummary) {
  return person.totalDays > 0 && person.completedDays >= person.totalDays;
}

function matchesPersonFilter(person: PastoralPersonSummary, filter: PersonFilter) {
  if (filter === 'tasks') return person.openTaskCount > 0;
  if (filter === 'follow-up') return person.needsFollowUpCount > 0;
  if (filter === 'active') return !!person.loveJourneyId && !isJourneyCompleted(person);
  if (filter === 'not-started') return !person.loveJourneyId;
  if (filter === 'completed') return isJourneyCompleted(person);
  return true;
}

function getPersonPriority(person: PastoralPersonSummary) {
  if (person.openTaskCount > 0) return 0;
  if (person.needsFollowUpCount > 0) return 0;
  if (!!person.loveJourneyId && !isJourneyCompleted(person)) return 1;
  if (!person.loveJourneyId) return 2;
  if (isJourneyCompleted(person)) return 3;
  return 4;
}

function formatDate(value?: string | null) {
  if (!value) return '尚未開始';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未開始';
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '時間未定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '時間未定';
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

function splitWeeks(days: LoveJourneyProgressDay[]) {
  return [
    days.filter((day) => day.dayNumber <= 7),
    days.filter((day) => day.dayNumber > 7 && day.dayNumber <= 14),
    days.filter((day) => day.dayNumber > 14 && day.dayNumber <= 21),
    days.filter((day) => day.dayNumber > 21),
  ];
}

function getWeekIndex(dayNumber: number) {
  return Math.min(3, Math.max(0, Math.floor((dayNumber - 1) / 7)));
}

const timelineToneClasses: Record<PastoralTimelineEvent['tone'], string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

function getTimelineIcon(type: PastoralTimelineEvent['type']) {
  if (type === 'care') return HeartHandshake;
  if (type === 'prayer') return MessageCircle;
  if (type === 'journey' || type === 'milestone') return Flag;
  if (type === 'study' || type === 'attendance') return BookOpen;
  return CalendarDays;
}

export function PastoralJourneyPanel({ selectedChurch, currentChurchName }: PastoralJourneyPanelProps) {
  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonFilter>('all');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [showOnlyOpenDays, setShowOnlyOpenDays] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  const personsQuery = usePastoralPersons(selectedChurch, {
    search: deferredSearch,
    filter: personFilter,
    limit: 160,
  });
  const statsPersonsQuery = usePastoralPersons(selectedChurch, { limit: 500 });
  const mergeSuggestionsQuery = usePersonMergeSuggestions(selectedChurch);
  const mutations = usePastoralJourneyMutations(selectedChurch);
  const detailQuery = usePastoralPersonDetail(selectedPersonId, selectedChurch);

  const persons = personsQuery.data?.persons ?? [];
  const statsPersons = statsPersonsQuery.data?.persons ?? persons;
  const mergeSuggestions = mergeSuggestionsQuery.data?.suggestions ?? [];
  const schemaReady = personsQuery.data?.schemaReady ?? true;

  const filteredPersons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return persons
      .filter((person) => matchesPersonFilter(person, personFilter))
      .filter((person) => {
        if (!query) return true;
        return [
          person.displayName,
          person.primaryEmail || '',
          person.church || '',
          stageLabels[person.pastoralStage] || person.pastoralStage,
          person.loveJourneyStatus || '',
        ].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const priorityDiff = getPersonPriority(a) - getPersonPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        const followUpDiff = b.needsFollowUpCount - a.needsFollowUpCount;
        if (followUpDiff !== 0) return followUpDiff;
        return a.displayName.localeCompare(b.displayName, 'zh-Hant');
      });
  }, [persons, personFilter, search]);

  useEffect(() => {
    if (selectedPersonId && filteredPersons.some((person) => person.id === selectedPersonId)) return;
    setSelectedPersonId(filteredPersons[0]?.id ?? persons[0]?.id ?? null);
  }, [filteredPersons, persons, selectedPersonId]);

  const selectedPerson = persons.find((person) => person.id === selectedPersonId) ?? null;
  const detail = detailQuery.data;
  const loveJourney = detail?.loveJourney ?? null;
  const journeyDays = loveJourney?.progress ?? [];
  const completedDays = journeyDays.filter((day) => day.status === 'completed').length;
  const journeyCompletion = journeyDays.length > 0 ? Math.round((completedDays / journeyDays.length) * 100) : 0;
  const timelineEvents = detail?.timeline ?? [];
  const tasks = detail?.tasks ?? [];
  const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'deferred');
  const weeks = useMemo(() => splitWeeks(journeyDays), [journeyDays]);
  const nextFollowUpDay = journeyDays.find((day) => day.needsFollowUp) ?? null;
  const nextOpenDay = journeyDays.find((day) => day.status !== 'completed' && day.status !== 'skipped') ?? null;
  const focusDay = nextFollowUpDay ?? nextOpenDay;
  const selectedWeekDays = weeks[selectedWeek] ?? [];
  const visibleWeekDays = showOnlyOpenDays
    ? selectedWeekDays.filter((day) => day.needsFollowUp || (day.status !== 'completed' && day.status !== 'skipped'))
    : selectedWeekDays;

  const stats = useMemo(() => {
    const started = persons.filter((person) => person.loveJourneyId).length;
    const active = statsPersons.filter((person) => person.loveJourneyId && !isJourneyCompleted(person)).length;
    const notStarted = statsPersons.filter((person) => !person.loveJourneyId).length;
    const followUp = statsPersons.reduce((sum, person) => sum + person.needsFollowUpCount, 0);
    const tasksCount = statsPersons.reduce((sum, person) => sum + person.openTaskCount, 0);
    const completed = statsPersons.filter(isJourneyCompleted).length;
    return { total: statsPersons.length, started, active, notStarted, followUp, tasksCount, completed };
  }, [persons, statsPersons]);

  const personFilterOptions = useMemo(() => ([
    { id: 'all' as const, label: '全部', value: stats.total, icon: Users },
    { id: 'tasks' as const, label: '任務', value: stats.tasksCount, icon: ClipboardList },
    { id: 'follow-up' as const, label: '跟進', value: stats.followUp, icon: AlertCircle },
    { id: 'active' as const, label: '旅程中', value: stats.active, icon: BookOpen },
    { id: 'not-started' as const, label: '未啟動', value: stats.notStarted, icon: Clock3 },
    { id: 'completed' as const, label: '完成', value: stats.completed, icon: CheckCircle2 },
  ]), [stats]);

  const weekSummaries = useMemo(() => weeks.map((weekDays, index) => {
    const completed = weekDays.filter((day) => day.status === 'completed').length;
    const followUps = weekDays.filter((day) => day.needsFollowUp).length;
    return {
      index,
      label: `第 ${index + 1} 週`,
      completed,
      followUps,
      total: weekDays.length,
    };
  }), [weeks]);
  const NextActionIcon = !loveJourney
    ? Sparkles
    : nextFollowUpDay
      ? AlertCircle
      : journeyCompletion >= 100
        ? CheckCircle2
        : Target;

  useEffect(() => {
    if (!loveJourney?.id) {
      setSelectedWeek(0);
      setShowOnlyOpenDays(false);
      return;
    }
    const firstFocusDay = journeyDays.find((day) => day.needsFollowUp)
      ?? journeyDays.find((day) => day.status !== 'completed' && day.status !== 'skipped');
    setSelectedWeek(firstFocusDay ? getWeekIndex(firstFocusDay.dayNumber) : 0);
    setShowOnlyOpenDays(false);
  }, [loveJourney?.id, selectedPersonId]);

  const handleReconcile = async () => {
    try {
      const result = await mutations.reconcilePersons.mutateAsync();
      toast.success('牧養名單已同步', {
        description: `處理 ${result.sourceCount ?? 0} 筆來源，新增 ${result.createdPersons ?? 0} 位。`,
      });
    } catch (error) {
      toast.error('同步失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const handleSeedTemplate = async () => {
    try {
      await mutations.seedLoveJourney.mutateAsync();
      toast.success('愛的旅程模板已啟用');
    } catch (error) {
      toast.error('模板啟用失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const handleStartJourney = async (personId: string) => {
    try {
      await mutations.startLoveJourney.mutateAsync(personId);
      toast.success('已啟動愛的旅程');
    } catch (error) {
      toast.error('啟動失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const handleCreateNextStepTask = async () => {
    if (!selectedPersonId) return;
    try {
      await mutations.createNextStepTask.mutateAsync(selectedPersonId);
      toast.success('下一步任務已建立');
    } catch (error) {
      toast.error('任務建立失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const handleTaskStatus = async (taskId: string, status: 'open' | 'done' | 'deferred') => {
    if (!selectedPersonId) return;
    try {
      await mutations.updateTask.mutateAsync({ taskId, personId: selectedPersonId, updates: { status } });
      toast.success(status === 'done' ? '任務已完成' : '任務已更新');
    } catch (error) {
      toast.error('任務更新失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const handleDismissMergeSuggestion = async (primaryPersonId: string, duplicatePersonId: string) => {
    try {
      await mutations.dismissMergeSuggestion.mutateAsync({ primaryPersonId, duplicatePersonId });
      toast.success('已略過這組去重提示');
    } catch (error) {
      toast.error('略過失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const handleMergeSuggestion = async (primaryPersonId: string, duplicatePersonId: string) => {
    try {
      await mutations.mergePersons.mutateAsync({ primaryPersonId, duplicatePersonId });
      setSelectedPersonId(primaryPersonId);
      toast.success('已合併重複牧養對象');
    } catch (error) {
      toast.error('合併失敗', { description: error instanceof Error ? error.message : '請稍後再試' });
    }
  };

  const handleToggleDay = (day: LoveJourneyProgressDay, checked: boolean) => {
    if (!selectedPersonId) return;
    mutations.updateProgress.mutate({
      progressId: day.id,
      personId: selectedPersonId,
      updates: { status: checked ? 'completed' : 'not_started' },
    });
  };

  const handleToggleFollowUp = (day: LoveJourneyProgressDay, needsFollowUp: boolean) => {
    if (!selectedPersonId) return;
    mutations.updateProgress.mutate({
      progressId: day.id,
      personId: selectedPersonId,
      updates: { needsFollowUp },
    });
  };

  if (!schemaReady) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-900">牧養資料表尚未啟用</p>
              <p className="mt-1 text-sm text-amber-800">
                先在部署資料庫跑 `npm run db:push`，再回來同步牧養名單。
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => personsQuery.refetch()} className="gap-2 border-amber-300">
            <RefreshCw className="h-4 w-4" />
            重新檢查
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: '牧養對象', value: stats.total, icon: Users, tone: 'bg-sky-50 text-sky-700' },
          { label: '旅程中', value: stats.active, icon: BookOpen, tone: 'bg-indigo-50 text-indigo-700' },
          { label: '待辦任務', value: stats.tasksCount, icon: ClipboardList, tone: 'bg-amber-50 text-amber-700' },
          { label: '完成旅程', value: stats.completed, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
              <div className={cn('rounded-lg p-2', item.tone)}>
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold">牧養資料同步</p>
          <p className="mt-1 text-sm text-muted-foreground">
            目前範圍：{currentChurchName}。會員、新朋友、查經參與與你的關懷名單會合併到 person。
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleSeedTemplate}
            disabled={mutations.seedLoveJourney.isPending}
          >
            {mutations.seedLoveJourney.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            啟用模板
          </Button>
          <Button
            className="gap-2"
            onClick={handleReconcile}
            disabled={mutations.reconcilePersons.isPending}
          >
            {mutations.reconcilePersons.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            同步名單
          </Button>
        </div>
      </div>

      {mergeSuggestions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <GitMerge className="h-4 w-4 text-amber-700" />
                <p className="font-semibold text-amber-950">可能重複的牧養對象</p>
                <Badge variant="outline" className="border-amber-300 bg-white/70 text-amber-800">
                  {mergeSuggestions.length}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-amber-800">
                系統先列出高信心候選；確認後可把右側資料合併到左側 person。
              </p>
            </div>
            {mergeSuggestionsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-amber-700" />}
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {mergeSuggestions.slice(0, 4).map((suggestion) => (
              <div key={suggestion.id} className="rounded-lg border border-amber-200 bg-white/80 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {suggestion.primaryName} / {suggestion.duplicateName}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {suggestion.primaryEmail || '左側未填 Email'} ・ {suggestion.duplicateEmail || '右側未填 Email'}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">{suggestion.reason}，信心 {suggestion.confidence}%</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 bg-white"
                      onClick={() => {
                        setSelectedPersonId(suggestion.primaryPersonId);
                        setPersonFilter('all');
                      }}
                    >
                      查看
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 bg-white"
                      disabled={mutations.dismissMergeSuggestion.isPending}
                      onClick={() => handleDismissMergeSuggestion(suggestion.primaryPersonId, suggestion.duplicatePersonId)}
                    >
                      略過
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={mutations.mergePersons.isPending}
                      onClick={() => handleMergeSuggestion(suggestion.primaryPersonId, suggestion.duplicatePersonId)}
                    >
                      合併
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">牧養對象</CardTitle>
                <Badge variant="secondary">{filteredPersons.length}</Badge>
              </div>
              {personsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜尋姓名、Email、階段"
                className="pl-9"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {personFilterOptions.map((filter) => {
                const Icon = filter.icon;
                const selected = personFilter === filter.id;
                return (
                  <Button
                    key={filter.id}
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    className="h-8 gap-1.5 px-2 text-xs"
                    aria-pressed={selected}
                    onClick={() => setPersonFilter(filter.id)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {filter.label}
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px]',
                      selected ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                    )}
                    >
                      {filter.value}
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 xl:max-h-[calc(100vh-19rem)] xl:overflow-y-auto xl:pr-3">
            {personsQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)
            ) : filteredPersons.length === 0 ? (
              <div className="rounded-lg border py-8 text-center">
                <ListFilter className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">找不到符合條件的對象</p>
                <p className="mt-1 text-xs text-muted-foreground">換個篩選或同步現有名單</p>
                {(search || personFilter !== 'all') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 gap-2"
                    onClick={() => {
                      setSearch('');
                      setPersonFilter('all');
                    }}
                  >
                    <X className="h-4 w-4" />
                    清除
                  </Button>
                )}
              </div>
            ) : (
              filteredPersons.map((person) => {
                const active = person.id === selectedPersonId;
                const completion = getCompletion(person);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setSelectedPersonId(person.id)}
                    aria-pressed={active}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active && 'border-primary bg-primary/5 shadow-sm'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{person.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{person.primaryEmail || '未提供 Email'}</p>
                      </div>
                      <Badge variant={person.needsFollowUpCount > 0 ? 'destructive' : 'outline'} className="shrink-0">
                        {stageLabels[person.pastoralStage] || person.pastoralStage}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{person.loveJourneyId ? '愛的旅程' : '尚未啟動'}</span>
                        <span>{person.loveJourneyId ? `${person.completedDays}/${person.totalDays || 28}` : `${completion}%`}</span>
                      </div>
                      <Progress value={completion} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {person.openTaskCount > 0 && <Badge variant="default">任務 {person.openTaskCount}</Badge>}
                      {person.needsFollowUpCount > 0 && <Badge variant="destructive">跟進 {person.needsFollowUpCount}</Badge>}
                      {person.hasUser && <Badge variant="secondary">會員</Badge>}
                      {person.hasPotentialMember && <Badge variant="secondary">新朋友</Badge>}
                      {person.hasParticipant && <Badge variant="secondary">查經</Badge>}
                      {person.hasCareContact && <Badge variant="secondary">關懷</Badge>}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {selectedPerson?.displayName || '選擇一位牧養對象'}
                </CardTitle>
                {selectedPerson && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {selectedPerson.primaryEmail || '未提供 Email'} ・ {selectedPerson.church || '未分配教會'}
                  </p>
                )}
              </div>
              {selectedPerson && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" asChild>
                    <Link to={`/admin/crm/person/${selectedPerson.id}?church=${encodeURIComponent(selectedChurch)}`}>
                      <ExternalLink className="h-4 w-4" />
                      個人檔案
                    </Link>
                  </Button>
                  {!loveJourney && (
                    <Button
                      className="gap-2"
                      onClick={() => handleStartJourney(selectedPerson.id)}
                      disabled={mutations.startLoveJourney.isPending}
                    >
                      {mutations.startLoveJourney.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      啟動旅程
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto xl:pr-4">
            {!selectedPerson ? (
              <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">尚未選擇對象</div>
            ) : detailQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-60 rounded-lg" />
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">資料來源</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(detail?.links ?? []).map((link) => (
                        <Badge key={link.id} variant="secondary">
                          {sourceLabels[link.sourceType] || link.sourceType}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">開始時間</p>
                    <p className="mt-2 font-medium">{formatDate(loveJourney?.startedAt)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">完成度</p>
                    <p className="mt-2 font-medium">{journeyCompletion}%</p>
                  </div>
                </div>

                {detail?.access && !detail.access.canViewPersonal && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-sm text-sky-900">
                    你目前可看牧養節奏與任務；私人筆記、陪伴者註記會依權限隱藏。
                  </div>
                )}

                <div className={cn(
                  'rounded-lg border p-4',
                  nextFollowUpDay
                    ? 'border-rose-200 bg-rose-50/70'
                    : journeyCompletion >= 100
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'bg-muted/30'
                )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                        nextFollowUpDay
                          ? 'border-rose-200 bg-white text-rose-700'
                          : journeyCompletion >= 100
                            ? 'border-emerald-200 bg-white text-emerald-700'
                            : 'border-primary/20 bg-background text-primary'
                      )}
                      >
                        <NextActionIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">下一步</p>
                        <p className="mt-1 font-semibold">
                          {!loveJourney
                            ? '啟動愛的旅程'
                            : nextFollowUpDay
                              ? `跟進 Day ${nextFollowUpDay.dayNumber} ・ ${nextFollowUpDay.title}`
                              : journeyCompletion >= 100
                                ? '確認完成後的差派或服事'
                                : nextOpenDay
                                  ? `繼續 Day ${nextOpenDay.dayNumber} ・ ${nextOpenDay.title}`
                                  : '保持陪伴節奏'}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {!loveJourney
                            ? '從 28 天陪伴開始，把新朋友、扎根、操練和服事串起來。'
                            : nextFollowUpDay
                              ? nextFollowUpDay.actionPrompt || '這一天已標記需要同工主動關心。'
                              : journeyCompletion >= 100
                                ? '可安排見證、受洗、服事或下一段門訓路徑。'
                                : nextOpenDay?.actionPrompt || '把今天的操練完成，保持節奏。'}
                        </p>
                      </div>
                    </div>
                    {!loveJourney ? (
                      <Button
                        className="shrink-0 gap-2"
                        onClick={() => handleStartJourney(selectedPerson.id)}
                        disabled={mutations.startLoveJourney.isPending}
                      >
                        {mutations.startLoveJourney.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        啟動
                      </Button>
                    ) : (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {focusDay && (
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              setSelectedWeek(getWeekIndex(focusDay.dayNumber));
                              setShowOnlyOpenDays(false);
                            }}
                          >
                            <ArrowRight className="h-4 w-4" />
                            前往
                          </Button>
                        )}
                        <Button
                          type="button"
                          className="gap-2"
                          onClick={handleCreateNextStepTask}
                          disabled={mutations.createNextStepTask.isPending}
                        >
                          {mutations.createNextStepTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                          建立任務
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">下一步任務</p>
                      <p className="mt-1 text-sm text-muted-foreground">把提醒交給資料庫，不只停在畫面提示。</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleCreateNextStepTask}
                      disabled={mutations.createNextStepTask.isPending}
                    >
                      {mutations.createNextStepTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                      新增下一步
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {tasks.slice(0, 6).map((task) => {
                      const done = task.status === 'done';
                      return (
                        <div key={task.id} className={cn('rounded-lg border px-3 py-2', done && 'bg-muted/40 text-muted-foreground')}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{task.title}</p>
                                <Badge variant={task.priority === 'urgent' || task.priority === 'high' ? 'destructive' : 'outline'}>
                                  {task.priority === 'urgent' ? '緊急' : task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '一般'}
                                </Badge>
                                <Badge variant={done ? 'secondary' : 'default'}>
                                  {done ? '已完成' : task.status === 'deferred' ? '延後' : '開啟'}
                                </Badge>
                              </div>
                              {task.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{task.description}</p>}
                              <p className="mt-1 text-xs text-muted-foreground">到期：{formatDate(task.dueAt)}</p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              {!done && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => handleTaskStatus(task.id, 'deferred')}
                                  disabled={mutations.updateTask.isPending}
                                >
                                  延後
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant={done ? 'outline' : 'default'}
                                className="h-8"
                                onClick={() => handleTaskStatus(task.id, done ? 'open' : 'done')}
                                disabled={mutations.updateTask.isPending}
                              >
                                {done ? '重開' : '完成'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {tasks.length === 0 && (
                      <div className="rounded-lg border py-6 text-center text-sm text-muted-foreground">
                        尚無任務，可以從上方下一步直接建立。
                      </div>
                    )}
                    {openTasks.length > 6 && (
                      <p className="text-xs text-muted-foreground">還有 {openTasks.length - 6} 個未完成任務，請到個人檔案查看完整清單。</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">牧養時間線</p>
                      <p className="mt-1 text-sm text-muted-foreground">最近的查經、關懷、禱告與旅程事件</p>
                    </div>
                    <Badge variant="secondary">{timelineEvents.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {timelineEvents.slice(0, 8).map((event) => {
                      const Icon = getTimelineIcon(event.type);
                      return (
                        <div key={event.id} className="grid grid-cols-[auto_1fr] gap-3">
                          <div className={cn('mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border', timelineToneClasses[event.tone])}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 rounded-lg border px-3 py-2">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-medium">{event.title}</p>
                              <span className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt)}</span>
                            </div>
                            {event.description && (
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {timelineEvents.length === 0 && (
                      <div className="rounded-lg border py-6 text-center text-sm text-muted-foreground">
                        目前還沒有可顯示的牧養事件
                      </div>
                    )}
                  </div>
                </div>

                {!loveJourney ? (
                  <div className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <BookOpen className="mt-0.5 h-5 w-5 text-primary" />
                      <div className="min-w-0">
                        <p className="font-semibold">愛的旅程 28 天</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          四週陪伴慕道與初信者，含受洗、主餐、見證與差派里程碑。
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {(detail?.seed.days ?? []).slice(0, 8).map((day) => (
                        <div key={day.dayNumber} className="rounded-md border px-3 py-2 text-sm">
                          Day {day.dayNumber} ・ {day.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">28 天進度</span>
                        <span className="text-muted-foreground">{completedDays}/{journeyDays.length} 天</span>
                      </div>
                      <Progress value={journeyCompletion} />
                    </div>

                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-4">
                        {weekSummaries.map((week) => {
                          const selected = selectedWeek === week.index;
                          return (
                            <button
                              key={week.label}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setSelectedWeek(week.index)}
                              className={cn(
                                'min-h-[76px] rounded-lg border p-3 text-left transition hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                selected && 'border-primary bg-primary/5 shadow-sm'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{week.label}</span>
                                {week.followUps > 0 && <Badge variant="destructive">{week.followUps}</Badge>}
                              </div>
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{week.completed}/{week.total} 天</span>
                                  <span>{week.total ? Math.round((week.completed / week.total) * 100) : 0}%</span>
                                </div>
                                <Progress value={week.total ? Math.round((week.completed / week.total) * 100) : 0} />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">{weekSummaries[selectedWeek]?.label ?? '第 1 週'}</p>
                          <p className="text-xs text-muted-foreground">顯示當週每日陪伴與跟進狀態</p>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>只看未完成/跟進</span>
                          <Switch
                            checked={showOnlyOpenDays}
                            onCheckedChange={setShowOnlyOpenDays}
                            aria-label="只看未完成或需要跟進的天數"
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        {visibleWeekDays.map((day) => {
                          const focused = focusDay?.id === day.id;
                          return (
                            <div
                              key={day.id}
                              className={cn(
                                'rounded-lg border p-3 transition',
                                focused && 'border-primary/40 bg-primary/5',
                                day.needsFollowUp && 'border-rose-200 bg-rose-50/70'
                              )}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <label className="flex min-w-0 cursor-pointer gap-3">
                                  <Checkbox
                                    checked={day.status === 'completed'}
                                    onCheckedChange={(checked) => handleToggleDay(day, checked === true)}
                                    aria-label={`完成 Day ${day.dayNumber}`}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">Day {day.dayNumber} ・ {day.title}</p>
                                      {focused && <Badge variant="secondary">焦點</Badge>}
                                      {day.milestoneKey && (
                                        <Badge variant="outline" className="gap-1">
                                          <Flag className="h-3 w-3" />
                                          里程碑
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{day.actionPrompt}</p>
                                  </div>
                                </label>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="text-xs text-muted-foreground">跟進</span>
                                  <Switch
                                    checked={day.needsFollowUp}
                                    onCheckedChange={(checked) => handleToggleFollowUp(day, checked)}
                                    aria-label={`Day ${day.dayNumber} 需要跟進`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {visibleWeekDays.length === 0 && (
                          <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
                            這一週目前沒有未完成或需跟進的項目
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold">牧養里程碑</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {loveJourney.milestones.map((milestone) => {
                          const completed = milestone.status === 'completed';
                          return (
                            <button
                              key={milestone.id}
                              type="button"
                              onClick={() => {
                                if (!selectedPersonId) return;
                                mutations.updateMilestone.mutate({
                                  milestoneId: milestone.id,
                                  personId: selectedPersonId,
                                  updates: { status: completed ? 'planned' : 'completed' },
                                });
                              }}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border p-3 text-left transition hover:border-primary/60',
                                completed && 'border-emerald-200 bg-emerald-50'
                              )}
                            >
                              {completed ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                              ) : (
                                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium">{milestone.title}</p>
                                <p className="text-xs text-muted-foreground">{completed ? '已完成' : '待安排'}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {selectedPerson.needsFollowUpCount > 0 && (
                  <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
                    <UserCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">有 {selectedPerson.needsFollowUpCount} 天需要跟進</p>
                      <p className="mt-1 text-sm">可以在每日項目取消跟進，或交給小組長/陪伴者處理。</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
