import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Eye,
  Heart,
  Film,
  Dumbbell,
  Target,
  BookOpen,
  Sparkles,
  MessageSquare,
  Loader2,
  Check,
  BookMarked,
  Star,
  Megaphone,
  ShieldAlert,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { INSIGHT_CATEGORIES } from '@/types/spiritual-fitness';
import type { InsightCategory } from '@/types/spiritual-fitness';

const CATEGORY_ICONS: Record<string, typeof Star> = {
  PROMISE: Star,
  COMMAND: Megaphone,
  WARNING: ShieldAlert,
  GOD_ATTRIBUTE: Crown,
};

interface DevotionalNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verseReference: string;
  verseText: string;
  noteId?: string;
}

interface FormFields {
  titlePhrase: string;
  heartbeatVerse: string;
  observation: string;
  coreInsightCategory: InsightCategory | null;
  coreInsightNote: string;
  scholarsNote: string;
  actionPlan: string;
  coolDownNote: string;
}

const emptyForm: FormFields = {
  titlePhrase: '',
  heartbeatVerse: '',
  observation: '',
  coreInsightCategory: null,
  coreInsightNote: '',
  scholarsNote: '',
  actionPlan: '',
  coolDownNote: '',
};

export function DevotionalNoteDialog({
  open,
  onOpenChange,
  verseReference,
  verseText,
  noteId,
}: DevotionalNoteDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [displayReference, setDisplayReference] = useState(verseReference);
  const [displayText, setDisplayText] = useState(verseText);

  const updateField = useCallback(<K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    setDisplayReference(verseReference);
    setDisplayText(verseText);
  }, [verseReference, verseText]);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setExistingId(null);
      return;
    }

    if (!verseReference && !noteId) return;

    let cancelled = false;
    setIsLoading(true);

    const url = noteId
      ? `/api/devotional-notes/${noteId}`
      : `/api/devotional-notes/by-reference?ref=${encodeURIComponent(verseReference)}`;

    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setExistingId(data.id);
        if (data.verseReference) setDisplayReference(data.verseReference);
        if (data.verseText) setDisplayText(data.verseText);
        setForm({
          titlePhrase: data.titlePhrase ?? '',
          heartbeatVerse: data.heartbeatVerse ?? '',
          observation: data.observation ?? '',
          coreInsightCategory: data.coreInsightCategory ?? null,
          coreInsightNote: data.coreInsightNote ?? '',
          scholarsNote: data.scholarsNote ?? '',
          actionPlan: data.actionPlan ?? '',
          coolDownNote: data.coolDownNote ?? '',
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, verseReference, noteId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (existingId) {
        await apiRequest('PATCH', `/api/devotional-notes/${existingId}`, form);
      } else {
        await apiRequest('POST', '/api/devotional-notes', {
          verseReference: displayReference,
          verseText: displayText,
          ...form,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/devotional-notes'] });
      toast({ title: '已儲存', description: '靈修筆記已成功儲存' });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '儲存失敗';
      toast({ title: '儲存失敗', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!existingId) {
      toast({ title: '請先儲存', description: '請先儲存靈修筆記後再進行 AI 分析', variant: 'destructive' });
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await apiRequest('POST', '/api/devotional-notes/analyze', { noteId: existingId });
      const data = await res.json();
      setAnalysisResult(data.analysis);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI 分析失敗';
      toast({ title: '分析失敗', description: message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filledFields = [
    form.titlePhrase,
    form.heartbeatVerse,
    form.observation,
    form.coreInsightCategory,
    form.coreInsightNote,
    form.scholarsNote,
    form.actionPlan,
    form.coolDownNote,
  ].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[500px] sm:max-w-[500px] overflow-y-auto"
        data-testid="devotional-note-sheet"
      >
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <BookMarked className="w-5 h-5 text-primary shrink-0" />
            靈修筆記
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" data-testid="loading-spinner" />
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {/* Verse info */}
            <div className="rounded-md bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">經文</p>
              <p className="font-serif font-semibold text-sm" data-testid="text-verse-reference">
                {displayReference}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4" data-testid="text-verse-text">
                {displayText}
              </p>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>進度</span>
              <span>{filledFields}/8</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden -mt-2">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-blue-500 transition-all duration-300"
                style={{ width: `${Math.round((filledFields / 8) * 100)}%` }}
              />
            </div>

            {/* Phase 1: Warm-up (Green) */}
            <section className="pl-3 border-l-4 border-l-green-500 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                <Eye className="w-4 h-4 shrink-0" />
                暖身 Warm-up
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dn-titlePhrase" className="flex items-center gap-1.5 text-xs font-medium">
                  <Film className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  1. 定標題
                  {form.titlePhrase && <Check className="w-3 h-3 text-green-500" />}
                </Label>
                <Input
                  id="dn-titlePhrase"
                  data-testid="input-title-phrase"
                  value={form.titlePhrase}
                  onChange={(e) => updateField('titlePhrase', e.target.value)}
                  placeholder="幫這段經文下一個標題"
                  className="text-base md:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dn-heartbeatVerse" className="flex items-center gap-1.5 text-xs font-medium">
                  <Heart className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  2. 心跳的時刻
                  {form.heartbeatVerse && <Check className="w-3 h-3 text-green-500" />}
                </Label>
                <AutoResizeTextarea
                  id="dn-heartbeatVerse"
                  data-testid="textarea-heartbeat-verse"
                  value={form.heartbeatVerse}
                  onChange={(e) => updateField('heartbeatVerse', e.target.value)}
                  placeholder="哪一句話讓你感動"
                  minRows={2}
                  maxRows={5}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dn-observation" className="flex items-center gap-1.5 text-xs font-medium">
                  <Eye className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  3. 查看聖經的資訊
                  {form.observation && <Check className="w-3 h-3 text-green-500" />}
                </Label>
                <AutoResizeTextarea
                  id="dn-observation"
                  data-testid="textarea-observation"
                  value={form.observation}
                  onChange={(e) => updateField('observation', e.target.value)}
                  placeholder="有什麼人事時地物或有趣的事"
                  minRows={2}
                  maxRows={5}
                />
              </div>
            </section>

            {/* Phase 2: Core Training (Yellow) */}
            <section className="pl-3 border-l-4 border-l-yellow-500 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                <Dumbbell className="w-4 h-4 shrink-0" />
                重訓 Core Training
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <Target className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  4. 思想神的話
                  {form.coreInsightCategory && form.coreInsightNote && <Check className="w-3 h-3 text-green-500" />}
                </Label>

                <div className="grid grid-cols-2 gap-1.5">
                  {INSIGHT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      data-testid={`button-category-${cat.value}`}
                      onClick={() => updateField('coreInsightCategory', cat.value)}
                      className={cn(
                        'px-2 py-2 rounded-lg text-xs font-medium transition-all',
                        'border-2 flex items-center justify-center gap-1',
                        'active:scale-95 touch-manipulation',
                        form.coreInsightCategory === cat.value
                          ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 shadow-sm'
                          : 'border-muted bg-background hover:border-yellow-300 hover:bg-yellow-50/50 dark:hover:bg-yellow-950/30'
                      )}
                    >
                      {(() => {
                        const IconComp = CATEGORY_ICONS[cat.value];
                        return IconComp ? <IconComp className="w-3.5 h-3.5 shrink-0" /> : null;
                      })()}
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>

                <AutoResizeTextarea
                  id="dn-coreInsightNote"
                  data-testid="textarea-core-insight-note"
                  value={form.coreInsightNote}
                  onChange={(e) => updateField('coreInsightNote', e.target.value)}
                  placeholder={
                    form.coreInsightCategory
                      ? `從這段經文中，${INSIGHT_CATEGORIES.find((c) => c.value === form.coreInsightCategory)?.label}是什麼？`
                      : '先選一個類別，再寫下你的發現...'
                  }
                  minRows={2}
                  maxRows={6}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dn-scholarsNote" className="flex items-center gap-1.5 text-xs font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  5. 學長姐的話
                  {form.scholarsNote && <Check className="w-3 h-3 text-green-500" />}
                </Label>
                <AutoResizeTextarea
                  id="dn-scholarsNote"
                  data-testid="textarea-scholars-note"
                  value={form.scholarsNote}
                  onChange={(e) => updateField('scholarsNote', e.target.value)}
                  placeholder="查看相關資料或註釋"
                  minRows={2}
                  maxRows={5}
                />
              </div>
            </section>

            {/* Phase 3: Stretch (Blue) */}
            <section className="pl-3 border-l-4 border-l-blue-500 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                <Sparkles className="w-4 h-4 shrink-0" />
                伸展 Stretch
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dn-actionPlan" className="flex items-center gap-1.5 text-xs font-medium">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  6. 我決定要這樣做
                  {form.actionPlan && <Check className="w-3 h-3 text-green-500" />}
                </Label>
                <AutoResizeTextarea
                  id="dn-actionPlan"
                  data-testid="textarea-action-plan"
                  value={form.actionPlan}
                  onChange={(e) => updateField('actionPlan', e.target.value)}
                  placeholder="具體的行動計畫"
                  minRows={2}
                  maxRows={5}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dn-coolDownNote" className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  7. 自由發揮
                  {form.coolDownNote && <Check className="w-3 h-3 text-green-500" />}
                </Label>
                <AutoResizeTextarea
                  id="dn-coolDownNote"
                  data-testid="textarea-cool-down-note"
                  value={form.coolDownNote}
                  onChange={(e) => updateField('coolDownNote', e.target.value)}
                  placeholder="禱告、感想、或任何想寫的..."
                  minRows={2}
                  maxRows={5}
                />
              </div>
            </section>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
              data-testid="button-save-devotional-note"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  儲存中...
                </>
              ) : (
                '儲存'
              )}
            </Button>

            {existingId && (
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                variant="outline"
                className="w-full"
                data-testid="button-analyze-devotional-note"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    AI 分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI 整理分析
                  </>
                )}
              </Button>
            )}

            {analysisResult && (
              <div className="rounded-md bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="w-4 h-4" />
                  AI 分析結果
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap" data-testid="text-analysis-result">
                  {analysisResult}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
