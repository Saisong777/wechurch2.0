import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Bot, CheckCircle2, Gauge, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';

type PlatformEventRow = {
  event_name: string;
  count: number;
};

type PlatformErrorRow = {
  source: string;
  status_code: number;
  count: number;
};

type AiUsageRow = {
  feature: string;
  model: string;
  status: string;
  count: number;
  avg_quality: number;
  cost_units: number;
};

type PlatformSummary = {
  events: PlatformEventRow[];
  errors: PlatformErrorRow[];
  aiUsage: AiUsageRow[];
};

const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString();

export const PlatformMaturityPanel = () => {
  const { data, isLoading, isFetching, refetch } = useQuery<PlatformSummary>({
    queryKey: ['/api/admin/platform-summary'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/platform-summary');
      return response.json();
    },
    refetchInterval: 120000,
  });

  const events = data?.events || [];
  const errors = data?.errors || [];
  const aiUsage = data?.aiUsage || [];
  const totalEvents = events.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const totalErrors = errors.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const totalAiRuns = aiUsage.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const failedAiRuns = aiUsage
    .filter((row) => row.status !== 'COMPLETED')
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const aiCostUnits = aiUsage.reduce((sum, row) => sum + Number(row.cost_units || 0), 0);
  const weightedQuality = totalAiRuns > 0
    ? Math.round(
      aiUsage.reduce((sum, row) => sum + Number(row.avg_quality || 0) * Number(row.count || 0), 0) / totalAiRuns
    )
    : 0;
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        84
        + Math.min(totalEvents, 200) / 20
        - Math.min(totalErrors * 8, 40)
        - Math.min(failedAiRuns * 6, 24)
        + (weightedQuality >= 70 ? 6 : weightedQuality >= 50 ? 2 : 0)
      )
    )
  );

  const statusLabel = totalErrors > 0 || failedAiRuns > 0
    ? '需要留意'
    : totalEvents > 0 || totalAiRuns > 0
      ? '運作正常'
      : '等待資料';
  const statusTone = totalErrors > 0 || failedAiRuns > 0
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">平台成熟度</h3>
            <Badge variant="outline" className={statusTone}>{statusLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            最近 7 天使用與錯誤、最近 30 天 AI 生成品質與成本。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
          data-testid="button-refresh-platform-summary"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">健康分數</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold">{healthScore}</p>
          <Progress value={healthScore} className="mt-3 h-2" />
        </div>
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">使用事件</p>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-bold">{formatNumber(totalEvents)}</p>
          <p className="mt-1 text-xs text-muted-foreground">前台自動紀錄頁面與重要操作</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">錯誤紀錄</p>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-bold">{formatNumber(totalErrors)}</p>
          <p className="mt-1 text-xs text-muted-foreground">含 5xx 與前端例外</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">AI 品質</p>
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-bold">{weightedQuality || '-'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(totalAiRuns)} 次生成，成本單位 {formatNumber(aiCostUnits)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border bg-background p-4">
          <p className="text-sm font-semibold">熱門操作</p>
          <div className="mt-3 space-y-2">
            {events.slice(0, 5).map((row) => (
              <div key={row.event_name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{row.event_name}</span>
                <span className="font-semibold">{formatNumber(row.count)}</span>
              </div>
            ))}
            {events.length === 0 ? <p className="text-sm text-muted-foreground">還沒有使用事件。</p> : null}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <p className="text-sm font-semibold">近期錯誤</p>
          <div className="mt-3 space-y-2">
            {errors.slice(0, 5).map((row) => (
              <div key={`${row.source}-${row.status_code}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{row.source} / {row.status_code || 'client'}</span>
                <span className="font-semibold">{formatNumber(row.count)}</span>
              </div>
            ))}
            {errors.length === 0 ? <p className="text-sm text-muted-foreground">目前沒有錯誤紀錄。</p> : null}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <p className="text-sm font-semibold">AI 生成表現</p>
          <div className="mt-3 space-y-2">
            {aiUsage.slice(0, 5).map((row) => (
              <div key={`${row.feature}-${row.model}-${row.status}`} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{row.feature}</span>
                  <Badge variant={row.status === 'COMPLETED' ? 'secondary' : 'destructive'}>{row.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.model} ・ {formatNumber(row.count)} 次 ・ 品質 {row.avg_quality || '-'} ・ 成本 {formatNumber(row.cost_units)}
                </p>
              </div>
            ))}
            {aiUsage.length === 0 ? <p className="text-sm text-muted-foreground">還沒有 AI 生成紀錄。</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
};
