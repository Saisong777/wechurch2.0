import { BookOpen, CheckCircle2, MessageCircle, QrCode, Shuffle, Sparkles, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type FlowStepId = 'setup' | 'join' | 'group' | 'share' | 'study' | 'summary';

interface MeetingFlowGuideProps {
  currentStep?: FlowStepId;
  icebreakerEnabled?: boolean;
  className?: string;
}

const flowSteps = [
  {
    id: 'setup',
    title: '開查經',
    hint: '設定經文',
    icon: Sparkles,
  },
  {
    id: 'join',
    title: '邀請加入',
    hint: 'QR 或代碼',
    icon: QrCode,
  },
  {
    id: 'group',
    title: '分組',
    hint: '確認成員',
    icon: Users,
  },
  {
    id: 'share',
    title: '分享活動',
    hint: '抽卡或現場遊戲',
    icon: MessageCircle,
  },
  {
    id: 'study',
    title: '三步驟查經',
    hint: '觀察、領受、行動',
    icon: BookOpen,
  },
  {
    id: 'summary',
    title: '整合成果',
    hint: '小組到大組',
    icon: Shuffle,
  },
] as const;

export const MeetingFlowGuide = ({
  currentStep = 'setup',
  icebreakerEnabled = true,
  className,
}: MeetingFlowGuideProps) => {
  const currentIndex = flowSteps.findIndex((step) => step.id === currentStep);

  return (
    <Card className={cn('border-primary/10 bg-primary/5 shadow-sm', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">聚會模式</p>
            <p className="text-xs text-muted-foreground">
              帶領者照著亮起來的步驟走就可以
            </p>
          </div>
          <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            {icebreakerEnabled ? '含抽卡分享' : '保留現場活動'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isUpcoming = index > currentIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  'rounded-xl border bg-background p-3 transition-colors',
                  isDone && 'border-primary/20 bg-primary/10',
                  isCurrent && 'border-primary bg-background shadow-sm ring-2 ring-primary/15',
                  isUpcoming && 'border-border/70 text-muted-foreground'
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      isDone && 'bg-primary/15 text-primary'
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.hint}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
