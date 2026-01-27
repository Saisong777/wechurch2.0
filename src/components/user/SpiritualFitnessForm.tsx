import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useSession } from '@/contexts/SessionContext';
import { useStudyResponse } from '@/hooks/useStudyResponse';
import { INSIGHT_CATEGORIES, InsightCategory } from '@/types/spiritual-fitness';
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
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpiritualFitnessFormProps {
  onComplete?: () => void;
  onSubmitted?: () => void;
}

export const SpiritualFitnessForm: React.FC<SpiritualFitnessFormProps> = ({ onComplete, onSubmitted }) => {
  const handleComplete = onComplete || onSubmitted;
  const { currentUser, currentSession } = useSession();
  
  const {
    formData,
    isLoading,
    isSaving,
    updateField,
    saveNow,
  } = useStudyResponse({
    sessionId: currentSession?.id,
    userId: currentUser?.id,
    enabled: !!currentSession?.id && !!currentUser?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto animate-fade-in px-1 sm:px-0 space-y-4 md:space-y-6">
      {/* Session info card */}
      <Card variant="highlight" className="mb-2">
        <CardContent className="py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 text-sm flex-1">
              <div>
                <p className="text-xs text-muted-foreground">小組 Group</p>
                <p className="font-bold text-base md:text-xl text-primary">#{currentUser?.groupNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">姓名 Name</p>
                <p className="font-medium text-sm md:text-base truncate">{currentUser?.name}</p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground">經文 Verse</p>
                <p className="font-serif font-medium text-sm md:text-base">{currentSession?.verseReference}</p>
              </div>
            </div>
            {/* Save status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-4">
              {isSaving ? (
                <>
                  <Cloud className="w-4 h-4 animate-pulse text-secondary" />
                  <span className="hidden sm:inline">儲存中...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-green-500" />
                  <span className="hidden sm:inline">已儲存</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase 1: Warm-up (Green) */}
      <Card className="border-l-4 border-l-green-500 bg-green-50/10 dark:bg-green-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-green-700 dark:text-green-400">
            <Eye className="w-5 h-5" />
            Phase 1: 暖身 Warm-up
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">看一看、摸一摸 (Eyes & Heart)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 1. 定標題 */}
          <div className="space-y-2">
            <Label htmlFor="title_phrase" className="flex items-center gap-2 text-sm font-medium">
              <Film className="w-4 h-4 text-green-600" />
              1. 定標題 Title Phrase
            </Label>
            <Input
              id="title_phrase"
              value={formData.title_phrase}
              onChange={(e) => updateField('title_phrase', e.target.value)}
              onBlur={saveNow}
              placeholder="幫這段經文取個有趣的片名..."
              className="text-base"
            />
          </div>

          {/* 2. 抓心跳 */}
          <div className="space-y-2">
            <Label htmlFor="heartbeat_verse" className="flex items-center gap-2 text-sm font-medium">
              <Heart className="w-4 h-4 text-green-600" />
              2. 抓心跳 Heartbeat Verse
            </Label>
            <AutoResizeTextarea
              id="heartbeat_verse"
              value={formData.heartbeat_verse}
              onChange={(e) => updateField('heartbeat_verse', e.target.value)}
              onBlur={saveNow}
              placeholder="哪一句話讓你心跳加速？"
              minRows={2}
              maxRows={6}
              className="text-base"
            />
          </div>

          {/* 3. 看現場 */}
          <div className="space-y-2">
            <Label htmlFor="observation" className="flex items-center gap-2 text-sm font-medium">
              <Eye className="w-4 h-4 text-green-600" />
              3. 看現場 Observation
            </Label>
            <AutoResizeTextarea
              id="observation"
              value={formData.observation}
              onChange={(e) => updateField('observation', e.target.value)}
              onBlur={saveNow}
              placeholder="看到了什麼人事物？純觀察..."
              minRows={2}
              maxRows={6}
              className="text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Phase 2: Core Training (Yellow) */}
      <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-yellow-700 dark:text-yellow-400">
            <Dumbbell className="w-5 h-5" />
            Phase 2: 重訓 Core Training
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">舉重量、查筆記 (Heavy Lifting)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 4. 練核心 */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Target className="w-4 h-4 text-yellow-600" />
              4. 練核心 Core Insight
            </Label>
            
            {/* Category selector tabs */}
            <div className="flex flex-wrap gap-2">
              {INSIGHT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => updateField('core_insight_category', cat.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    "border-2 flex items-center gap-1.5",
                    formData.core_insight_category === cat.value
                      ? "border-yellow-500 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200"
                      : "border-muted bg-background hover:border-yellow-300 hover:bg-yellow-50/50 dark:hover:bg-yellow-950/30"
                  )}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className="text-xs text-muted-foreground">({cat.description})</span>
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
              className="text-base"
            />
          </div>

          {/* 5. 學長姐的話 (Open Book) */}
          <div className="space-y-2">
            <Label htmlFor="scholars_note" className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="w-4 h-4 text-yellow-600" />
              5. 學長姐的話 Scholar's Note
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                📱 Open Book! Google/AI OK
              </span>
            </Label>
            <AutoResizeTextarea
              id="scholars_note"
              value={formData.scholars_note}
              onChange={(e) => updateField('scholars_note', e.target.value)}
              onBlur={saveNow}
              placeholder="歷代學長姐或注釋書怎麼說？"
              minRows={3}
              maxRows={8}
              className="text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Phase 3: Stretch (Blue) */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-blue-700 dark:text-blue-400">
            <Sparkles className="w-5 h-5" />
            Phase 3: 伸展 Stretch
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">帶一招、聊一聊 (Stretch)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 6. 帶一招 */}
          <div className="space-y-2">
            <Label htmlFor="action_plan" className="flex items-center gap-2 text-sm font-medium">
              <Target className="w-4 h-4 text-blue-600" />
              6. 帶一招 Action Plan
            </Label>
            <AutoResizeTextarea
              id="action_plan"
              value={formData.action_plan}
              onChange={(e) => updateField('action_plan', e.target.value)}
              onBlur={saveNow}
              placeholder="本週具體可行的一個小練習..."
              minRows={2}
              maxRows={6}
              className="text-base"
            />
          </div>

          {/* 7. 自由發揮 */}
          <div className="space-y-2">
            <Label htmlFor="cool_down_note" className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              7. 自由發揮 Cool Down
            </Label>
            <AutoResizeTextarea
              id="cool_down_note"
              value={formData.cool_down_note}
              onChange={(e) => updateField('cool_down_note', e.target.value)}
              onBlur={saveNow}
              placeholder="剛剛沒講完的感動、代禱或閒聊..."
              minRows={2}
              maxRows={6}
              className="text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Complete button (optional) */}
      {handleComplete && (
        <div className="pt-4 sticky bottom-0 bg-background pb-4 -mx-1 px-1 md:static md:mx-0 md:px-0 md:pb-0">
          <Button
            type="button"
            variant="gold"
            size="xl"
            className="w-full lg:w-auto lg:min-w-[240px] text-base md:text-lg"
            onClick={handleComplete}
          >
            <Sparkles className="w-5 h-5" />
            完成查經 Complete Study
          </Button>
        </div>
      )}
    </div>
  );
};
