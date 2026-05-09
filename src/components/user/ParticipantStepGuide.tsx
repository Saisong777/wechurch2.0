import { BookOpen, CheckCircle2, ClipboardCheck, LogIn, MessageCircle, PenLine, UserCheck, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ParticipantFlowStep =
  | 'enter-session'
  | 'join'
  | 'waiting'
  | 'group-reveal'
  | 'verification'
  | 'icebreaker'
  | 'study'
  | 'review';

interface ParticipantStepGuideProps {
  currentStep: ParticipantFlowStep;
  icebreakerEnabled?: boolean;
  className?: string;
}

const allSteps = [
  {
    id: 'enter-session',
    title: '輸入代碼',
    next: '拿到代碼就能加入',
    icon: LogIn,
  },
  {
    id: 'join',
    title: '留下資料',
    next: '讓小組認得你',
    icon: PenLine,
  },
  {
    id: 'waiting',
    title: '等待分組',
    next: '人到齊後自動前進',
    icon: Users,
  },
  {
    id: 'group-reveal',
    title: '查看組別',
    next: '找到你的組員',
    icon: UserCheck,
  },
  {
    id: 'verification',
    title: '確認到齊',
    next: '大家完成自我介紹',
    icon: ClipboardCheck,
  },
  {
    id: 'icebreaker',
    title: '抽卡分享',
    next: '跟著卡片聊一輪',
    icon: MessageCircle,
  },
  {
    id: 'study',
    title: '三步驟查經',
    next: '觀察、領受、行動',
    icon: BookOpen,
  },
  {
    id: 'review',
    title: '完成整理',
    next: '可回頭修改或送出',
    icon: CheckCircle2,
  },
] as const;

export const ParticipantStepGuide = ({
  currentStep,
  icebreakerEnabled = true,
  className,
}: ParticipantStepGuideProps) => {
  const steps = icebreakerEnabled ? allSteps : allSteps.filter((step) => step.id !== 'icebreaker');
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const activeStep = steps[currentIndex] ?? steps[0];
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;

  return (
    <Card className={cn('mb-4 border-primary/10 bg-primary/5 shadow-sm', className)}>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">現在進度</p>
            <p className="truncate text-base font-semibold text-foreground">{activeStep.title}</p>
          </div>
          {nextStep && (
            <div className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              下一步：{nextStep.title}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isDone = currentIndex > index;
            const isCurrent = currentIndex === index;

            return (
              <div
                key={step.id}
                className={cn(
                  'rounded-xl border bg-background p-2 text-center transition-colors',
                  isDone && 'border-primary/20 bg-primary/10',
                  isCurrent && 'border-primary shadow-sm ring-2 ring-primary/15'
                )}
              >
                <div
                  className={cn(
                    'mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground',
                    isDone && 'bg-primary/15 text-primary',
                    isCurrent && 'bg-primary text-primary-foreground'
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <p className="text-[11px] font-semibold leading-tight text-foreground">{step.title}</p>
                {isCurrent && (
                  <p className="mt-1 hidden text-[11px] leading-tight text-muted-foreground sm:block">
                    {step.next}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
