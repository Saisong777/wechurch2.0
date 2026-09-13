import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { saveDevotionalNote, noteSaveMessage } from '@/lib/saveDevotionalNote';
import {
  createLocalDevotionalNoteId,
  findLocalDevotionalNoteById,
  findLocalDevotionalNoteByReference,
  type LocalDevotionalNote,
} from '@/lib/localDevotionalNotes';
import {
  Eye,
  Heart,
  Target,
  Sparkles,
  Loader2,
  Check,
  BookMarked,
} from 'lucide-react';
import { parseCategories, parseNotes, serializeCategories, serializeNotes } from '@/types/spiritual-fitness';
import type { InsightCategory } from '@/types/spiritual-fitness';
import { DevotionWallShareDialog } from './DevotionWallShareDialog';
import type { DevotionShareDraft } from '@shared/devotionWall';
import { createDevotionShareDraft } from '@/lib/devotionShareDraft';
import { LeaveConfirmation, UnsavedChangesGuard } from '@/components/layout/UnsavedChangesGuard';
import { DeviceDraft } from '@/components/layout/DeviceDraft';
import { clearDeviceDraft } from '@/lib/deviceDraft';
import { z } from 'zod';
import { NoteConflictReview } from './NoteConflictReview';

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
  coreInsightCategory: InsightCategory[];
  coreInsightNote: Record<string, string>;
  scholarsNote: string;
  actionPlan: string;
  coolDownNote: string;
}

const emptyForm: FormFields = {
  titlePhrase: '',
  heartbeatVerse: '',
  observation: '',
  coreInsightCategory: [],
  coreInsightNote: {},
  scholarsNote: '',
  actionPlan: '',
  coolDownNote: '',
};

const RECEIVE_KEY: InsightCategory = 'GOD_ATTRIBUTE';
const formSchema = z.object({
  titlePhrase:z.string(),heartbeatVerse:z.string(),observation:z.string(),
  coreInsightCategory:z.array(z.enum(['PROMISE','COMMAND','WARNING','GOD_ATTRIBUTE'])),
  coreInsightNote:z.record(z.string()),scholarsNote:z.string(),actionPlan:z.string(),coolDownNote:z.string(),
});

const applyNoteToForm = (
  note: LocalDevotionalNote,
  setExistingId: (id: string) => void,
  setDisplayReference: (reference: string) => void,
  setDisplayText: (text: string) => void,
  setForm: (form: FormFields) => void,
) => {
  setExistingId(note.id);
  if (note.verseReference) setDisplayReference(note.verseReference);
  if (note.verseText) setDisplayText(note.verseText);
  const parsedCategories = parseCategories(note.coreInsightCategory);
  setForm({
    titlePhrase: note.titlePhrase ?? '',
    heartbeatVerse: note.heartbeatVerse ?? '',
    observation: note.observation ?? '',
    coreInsightCategory: parsedCategories,
    coreInsightNote: parseNotes(note.coreInsightNote, parsedCategories),
    scholarsNote: note.scholarsNote ?? '',
    actionPlan: note.actionPlan ?? '',
    coolDownNote: note.coolDownNote ?? '',
  });
};

export function DevotionalNoteDialog({
  open,
  onOpenChange,
  verseReference,
  verseText,
  noteId,
}: DevotionalNoteDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id || '';
  const draftScope = `devotional:${noteId || verseReference}`;
  const discardDraft = () => { try { clearDeviceDraft(userId,draftScope); } catch { /* Keep the current form recoverable. */ } };
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [baseline, setBaseline] = useState<FormFields>(emptyForm);
  const [confirmClose, setConfirmClose] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loadedNote, setLoadedNote] = useState<LocalDevotionalNote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [displayReference, setDisplayReference] = useState(verseReference);
  const [displayText, setDisplayText] = useState(verseText);
  const [shareDraft,setShareDraft] = useState<DevotionShareDraft|null>(null);
  const dirty = open && JSON.stringify(form) !== JSON.stringify(baseline);
  const loadForm = useCallback((value: FormFields) => { setForm(value); setBaseline(value); }, []);
  const requestOpenChange = (next: boolean) => {
    if (!next && isSaving) { toast({ title: '正在儲存，請稍候' }); return; }
    if (!next && dirty) { setConfirmClose(true); return; }
    onOpenChange(next);
  };

  const updateField = useCallback(<K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    setDisplayReference(verseReference);
    setDisplayText(verseText);
  }, [verseReference, verseText]);

  useEffect(() => {
    if (!open || !userId) {
      setForm(emptyForm);
      setBaseline(emptyForm);
      setConfirmClose(false);
      setExistingId(null);
      setLoadedNote(null);
      return;
    }

    if (!verseReference && !noteId) return;

    let cancelled = false;
    setIsLoading(true);
    setForm(emptyForm);
    setBaseline(emptyForm);
    setExistingId(null);
    setLoadedNote(null);

    const url = noteId
      ? `/api/devotional-notes/${noteId}`
      : `/api/devotional-notes/by-reference?ref=${encodeURIComponent(verseReference)}`;

    const localNote = noteId
      ? findLocalDevotionalNoteById(noteId, userId)
      : findLocalDevotionalNoteByReference(verseReference, userId);
    if (localNote) {
      setLoadedNote(localNote);
      applyNoteToForm(localNote, setExistingId, setDisplayReference, setDisplayText, loadForm);
    }
    if (noteId?.startsWith('local-devotional-')) {
      setIsLoading(false);
      return;
    }

    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data || data.userId !== userId || (localNote && localNote.syncStatus !== 'synced')) return;
        setLoadedNote(data);
        applyNoteToForm(data, setExistingId, setDisplayReference, setDisplayText, loadForm);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, verseReference, noteId, userId, loadForm]);

  const handleSave = async (share = false) => {
    if (!userId) {
      toast({ title: '請先登入', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { coreInsightCategory, coreInsightNote, ...rest } = form;
      const payload = {
        ...rest,
        coreInsightCategory: serializeCategories(coreInsightCategory),
        coreInsightNote: serializeNotes(coreInsightNote),
      };

      const now = new Date().toISOString();
      const previous = loadedNote || (existingId ? findLocalDevotionalNoteById(existingId, userId) : null);
      const result = await saveDevotionalNote(userId, {
        ...previous,
        id: existingId || createLocalDevotionalNoteId(),
        verseReference: displayReference,
        verseText: displayText,
        readingPlanId: previous?.readingPlanId || null,
        dayNumber: previous?.dayNumber ?? null,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
        ...payload,
      });
      const savedNote = result.note;
      setBaseline(form);
      setExistingId(savedNote.id);
      setLoadedNote(savedNote);
      queryClient.setQueryData<LocalDevotionalNote[]>(['/api/devotional-notes', userId], (current = []) => [
        savedNote,
        ...current.filter((note) => note.id !== savedNote.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ['/api/devotional-notes'] });
      toast({ title: noteSaveMessage(result.status), variant: result.status === 'blocked' ? 'destructive' : 'default' });
      if (result.status === 'synced') {
        discardDraft();
        if(share)setShareDraft(createDevotionShareDraft(savedNote));
        else onOpenChange(false);
      }
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

  const receivingValue =
    form.coreInsightNote[RECEIVE_KEY] ||
    Object.values(form.coreInsightNote).filter(Boolean).join('\n') ||
    form.heartbeatVerse;

  const handleReceivingChange = useCallback((value: string) => {
    setForm((prev) => ({
      ...prev,
      heartbeatVerse: value,
      coreInsightCategory: [RECEIVE_KEY],
      coreInsightNote: { [RECEIVE_KEY]: value },
    }));
  }, []);

  const filledFields = [
    form.observation,
    receivingValue,
    form.actionPlan,
  ].filter(Boolean).length;
  const progressPercent = Math.round((filledFields / 3) * 100);

  return (
    <><UnsavedChangesGuard dirty={dirty || (open && isSaving)} onDiscard={discardDraft} />
    <LeaveConfirmation open={confirmClose} onStay={() => setConfirmClose(false)} onLeave={() => { discardDraft(); setConfirmClose(false); onOpenChange(false); }} />
    <Sheet open={open && !shareDraft} onOpenChange={requestOpenChange}>
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
          <SheetDescription className="sr-only">個人靈修筆記；只有確認分享的內容才會公開。</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" data-testid="loading-spinner" />
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {loadedNote && <NoteConflictReview key={`${userId}:${loadedNote.id}`} note={loadedNote} owner={userId} busy={isSaving} onRebase={cloud => {
              setLoadedNote({ ...cloud, syncStatus: 'synced' });
              setExistingId(cloud.id);
              setBaseline(emptyForm);
              toast({ title: '目前輸入已保留，請再次儲存以同步' });
            }} />}
            <DeviceDraft<FormFields> key={`${userId}:${draftScope}`} owner={userId} scope={draftScope} revision={loadedNote?.version ?? null} value={form} dirty={dirty} busy={isSaving} schema={formSchema} restore={value=>setForm(value)} preview={value => <>{value.observation}{'\n\n'}{Object.values(value.coreInsightNote).join('\n')}{'\n\n'}{value.actionPlan}</>} />
            <div className="rounded-md bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">經文</p>
              <p className="font-serif font-semibold text-sm" data-testid="text-verse-reference">
                {displayReference}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4" data-testid="text-verse-text">
                {displayText}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>三步驟筆記</span>
              <span>{filledFields}/3</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden -mt-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <Eye className="w-4 h-4 shrink-0" />
                1. 看見
                {form.observation && <Check className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <p className="text-xs text-muted-foreground">這段經文中，我觀察到什麼？</p>
              <Label htmlFor="dn-observation" className="sr-only">看見</Label>
              <AutoResizeTextarea
                id="dn-observation"
                disabled={isSaving}
                data-testid="textarea-observation"
                value={form.observation}
                onChange={(e) => updateField('observation', e.target.value)}
                placeholder="例如：人物、場景、重複的詞、讓你注意到的細節..."
                minRows={4}
                maxRows={8}
                className="text-base md:text-sm"
              />
            </section>

            <section className="rounded-2xl border border-sky-100 bg-sky-50/40 p-3 space-y-2 dark:border-sky-900/50 dark:bg-sky-950/20">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-400">
                <Heart className="w-4 h-4 shrink-0" />
                2. 領受
                {receivingValue && <Check className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <p className="text-xs text-muted-foreground">神透過這段經文對我說什麼？</p>
              <Label htmlFor="dn-receiving" className="sr-only">領受</Label>
              <AutoResizeTextarea
                id="dn-receiving"
                disabled={isSaving}
                data-testid="textarea-core-insight-note-GOD_ATTRIBUTE"
                value={receivingValue}
                onChange={(e) => handleReceivingChange(e.target.value)}
                placeholder="例如：我對神有什麼新的認識？哪句話觸動我？我被提醒、安慰或光照的是什麼？"
                minRows={4}
                maxRows={8}
                className="text-base md:text-sm"
              />
            </section>

            <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3 space-y-2 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <Target className="w-4 h-4 shrink-0" />
                3. 回應
                {form.actionPlan && <Check className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <p className="text-xs text-muted-foreground">我接下來要怎麼實踐？</p>
              <Label htmlFor="dn-actionPlan" className="sr-only">回應</Label>
              <AutoResizeTextarea
                id="dn-actionPlan"
                disabled={isSaving}
                data-testid="textarea-action-plan"
                value={form.actionPlan}
                onChange={(e) => updateField('actionPlan', e.target.value)}
                placeholder="例如：今天或這週的一個具體行動、我要如何禱告或調整生活..."
                minRows={4}
                maxRows={8}
                className="text-base md:text-sm"
              />
            </section>

            <Button
              onClick={()=>handleSave()}
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

            <Button variant="outline" className="w-full" disabled={isSaving} onClick={()=>handleSave(true)}>儲存並預覽公開分享</Button>

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
    {shareDraft && <DevotionWallShareDialog draft={shareDraft} close={()=>setShareDraft(null)} />}</>
  );
}
