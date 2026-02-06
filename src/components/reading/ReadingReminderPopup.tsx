import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScriptureTTS } from '@/components/scripture/ScriptureTTS';
import { BookOpen, Volume2, ArrowRight, Bell, X } from 'lucide-react';

interface TodayReadingSummary {
  planId: string;
  planName: string;
  dayNumber: number;
  totalDays: number;
  completedDays: number;
  isCompleted: boolean;
  scriptureReference: string;
  previewVerses: Array<{ verse: number; text: string }>;
  todayCompleted: boolean;
}

interface ReadingReminderPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: TodayReadingSummary | null;
  timeSlot?: string;
}

const TIME_SLOT_GREETINGS: Record<string, string> = {
  morning: '早安',
  noon: '午安',
  evening: '晚安',
};

export function ReadingReminderPopup({ open, onOpenChange, summary, timeSlot = 'morning' }: ReadingReminderPopupProps) {
  const navigate = useNavigate();
  const [showTts, setShowTts] = useState(false);
  const greeting = TIME_SLOT_GREETINGS[timeSlot] || '嗨';

  const ttsText = summary?.previewVerses?.map(v => v.text).join(' ') || '';

  const handleGoToReading = () => {
    onOpenChange(false);
    if (summary?.planId) {
      navigate(`/learn/reading-plans/${summary.planId}/read`);
    } else {
      navigate('/learn/reading-plans');
    }
  };

  const handlePlayTts = () => {
    setShowTts(true);
  };

  useEffect(() => {
    if (!open) {
      setShowTts(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5 text-primary" />
            {greeting}！該靈修了
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {summary ? (
            <>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{summary.planName}</span>
                </div>
                {summary.scriptureReference && (
                  <p className="text-xs text-primary/80">
                    今日進度：{summary.scriptureReference}
                  </p>
                )}
                {summary.previewVerses.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {summary.previewVerses.slice(0, 2).map((v, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-primary/60 mr-1">{v.verse}</span>
                        {v.text}
                      </p>
                    ))}
                    {summary.previewVerses.length > 2 && (
                      <p className="text-[10px] text-muted-foreground/60 italic">......</p>
                    )}
                  </div>
                )}
                <div className="mt-2">
                  <Progress
                    value={summary.totalDays > 0 ? (summary.completedDays / summary.totalDays) * 100 : 0}
                    className="h-1.5"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    第{summary.dayNumber}天 / 共{summary.totalDays}天（已完成 {summary.completedDays} 天）
                  </p>
                </div>
              </div>

              {showTts && ttsText && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <ScriptureTTS text={ttsText} compact label="正在朗讀..." />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full gap-2"
                  onClick={handlePlayTts}
                  disabled={!ttsText || showTts}
                  data-testid="button-reminder-tts"
                >
                  <Volume2 className="w-4 h-4" />
                  朗讀經文
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGoToReading}
                  data-testid="button-reminder-go-read"
                >
                  <ArrowRight className="w-4 h-4" />
                  進入閱讀頁面
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                今天的靈修等著你！
              </p>
              <Button
                className="gap-2"
                onClick={handleGoToReading}
                data-testid="button-reminder-go-plans"
              >
                <BookOpen className="w-4 h-4" />
                開始讀經
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useReminderSimulation() {
  const [showReminder, setShowReminder] = useState(false);
  const [reminderTimeSlot, setReminderTimeSlot] = useState('morning');
  const [summary, setSummary] = useState<TodayReadingSummary | null>(null);

  const triggerReminder = useCallback(async (timeSlot: string = 'morning') => {
    setReminderTimeSlot(timeSlot);
    try {
      const res = await fetch('/api/user-reading-plans/today-summary', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        setSummary(null);
      }
    } catch {
      setSummary(null);
    }
    setShowReminder(true);
  }, []);

  return {
    showReminder,
    setShowReminder,
    reminderTimeSlot,
    summary,
    triggerReminder,
  };
}
