import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Bot, CheckCircle2, HeartHandshake, LineChart, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';

type ProductRecommendation = {
  priority: 'high' | 'medium' | 'low';
  area: string;
  title: string;
  reason: string;
  nextStep: string;
};

type ProductGrowthBrief = {
  productScore: number;
  status: 'strong' | 'watch' | 'needs_work';
  marketSignals: string[];
  recommendations: ProductRecommendation[];
  metrics: {
    soulgym: {
      sessions_30d: number;
      participants_30d: number;
      study_completion_rate: number;
      avg_participants_per_session: number;
    };
    wholeApp: {
      engagement_actions_30d: number;
      prayers_30d: number;
      devotional_notes_30d: number;
      saved_verses_30d: number;
      reading_plans_30d: number;
    };
    ai: {
      ai_runs_30d: number;
      ai_failure_rate: number;
      avg_quality_30d: number;
      cost_units_30d: number;
    };
    reliability: {
      errors_7d: number;
      reliability_score: number;
    };
    scores: {
      activation: number;
      engagement: number;
      ai: number;
      reliability: number;
    };
  };
};

const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString();

const priorityTone: Record<ProductRecommendation['priority'], string> = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-blue-200 bg-blue-50 text-blue-700',
};

const priorityLabel: Record<ProductRecommendation['priority'], string> = {
  high: '優先',
  medium: '觀察',
  low: '策略',
};

export const ProductGrowthPanel = () => {
  const { data, isLoading, isFetching, refetch } = useQuery<ProductGrowthBrief>({
    queryKey: ['/api/admin/product-growth-brief'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/product-growth-brief');
      return response.json();
    },
    refetchInterval: 180000,
  });

  if (isLoading) {
    return (
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <Skeleton className="h-7 w-48" />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!data) return null;

  const scoreCards = [
    {
      label: 'SoulGym 啟動',
      value: data.metrics.scores.activation,
      detail: `${formatNumber(data.metrics.soulgym.participants_30d)} 人 / 完成率 ${data.metrics.soulgym.study_completion_rate}%`,
      icon: Smartphone,
      tone: 'text-blue-600',
    },
    {
      label: '週間互動',
      value: data.metrics.scores.engagement,
      detail: `${formatNumber(data.metrics.wholeApp.engagement_actions_30d)} 個讀經、禱告、筆記動作`,
      icon: HeartHandshake,
      tone: 'text-emerald-600',
    },
    {
      label: 'AI 成果力',
      value: data.metrics.scores.ai,
      detail: `${formatNumber(data.metrics.ai.ai_runs_30d)} 次生成 / 品質 ${data.metrics.ai.avg_quality_30d || '-'}`,
      icon: Bot,
      tone: 'text-primary',
    },
    {
      label: '可靠度',
      value: data.metrics.scores.reliability,
      detail: `近 7 天錯誤 ${formatNumber(data.metrics.reliability.errors_7d)}`,
      icon: ShieldCheck,
      tone: 'text-teal-600',
    },
  ];

  const statusText = data.status === 'strong' ? '成長狀態佳' : data.status === 'watch' ? '可再推進' : '需要補強';
  const statusTone = data.status === 'strong'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : data.status === 'watch'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-red-100 text-red-800 border-red-200';

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">產品成長雷達</h3>
            <Badge variant="outline" className={statusTone}>{statusText}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            以教會實際採用需求來看：手機要好進、領袖要省時間、AI 要產出成果、聚會後要能延伸。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
          data-testid="button-refresh-product-growth"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
          <p className="text-sm font-medium text-muted-foreground">整體產品分數</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold leading-none">{data.productScore}</span>
            <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
          </div>
          <Progress value={data.productScore} className="mt-4 h-2" />
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            分數綜合 SoulGym 啟動、週間互動、AI 品質與穩定度。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {scoreCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <Icon className={`h-4 w-4 ${card.tone}`} />
                </div>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
                <Progress value={card.value} className="mt-3 h-1.5" />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">下一步產品決策</p>
          </div>
          <div className="mt-3 space-y-3">
            {data.recommendations.map((item) => (
              <div key={`${item.area}-${item.title}`} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={priorityTone[item.priority]}>{priorityLabel[item.priority]}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">{item.area}</span>
                </div>
                <p className="mt-2 text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5">
                  {item.nextStep}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold">市場需求對照</p>
          </div>
          <div className="mt-3 space-y-2">
            {data.marketSignals.map((signal) => (
              <div key={signal} className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                {signal}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-semibold">{formatNumber(data.metrics.soulgym.sessions_30d)}</p>
              <p className="mt-1 text-xs text-muted-foreground">30 天 SoulGym 場次</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">{formatNumber(data.metrics.soulgym.avg_participants_per_session)}</p>
              <p className="mt-1 text-xs text-muted-foreground">平均每場人數</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">{formatNumber(data.metrics.ai.cost_units_30d)}</p>
              <p className="mt-1 text-xs text-muted-foreground">AI 成本單位</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">{data.metrics.ai.ai_failure_rate}%</p>
              <p className="mt-1 text-xs text-muted-foreground">AI 失敗率</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
