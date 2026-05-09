import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useSession } from '@/contexts/SessionContext';
import { useStudyResponse } from '@/hooks/useStudyResponse';
import type { InsightCategory } from '@/types/spiritual-fitness';
import { Eye, Heart, Target, Cloud, Loader2, Check, Sparkles } from 'lucide-react';

interface SpiritualFitnessFormProps {
  onComplete?: () => void;
  onSubmitted?: () => void;
}

const RECEIVE_KEY: InsightCategory = 'GOD_ATTRIBUTE';

export const SpiritualFitnessForm: React.FC<SpiritualFitnessFormProps> = ({ onComplete, onSubmitted }) => {
  const handleComplete = onComplete || onSubmitted;
  const { currentUser, currentSession } = useSession();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    formData,
    isLoading,
    isSaving,
    isDirty,
    updateField,
    saveNow,
  } = useStudyResponse({
    sessionId: currentSession?.id,
    userId: currentUser?.id,
    userEmail: currentUser?.email,
    enabled: !!currentSession?.id && !!currentUser?.id,
  });

  const receivingValue = React.useMemo(() => {
    return formData.core_insight_note[RECEIVE_KEY] || Object.values(formData.core_insight_note).filter(Boolean).join('\n');
  }, [formData.core_insight_note]);

  const handleReceivingChange = React.useCallback((value: string) => {
    if (formData.core_insight_category.length !== 1 || formData.core_insight_category[0] !== RECEIVE_KEY) {
      updateField('core_insight_category', [RECEIVE_KEY]);
    }
    updateField('core_insight_note', { [RECEIVE_KEY]: value });
  }, [formData.core_insight_category, updateField]);

  const handleSubmit = React.useCallback(async () => {
    if (!handleComplete) return;

    setIsSubmitting(true);
    try {
      if (isDirty) {
        await saveNow();
      }
      handleComplete();
    } catch (error) {
      console.error('[SpiritualFitnessForm] Error during submission:', error);
      handleComplete();
    } finally {
      setIsSubmitting(false);
    }
  }, [handleComplete, isDirty, saveNow]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const completedFields = [
    formData.observation.trim(),
    receivingValue.trim(),
    formData.action_plan.trim(),
  ].filter(Boolean).length;
  const progressPercent = Math.round((completedFields / 3) * 100);

  return (
    <div className="w-full max-w-2xl lg:max-w-3xl mx-auto animate-fade-in space-y-3 sm:space-y-4 md:space-y-6 pb-24 md:pb-8">
      <Card variant="highlight">
        <CardContent className="py-3 px-3 sm:px-4 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 text-sm flex-1 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">小組</p>
                <p className="font-bold text-sm sm:text-base md:text-xl text-primary">#{currentUser?.groupNumber}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">姓名</p>
                <p className="font-medium text-xs sm:text-sm md:text-base truncate">{currentUser?.name}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">經文</p>
                <p className="font-serif font-medium text-xs sm:text-sm md:text-base truncate">{currentSession?.verseReference}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground shrink-0">
              <Cloud className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSaving ? 'animate-pulse text-secondary' : 'text-green-500'}`} />
              <span className="hidden xs:inline sm:inline">{isSaving ? '存...' : '已存'}</span>
            </div>
          </div>

          <div className="mt-2 sm:mt-3">
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-1">
              <span>三步驟進度</span>
              <span>{completedFields}/3 ({progressPercent}%)</span>
            </div>
            <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10 overflow-hidden">
        <CardHeader className="py-3 px-3 sm:px-4 md:px-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-emerald-700 dark:text-emerald-400">
            <Eye className="w-5 h-5 shrink-0" />
            1. 看見
            {formData.observation && <Check className="w-4 h-4 text-green-500" />}
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">這段經文中，我觀察到什麼？</p>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-4">
          <Label htmlFor="observation" className="sr-only">看見</Label>
          <AutoResizeTextarea
            id="observation"
            value={formData.observation}
            onChange={(e) => updateField('observation', e.target.value)}
            onBlur={saveNow}
            placeholder="例如：我看到耶穌如何回應人、人物的反應、重複出現的詞、讓我注意的細節..."
            minRows={5}
            maxRows={10}
            className="text-base md:text-sm"
          />
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-sky-500 bg-sky-50/10 dark:bg-sky-950/10 overflow-hidden">
        <CardHeader className="py-3 px-3 sm:px-4 md:px-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-sky-700 dark:text-sky-400">
            <Heart className="w-5 h-5 shrink-0" />
            2. 領受
            {receivingValue && <Check className="w-4 h-4 text-green-500" />}
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">神透過這段經文對我說什麼？</p>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-4">
          <Label htmlFor="receiving" className="sr-only">領受</Label>
          <AutoResizeTextarea
            id="receiving"
            value={receivingValue}
            onChange={(e) => handleReceivingChange(e.target.value)}
            onBlur={saveNow}
            placeholder="例如：我對神有什麼新的認識？哪句話觸動我？我被提醒、安慰、責備或鼓勵的是什麼？"
            minRows={5}
            maxRows={10}
            className="text-base md:text-sm"
          />
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500 bg-amber-50/10 dark:bg-amber-950/10 overflow-hidden">
        <CardHeader className="py-3 px-3 sm:px-4 md:px-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-amber-700 dark:text-amber-400">
            <Target className="w-5 h-5 shrink-0" />
            3. 回應
            {formData.action_plan && <Check className="w-4 h-4 text-green-500" />}
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">我接下來要怎麼實踐？</p>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-4">
          <Label htmlFor="action_plan" className="sr-only">回應</Label>
          <AutoResizeTextarea
            id="action_plan"
            value={formData.action_plan}
            onChange={(e) => updateField('action_plan', e.target.value)}
            onBlur={saveNow}
            placeholder="例如：這週我要採取的一個具體行動、我要和誰談、我要如何禱告或調整生活..."
            minRows={5}
            maxRows={10}
            className="text-base md:text-sm"
          />
        </CardContent>
      </Card>

      {handleComplete && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-sm border-t shadow-lg md:static md:p-0 md:bg-transparent md:border-0 md:shadow-none md:pt-4 z-50">
          <Button
            type="button"
            variant="gold"
            size="lg"
            className="w-full text-sm sm:text-base py-3 sm:py-4 md:max-w-xs md:mx-auto md:flex touch-manipulation active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={isSubmitting || isSaving}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                儲存中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                完成查經
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
