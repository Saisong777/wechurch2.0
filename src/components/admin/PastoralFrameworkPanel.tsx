import { BookOpen, CheckCircle2, Flame, HeartHandshake, RefreshCw, Route, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { PastoralFrameworkRequirement, usePastoralFramework, usePastoralFrameworkMutations } from '@/hooks/usePastoralFramework';
import { cn } from '@/lib/utils';

interface PastoralFrameworkPanelProps {
  selectedChurch: string;
  currentChurchName: string;
}

const stageIcons: Record<string, typeof Users> = {
  friend: Sparkles,
  frame: Sparkles,
  family: HeartHandshake,
  follow: Route,
  firemaker: Flame,
};

const stageTones: Record<string, string> = {
  friend: 'border-sky-200 bg-sky-50 text-sky-800',
  frame: 'border-sky-200 bg-sky-50 text-sky-800',
  family: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  follow: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  firemaker: 'border-rose-200 bg-rose-50 text-rose-800',
};

const requirementLabels: Record<string, string> = {
  condition: '條件',
  participation: '參與',
  course: '課程',
  milestone: '里程碑',
};

function groupRequirements(requirements: PastoralFrameworkRequirement[]) {
  return requirements.reduce<Record<string, PastoralFrameworkRequirement[]>>((acc, requirement) => {
    const key = requirement.requirementType;
    acc[key] = acc[key] || [];
    acc[key].push(requirement);
    return acc;
  }, {});
}

export function PastoralFrameworkPanel({ selectedChurch, currentChurchName }: PastoralFrameworkPanelProps) {
  const frameworkQuery = usePastoralFramework(selectedChurch);
  const mutations = usePastoralFrameworkMutations(selectedChurch);
  const data = frameworkQuery.data;
  const stages = data?.stages ?? [];
  const totalPeople = stages.reduce((sum, stage) => sum + stage.peopleCount, 0);

  const runSeed = async () => {
    try {
      await mutations.seedFramework.mutateAsync();
      toast.success('已同步 153 / Firemaker 牧養框架');
    } catch (error) {
      console.error(error);
      toast.error('同步牧養框架失敗');
    }
  };

  if (frameworkQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (data && !data.schemaReady) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">牧養框架資料表尚未啟用</p>
            <p className="mt-1 text-sm text-muted-foreground">{data.message || '請先同步資料庫 schema。'}</p>
          </div>
          <Button onClick={runSeed} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            建立框架
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{currentChurchName} 牧養階段框架</h2>
          <p className="text-sm text-muted-foreground">以 2026 voice memo 更新版為主：Friend → Family → Follow → Firemaker。</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={runSeed}>
          <RefreshCw className="h-4 w-4" />
          同步最新框架
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <p className="font-semibold">愛的網際網路 / 門徒培育系統</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              這個框架把「愛的旅程 28 天」、穩定主日與小組、服事團隊、心理牧養督導、職場家庭門徒生活、Fire Cross 與非典理論放在同一條人成長路徑裡。
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">已歸入框架人數</span>
              <span className="font-semibold">{totalPeople}</span>
            </div>
            <Progress value={Math.min(100, totalPeople > 0 ? 100 : 0)} className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">下一步可把 individual timeline 事件回填到每個 requirement。</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-4">
        {stages.map((stage, index) => {
          const Icon = stageIcons[stage.slug] || BookOpen;
          const grouped = groupRequirements(stage.requirements);
          const percent = totalPeople > 0 ? Math.round((stage.peopleCount / totalPeople) * 100) : 0;
          return (
            <Card key={stage.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('rounded-lg border p-2', stageTones[stage.slug] || 'bg-muted text-foreground')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline">第 {index + 1} 段</Badge>
                </div>
                <CardTitle className="mt-3 text-lg">{stage.displayName}</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">{stage.description}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">目前人數</span>
                    <span className="font-semibold">{stage.peopleCount}</span>
                  </div>
                  <Progress value={percent} className="mt-2" />
                </div>
                <div className="space-y-3">
                  {Object.entries(grouped).map(([type, requirements]) => (
                    <div key={type}>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">{requirementLabels[type] || type}</p>
                      <div className="space-y-2">
                        {requirements.map((requirement) => (
                          <div key={requirement.id} className="rounded-lg bg-muted/35 px-3 py-2">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{requirement.title}</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{requirement.description}</p>
                                {requirement.targetCount > 1 && <p className="mt-1 text-xs text-muted-foreground">目標：{requirement.targetCount} 次 / 天</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {stages.length === 0 && (
          <Card className="xl:col-span-4">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">尚未建立牧養框架。</p>
              <Button onClick={runSeed} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                建立 Friend / Family / Follow / Firemaker
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">整合來源</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {(data?.sources ?? []).map((source) => (
            <div key={source.label} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">來源</Badge>
                <p className="font-medium">{source.label}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{source.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
