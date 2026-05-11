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
  const ActiveIcon = activeStep.icon;
  const progressValue = currentIndex >= 0 ? ((currentIndex + 1) / steps.length) * 100 : 0;

  return (
    <Card className={cn('mb-3 border-primary/15 bg-primary/5 shadow-sm sm:mb-4', className)}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ActiveIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-primary">現在要做</p>
              <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {currentIndex + 1}/{steps.length}
              </span>
            </div>
            <p className="mt-1 text-lg font-semibold leading-tight text-foreground">{activeStep.title}</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{activeStep.next}</p>
          </div>
          {nextStep && (
            <div className="hidden rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground sm:block">
              下一步 {nextStep.title}
            </div>
          )}
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressValue}%` }}
          />
        </div>

        {nextStep && (
          <div className="mt-3 rounded-xl border border-primary/10 bg-background px-3 py-2 text-sm text-muted-foreground sm:hidden">
            下一步：<span className="font-semibold text-foreground">{nextStep.title}</span>
          </div>
        )}

        <div className="-mx-1 mt-3 hidden overflow-x-auto pb-1 sm:block">
          <div className="flex min-w-max gap-2 px-1">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isDone = currentIndex > index;
            const isCurrent = currentIndex === index;

            return (
              <div
                key={step.id}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'w-24 rounded-xl border bg-background p-2 text-center transition-colors sm:w-28',
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
              </div>
            );
          })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
