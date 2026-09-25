import { useState, useEffect, useCallback, useRef, useId, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
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
  Share2,
  Loader2,
  Check,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Save,
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
import { formatScriptureText } from '@/lib/scriptureDisplay';
import './devotional-note-editor.css';

interface DevotionalNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verseReference: string;
  verseText: string;
  noteId?: string;
  inline?: boolean;
}

function NoteEditorSurface({ open, inline, sharing, onOpenChange, children }: {
  open: boolean;
  inline: boolean;
  sharing: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!inline || !open) return;
    titleRef.current?.focus({ preventScroll: true });
    titleRef.current?.scrollIntoView?.({ block: 'start' });
  }, [inline, open]);

  if (inline) return open ? (
    <section className="devotional-note-inline" aria-labelledby={titleId} data-testid="devotional-note-inline">
      <header className="note-editor-header">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="flex items-center gap-2 text-base font-semibold outline-none">
          <BookMarked className="h-5 w-5 shrink-0 text-primary" />靈修筆記
        </h2>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="收起筆記" title="收起筆記" onClick={() => onOpenChange(false)}>
          <ChevronUp className="h-5 w-5" />
        </Button>
      </header>
      {children}
    </section>
  ) : null;

  return <Dialog open={open && !sharing} onOpenChange={onOpenChange}>
    <DialogContent className="devotional-note-editor" data-testid="devotional-note-sheet"
      onOpenAutoFocus={event => { event.preventDefault(); titleRef.current?.focus(); }}>
      <DialogHeader className="note-editor-header">
        <div className="min-w-0">
          <DialogTitle ref={titleRef} tabIndex={-1} className="flex items-center gap-2 text-base outline-none">
            <BookMarked className="w-5 h-5 text-primary shrink-0" />靈修筆記
          </DialogTitle>
          <DialogDescription className="sr-only">個人靈修筆記，分享前會先確認對象與內容。</DialogDescription>
        </div>
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>;
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
  inline = false,
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
        else if (!inline) onOpenChange(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '儲存失敗';
      toast({ title: '儲存失敗', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
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

  return (
    <><UnsavedChangesGuard dirty={dirty || (open && isSaving)} onDiscard={discardDraft} />
    <LeaveConfirmation open={confirmClose} onStay={() => setConfirmClose(false)} onLeave={() => { discardDraft(); setConfirmClose(false); onOpenChange(false); }} />
    <NoteEditorSurface open={open} inline={inline} sharing={!!shareDraft} onOpenChange={requestOpenChange}>
        {isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" data-testid="loading-spinner" />
          </div>
        ) : (
          <div className="note-editor-body">
            {loadedNote && <NoteConflictReview key={`${userId}:${loadedNote.id}`} note={loadedNote} owner={userId} busy={isSaving} onRebase={cloud => {
              setLoadedNote({ ...cloud, syncStatus: 'synced' });
              setExistingId(cloud.id);
              setBaseline(emptyForm);
              toast({ title: '目前輸入已保留，請再次儲存以同步' });
            }} />}
            <DeviceDraft<FormFields> key={`${userId}:${draftScope}`} owner={userId} scope={draftScope} revision={loadedNote?.version ?? null} value={form} dirty={dirty} busy={isSaving} schema={formSchema} restore={value=>setForm(value)} preview={value => <>{value.observation}{'\n\n'}{Object.values(value.coreInsightNote).join('\n')}{'\n\n'}{value.actionPlan}</>} />
            <details className="note-editor-scripture">
              <summary>
                <span className="min-w-0 flex-1" data-testid="text-verse-reference">{displayReference}</span>
                <span className="text-xs text-muted-foreground">經文</span>
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
              </summary>
              <p className="whitespace-pre-wrap text-base leading-8" data-testid="text-verse-text">
                {formatScriptureText(displayText)}
              </p>
            </details>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>三步驟筆記</span>
              <span>{filledFields}/3</span>
            </div>

            <section className="note-editor-field">
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
                minRows={3}
                maxRows={12}
                className="text-base md:text-base leading-7 overflow-y-auto"
              />
            </section>

            <section className="note-editor-field">
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
                minRows={3}
                maxRows={12}
                className="text-base md:text-base leading-7 overflow-y-auto"
              />
            </section>

            <section className="note-editor-field">
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
                minRows={3}
                maxRows={12}
                className="text-base md:text-base leading-7 overflow-y-auto"
              />
            </section>

          </div>
        )}
        <footer className="note-editor-footer">
          <Button onClick={() => handleSave()} disabled={isSaving || isLoading} className="note-editor-action" aria-label="儲存（自己看）" data-testid="button-save-devotional-note">
            {isSaving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
            <span>{isSaving ? '儲存中...' : '儲存'}<span className="block text-xs font-normal">自己看</span></span>
          </Button>
          <Button variant="outline" onClick={() => handleSave(true)} disabled={isSaving || isLoading} className="note-editor-action" aria-label="分享" data-testid="button-share-devotional-note">
            <Share2 className="h-4 w-4 shrink-0" /><span>分享<span className="block text-xs font-normal text-muted-foreground">小組／靈修牆</span></span>
          </Button>
        </footer>
    </NoteEditorSurface>
    {shareDraft && <DevotionWallShareDialog draft={shareDraft} allowGroup close={()=>setShareDraft(null)} />}</>
  );
}
