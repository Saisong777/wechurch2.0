import React from 'react';
import { BookOpen, Sparkles, Target } from 'lucide-react';
import { GroupReport } from './parse';
import { cn } from '@/lib/utils';

interface ReportTakeawayPanelProps {
  section: GroupReport;
  variant?: 'group' | 'overall';
  className?: string;
}

function cleanLine(value?: string) {
  if (!value) return '';
  return value
    .replace(/\*\*/g, '')
    .replace(/^[-•\s]+/, '')
    .replace(/^帶走重點[：:]\s*/, '')
    .replace(/^群體帶走[：:]\s*/, '')
    .trim();
}

function firstUsefulLine(...values: Array<string | undefined>) {
  for (const value of values) {
    const line = value
      ?.split('\n')
      .map(cleanLine)
      .find((item) => item.length > 0 && !item.includes('資料看板') && !item.includes('資料不足'));
    if (line) return line.length > 86 ? `${line.slice(0, 86)}...` : line;
  }
  return '';
}

export const ReportTakeawayPanel: React.FC<ReportTakeawayPanelProps> = ({
  section,
  variant = section.groupNumber === 0 ? 'overall' : 'group',
  className,
}) => {
  const core = firstUsefulLine(section.summary, section.topic, section.themes);
  const light = firstUsefulLine(section.highlights, section.theology, section.insights);
  const action = firstUsefulLine(section.soulGym, section.applications);

  if (!core && !light && !action) return null;

  const label = variant === 'overall' ? '全體成果先看這裡' : '小組成果先看這裡';
  const items = [
    { label: '核心領受', value: core, icon: BookOpen, tone: 'text-primary bg-primary/10' },
    { label: '最有感亮光', value: light, icon: Sparkles, tone: 'text-secondary bg-secondary/10' },
    { label: '下一步操練', value: action, icon: Target, tone: 'text-emerald-600 bg-emerald-500/10' },
  ].filter((item) => item.value);

  return (
    <div className={cn('rounded-xl border bg-primary/5 p-3 sm:p-4', className)}>
      <p className="mb-3 text-sm font-semibold text-primary">{label}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border bg-background/85 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', item.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-sm font-medium leading-6 text-foreground">{item.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
