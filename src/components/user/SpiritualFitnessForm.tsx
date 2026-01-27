import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useSession } from '@/contexts/SessionContext';
import { useStudyResponse } from '@/hooks/useStudyResponse';
import { INSIGHT_CATEGORIES } from '@/types/spiritual-fitness';
import { 
  Dumbbell, 
  Eye, 
  Heart, 
  Film, 
  BookOpen, 
  Sparkles, 
  Target, 
  MessageSquare,
  Cloud,
  Loader2,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpiritualFitnessFormProps {
  onComplete?: () => void;
  onSubmitted?: () => void;
}

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

  // Handle completion with save verification
  const handleSubmit = React.useCallback(async () => {
    if (!handleComplete) return;
    
    setIsSubmitting(true);
    
    // Save any pending changes first
    if (isDirty) {
      saveNow();
      // Wait a moment for the save to complete
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    setIsSubmitting(false);
    handleComplete();
  }, [handleComplete, isDirty, saveNow]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate progress
  const filledFields = [
    formData.title_phrase,
    formData.heartbeat_verse,
    formData.observation,
    formData.core_insight_category,
    formData.core_insight_note,
    formData.scholars_note,
    formData.action_plan,
    formData.cool_down_note,
  ].filter(Boolean).length;
  const totalFields = 8;
  const progressPercent = Math.round((filledFields / totalFields) * 100);

  return (
    <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto animate-fade-in space-y-3 sm:space-y-4 md:space-y-6 pb-24 md:pb-8">
      {/* Session info card - compact on mobile */}
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
            {/* Save status - compact */}
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground shrink-0">
              {isSaving ? (
                <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse text-secondary" />
              ) : (
                <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
              )}
              <span className="hidden xs:inline sm:inline">{isSaving ? '存...' : '已存'}</span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-2 sm:mt-3">
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-1">
              <span>進度 Progress</span>
              <span>{filledFields}/{totalFields} ({progressPercent}%)</span>
            </div>
            <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase 1: Warm-up (Green) */}
      <Card className="border-l-4 border-l-green-500 bg-green-50/10 dark:bg-green-950/10 overflow-hidden">
        <CardHeader className="py-3 px-3 sm:px-4 md:px-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg text-green-700 dark:text-green-400">
            <Eye className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">🟢 暖身 Warm-up</span>
          </CardTitle>
          <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">看一看、摸一摸</p>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-4 space-y-3 sm:space-y-4">
          {/* 1. 定標題 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="title_phrase" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 shrink-0" />
              <span>1. 定標題</span>
              {formData.title_phrase && <Check className="w-3 h-3 text-green-500" />}
            </Label>
            <Input
              id="title_phrase"
              value={formData.title_phrase}
              onChange={(e) => updateField('title_phrase', e.target.value)}
              onBlur={saveNow}
              placeholder="幫這段經文取個有趣的片名..."
              className="text-sm sm:text-base h-10 sm:h-11"
            />
          </div>

          {/* 2. 抓心跳 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="heartbeat_verse" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 shrink-0" />
              <span>2. 抓心跳</span>
              {formData.heartbeat_verse && <Check className="w-3 h-3 text-green-500" />}
            </Label>
            <AutoResizeTextarea
              id="heartbeat_verse"
              value={formData.heartbeat_verse}
              onChange={(e) => updateField('heartbeat_verse', e.target.value)}
              onBlur={saveNow}
              placeholder="哪一句話讓你心跳加速？"
              minRows={2}
              maxRows={5}
              className="text-sm sm:text-base"
            />
          </div>

          {/* 3. 看現場 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="observation" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 shrink-0" />
              <span>3. 看現場</span>
              {formData.observation && <Check className="w-3 h-3 text-green-500" />}
            </Label>
            <AutoResizeTextarea
              id="observation"
              value={formData.observation}
              onChange={(e) => updateField('observation', e.target.value)}
              onBlur={saveNow}
              placeholder="看到了什麼人事物？純觀察..."
              minRows={2}
              maxRows={5}
              className="text-sm sm:text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Phase 2: Core Training (Yellow) */}
      <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/10 overflow-hidden">
        <CardHeader className="py-3 px-3 sm:px-4 md:px-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg text-yellow-700 dark:text-yellow-400">
            <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">🟡 重訓 Core Training</span>
          </CardTitle>
          <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">舉重量、查筆記</p>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-4 space-y-3 sm:space-y-4">
          {/* 4. 練核心 */}
          <div className="space-y-2 sm:space-y-3">
            <Label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 shrink-0" />
              <span>4. 練核心</span>
              {formData.core_insight_category && formData.core_insight_note && <Check className="w-3 h-3 text-green-500" />}
            </Label>
            
            {/* Category selector - responsive grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
              {INSIGHT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => updateField('core_insight_category', cat.value)}
                  className={cn(
                    "px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                    "border-2 flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5",
                    "active:scale-95 touch-manipulation",
                    formData.core_insight_category === cat.value
                      ? "border-yellow-500 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 shadow-sm"
                      : "border-muted bg-background hover:border-yellow-300 hover:bg-yellow-50/50 dark:hover:bg-yellow-950/30"
                  )}
                >
                  <span className="text-base sm:text-lg">{cat.emoji}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>

            <AutoResizeTextarea
              id="core_insight_note"
              value={formData.core_insight_note}
              onChange={(e) => updateField('core_insight_note', e.target.value)}
              onBlur={saveNow}
              placeholder={
                formData.core_insight_category 
                  ? `從這段經文中，${INSIGHT_CATEGORIES.find(c => c.value === formData.core_insight_category)?.label}是什麼？`
                  : "先選一個類別，再寫下你的發現..."
              }
              minRows={3}
              maxRows={8}
              className="text-sm sm:text-base"
            />
          </div>

          {/* 5. 學長姐的話 (Open Book) */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="scholars_note" className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 shrink-0" />
              <span>5. 學長姐的話</span>
              <span className="text-[10px] sm:text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                📱 Open Book
              </span>
              {formData.scholars_note && <Check className="w-3 h-3 text-green-500" />}
            </Label>
            <AutoResizeTextarea
              id="scholars_note"
              value={formData.scholars_note}
              onChange={(e) => updateField('scholars_note', e.target.value)}
              onBlur={saveNow}
              placeholder="歷代學長姐或注釋書怎麼說？可以查 Google/AI"
              minRows={3}
              maxRows={8}
              className="text-sm sm:text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Phase 3: Stretch (Blue) */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-950/10 overflow-hidden">
        <CardHeader className="py-3 px-3 sm:px-4 md:px-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg text-blue-700 dark:text-blue-400">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">🔵 伸展 Stretch</span>
          </CardTitle>
          <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">帶一招、聊一聊</p>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-4 space-y-3 sm:space-y-4">
          {/* 6. 帶一招 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="action_plan" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
              <span>6. 帶一招</span>
              {formData.action_plan && <Check className="w-3 h-3 text-green-500" />}
            </Label>
            <AutoResizeTextarea
              id="action_plan"
              value={formData.action_plan}
              onChange={(e) => updateField('action_plan', e.target.value)}
              onBlur={saveNow}
              placeholder="本週具體可行的一個小練習..."
              minRows={2}
              maxRows={5}
              className="text-sm sm:text-base"
            />
          </div>

          {/* 7. 自由發揮 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="cool_down_note" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
              <span>7. 自由發揮</span>
              {formData.cool_down_note && <Check className="w-3 h-3 text-green-500" />}
            </Label>
            <AutoResizeTextarea
              id="cool_down_note"
              value={formData.cool_down_note}
              onChange={(e) => updateField('cool_down_note', e.target.value)}
              onBlur={saveNow}
              placeholder="剛剛沒講完的感動、代禱或閒聊..."
              minRows={2}
              maxRows={5}
              className="text-sm sm:text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Fixed bottom button on mobile */}
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
                完成健身 Complete
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};