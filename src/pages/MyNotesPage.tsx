import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureGate } from '@/components/ui/feature-gate';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { BookMarked, ChevronDown, ChevronUp, Loader2, Calendar, Pencil, Heart, Eye, Dumbbell, Target, MessageCircle, BookOpen, EyeOff, Download, Save } from 'lucide-react';
import { INSIGHT_CATEGORIES, parseCategories, parseNotes } from '@/types/spiritual-fitness';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface DevotionalNote {
  id: string;
  userId: string;
  verseReference: string;
  verseText: string | null;
  readingPlanId: string | null;
  dayNumber: number | null;
  titlePhrase: string | null;
  heartbeatVerse: string | null;
  observation: string | null;
  coreInsightCategory: string | null;
  coreInsightNote: string | null;
  scholarsNote: string | null;
  actionPlan: string | null;
  coolDownNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotebookEntry {
  id: string;
  session_id: string;
  verse_reference: string;
  session_date: string;
  title_phrase: string | null;
  heartbeat_verse: string | null;
  observation: string | null;
  core_insight_category: string | null;
  core_insight_note: string | null;
  scholars_note: string | null;
  action_plan: string | null;
  cool_down_note: string | null;
}

const getCategoryInfo = (category: string | null) => {
  if (!category) return null;
  return INSIGHT_CATEGORIES.find(c => c.value === category);
};

const countFilledFields = (note: DevotionalNote): number => {
  return [
    note.titlePhrase,
    note.heartbeatVerse,
    note.observation,
    note.coreInsightNote,
    note.scholarsNote,
    note.actionPlan,
    note.coolDownNote,
  ].filter(Boolean).length;
};

const DevotionalNoteCard = ({ note }: { note: DevotionalNote }) => {
  const [expanded, setExpanded] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const filledCount = countFilledFields(note);
  const categoryInfo = getCategoryInfo(note.coreInsightCategory);
  const isFromReadingPlan = !!note.readingPlanId;

  const hideMutation = useMutation({
    mutationFn: () => apiRequest('PATCH', `/api/devotional-notes/${note.id}/hidden`, { hidden: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devotional-notes'] });
      toast({ title: '筆記已隱藏' });
      setShowHideConfirm(false);
    },
  });

  return (
    <>
      <Card
        className="overflow-visible cursor-pointer hover-elevate"
        onClick={() => setExpanded(!expanded)}
        data-testid={`card-devotional-note-${note.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 flex-wrap">
                <Calendar className="w-4 h-4" />
                {format(new Date(note.updatedAt), 'yyyy年M月d日', { locale: zhTW })}
                {note.dayNumber && (
                  <span>第 {note.dayNumber} 天</span>
                )}
                {isFromReadingPlan ? (
                  <Badge variant="outline" className="text-xs">
                    讀經計劃
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <BookOpen className="w-3 h-3 mr-1" />
                    經文靈修
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base font-medium truncate" data-testid={`text-verse-ref-${note.id}`}>
                {note.verseReference}
              </CardTitle>
              {note.titlePhrase && (
                <p className="text-sm text-muted-foreground mt-1 truncate" data-testid={`text-title-phrase-${note.id}`}>
                  {note.titlePhrase}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs" data-testid={`text-filled-count-${note.id}`}>
                {filledCount}/7
              </Badge>
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 space-y-4 border-t">
            {note.titlePhrase && (
              <div className="flex gap-2">
                <BookMarked className="w-4 h-4 text-green-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">1. 定標題</p>
                  <p className="text-sm text-muted-foreground">{note.titlePhrase}</p>
                </div>
              </div>
            )}

            {note.heartbeatVerse && (
              <div className="flex gap-2">
                <Heart className="w-4 h-4 text-red-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">2. 心跳的時刻</p>
                  <p className="text-sm text-muted-foreground">{note.heartbeatVerse}</p>
                </div>
              </div>
            )}

            {note.observation && (
              <div className="flex gap-2">
                <Eye className="w-4 h-4 text-blue-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">3. 查看聖經的資訊</p>
                  <p className="text-sm text-muted-foreground">{note.observation}</p>
                </div>
              </div>
            )}

            {(categoryInfo || note.coreInsightNote) && (
              <div className="flex gap-2">
                <Dumbbell className="w-4 h-4 text-orange-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">4. 思想神的話</p>
                  {categoryInfo && (
                    <Badge variant="outline" className="mb-1">
                      {categoryInfo.label}
                    </Badge>
                  )}
                  {note.coreInsightNote && (
                    <p className="text-sm text-muted-foreground">{note.coreInsightNote}</p>
                  )}
                </div>
              </div>
            )}

            {note.scholarsNote && (
              <div className="flex gap-2">
                <MessageCircle className="w-4 h-4 text-purple-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">5. 學長姐的話</p>
                  <p className="text-sm text-muted-foreground">{note.scholarsNote}</p>
                </div>
              </div>
            )}

            {note.actionPlan && (
              <div className="flex gap-2">
                <Target className="w-4 h-4 text-teal-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">6. 帶一招</p>
                  <p className="text-sm text-muted-foreground">{note.actionPlan}</p>
                </div>
              </div>
            )}

            {note.coolDownNote && (
              <div className="flex gap-2">
                <Heart className="w-4 h-4 text-indigo-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">7. 安靜的心</p>
                  <p className="text-sm text-muted-foreground">{note.coolDownNote}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditDialog(true);
                  }}
                  data-testid={`button-edit-note-${note.id}`}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  編輯筆記
                </Button>
                {isFromReadingPlan && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/learn/reading-plans/${note.readingPlanId}/read${note.dayNumber ? `?day=${note.dayNumber}` : ''}`);
                    }}
                    data-testid={`button-goto-reading-${note.id}`}
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1" />
                    前往閱讀
                  </Button>
                )}
              </div>
              <AlertDialog open={showHideConfirm} onOpenChange={setShowHideConfirm}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    data-testid={`button-hide-note-${note.id}`}
                  >
                    <EyeOff className="w-3.5 h-3.5 mr-1" />
                    隱藏
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>隱藏筆記</AlertDialogTitle>
                    <AlertDialogDescription>
                      確定要隱藏這筆筆記嗎？隱藏後不會刪除資料，但不再顯示。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => hideMutation.mutate()}
                      disabled={hideMutation.isPending}
                    >
                      確定隱藏
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        )}
      </Card>

      <DevotionalNoteDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        verseReference={note.verseReference}
        verseText={note.verseText || ''}
        noteId={note.id}
      />
    </>
  );
};

const StudyNoteEditDialog = ({ entry, userEmail, open, onOpenChange }: { entry: NotebookEntry; userEmail: string; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    titlePhrase: entry.title_phrase || '',
    heartbeatVerse: entry.heartbeat_verse || '',
    observation: entry.observation || '',
    coreInsightNote: entry.core_insight_note || '',
    scholarsNote: entry.scholars_note || '',
    actionPlan: entry.action_plan || '',
    coolDownNote: entry.cool_down_note || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        titlePhrase: entry.title_phrase || '',
        heartbeatVerse: entry.heartbeat_verse || '',
        observation: entry.observation || '',
        coreInsightNote: entry.core_insight_note || '',
        scholarsNote: entry.scholars_note || '',
        actionPlan: entry.action_plan || '',
        coolDownNote: entry.cool_down_note || '',
      });
    }
  }, [open, entry]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest('PATCH', `/api/study-responses/${entry.id}`, form);
      queryClient.invalidateQueries({ queryKey: ['/api/notebook', userEmail] });
      toast({ title: '已儲存', description: '筆記已成功更新' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving study note:', error);
      toast({ title: '儲存失敗', description: '請稍後再試', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const fields = [
    { key: 'titlePhrase' as const, label: '1. 定標題', icon: <BookMarked className="w-4 h-4 text-green-500" /> },
    { key: 'heartbeatVerse' as const, label: '2. 心跳的時刻', icon: <Heart className="w-4 h-4 text-red-500" /> },
    { key: 'observation' as const, label: '3. 查看聖經的資訊', icon: <Eye className="w-4 h-4 text-blue-500" /> },
    { key: 'coreInsightNote' as const, label: '4. 核心訓練筆記', icon: <Dumbbell className="w-4 h-4 text-orange-500" /> },
    { key: 'scholarsNote' as const, label: '5. 學長姐的話', icon: <MessageCircle className="w-4 h-4 text-purple-500" /> },
    { key: 'actionPlan' as const, label: '6. 帶一招', icon: <Target className="w-4 h-4 text-teal-500" /> },
    { key: 'coolDownNote' as const, label: '7. 安靜的心', icon: <Heart className="w-4 h-4 text-indigo-500" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            編輯 Soul Gym 筆記
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{entry.verse_reference}</p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {fields.map(({ key, label, icon }) => (
            <div key={key} className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                {icon} {label}
              </Label>
              <AutoResizeTextarea
                value={form[key]}
                onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={`輸入${label}...`}
                minRows={1}
                maxRows={6}
                className="text-sm"
                data-testid={`input-study-edit-${key}`}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-study-note">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              儲存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StudyNoteCard = ({ entry, userEmail }: { entry: NotebookEntry; userEmail: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const parsedCats = parseCategories(entry.core_insight_category);
  const parsedNts = parseNotes(entry.core_insight_note, parsedCats);

  const hideMutation = useMutation({
    mutationFn: () => apiRequest('PATCH', `/api/notebook/${entry.id}/hidden`, { hidden: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notebook', userEmail] });
      toast({ title: '筆記已隱藏' });
      setShowHideConfirm(false);
    },
  });

  return (
    <Card
      className="overflow-visible cursor-pointer hover-elevate"
      onClick={() => setExpanded(!expanded)}
      data-testid={`card-study-note-${entry.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 flex-wrap">
              <Calendar className="w-4 h-4" />
              <span data-testid={`text-study-date-${entry.id}`}>
                {format(new Date(entry.session_date), 'yyyy年M月d日', { locale: zhTW })}
              </span>
              <Badge variant="outline" className="text-xs" data-testid={`text-study-badge-${entry.id}`}>
                <Dumbbell className="w-3 h-3 mr-1" />
                Soul Gym
              </Badge>
            </div>
            <CardTitle className="text-base font-medium truncate" data-testid={`text-study-verse-${entry.id}`}>
              {entry.verse_reference}
            </CardTitle>
            {entry.title_phrase && (
              <p className="text-sm text-muted-foreground mt-1 truncate" data-testid={`text-study-title-${entry.id}`}>
                {entry.title_phrase}
              </p>
            )}
          </div>
          <div className="flex items-center shrink-0">
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4 border-t">
          {entry.heartbeat_verse && (
            <div className="flex gap-2" data-testid={`text-study-heartbeat-${entry.id}`}>
              <Heart className="w-4 h-4 text-red-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">心動經文</p>
                <p className="text-sm text-muted-foreground">{entry.heartbeat_verse}</p>
              </div>
            </div>
          )}

          {entry.observation && (
            <div className="flex gap-2" data-testid={`text-study-observation-${entry.id}`}>
              <Eye className="w-4 h-4 text-blue-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">觀察</p>
                <p className="text-sm text-muted-foreground">{entry.observation}</p>
              </div>
            </div>
          )}

          {parsedCats.length > 0 && (
            <div className="flex gap-2" data-testid={`text-study-core-insight-${entry.id}`}>
              <Dumbbell className="w-4 h-4 text-orange-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">核心訓練</p>
                <div className="flex flex-wrap gap-1 mb-1">
                  {parsedCats.map(catVal => {
                    const catInfo = INSIGHT_CATEGORIES.find(c => c.value === catVal);
                    return catInfo ? (
                      <Badge key={catVal} variant="outline">
                        {catInfo.emoji} {catInfo.label}
                      </Badge>
                    ) : null;
                  })}
                </div>
                {parsedCats.map(catVal => {
                  const note = parsedNts[catVal];
                  if (!note) return null;
                  const catInfo = INSIGHT_CATEGORIES.find(c => c.value === catVal);
                  return (
                    <p key={catVal} className="text-sm text-muted-foreground">
                      {catInfo && <span className="font-medium">{catInfo.label}: </span>}
                      {note}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {entry.scholars_note && (
            <div className="flex gap-2" data-testid={`text-study-scholars-${entry.id}`}>
              <MessageCircle className="w-4 h-4 text-purple-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">學者分享</p>
                <p className="text-sm text-muted-foreground">{entry.scholars_note}</p>
              </div>
            </div>
          )}

          {entry.action_plan && (
            <div className="flex gap-2" data-testid={`text-study-action-${entry.id}`}>
              <Target className="w-4 h-4 text-green-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">行動計劃</p>
                <p className="text-sm text-muted-foreground">{entry.action_plan}</p>
              </div>
            </div>
          )}

          {entry.cool_down_note && (
            <div className="flex gap-2" data-testid={`text-study-cooldown-${entry.id}`}>
              <Heart className="w-4 h-4 text-indigo-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">緩和心得</p>
                <p className="text-sm text-muted-foreground">{entry.cool_down_note}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowEditDialog(true);
              }}
              data-testid={`button-edit-study-note-${entry.id}`}
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              編輯筆記
            </Button>
            <AlertDialog open={showHideConfirm} onOpenChange={setShowHideConfirm}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  data-testid={`button-hide-note-${entry.id}`}
                >
                  <EyeOff className="w-3.5 h-3.5 mr-1" />
                  隱藏
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>隱藏筆記</AlertDialogTitle>
                  <AlertDialogDescription>
                    確定要隱藏這筆筆記嗎？隱藏後不會刪除資料，但不再顯示。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => hideMutation.mutate()}
                    disabled={hideMutation.isPending}
                  >
                    確定隱藏
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      )}
      <StudyNoteEditDialog
        entry={entry}
        userEmail={userEmail}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </Card>
  );
};

const formatDevotionalNoteMarkdown = (note: DevotionalNote): string => {
  const date = format(new Date(note.updatedAt), 'yyyy-MM-dd', { locale: zhTW });
  const lines: string[] = [];
  lines.push(`## ${note.verseReference} (${date})`);
  if (note.titlePhrase) lines.push(`**1. 定標題:** ${note.titlePhrase}`);
  if (note.heartbeatVerse) lines.push(`**2. 心跳的時刻:** ${note.heartbeatVerse}`);
  if (note.observation) lines.push(`**3. 查看聖經的資訊:** ${note.observation}`);
  if (note.coreInsightNote) {
    const catInfo = getCategoryInfo(note.coreInsightCategory);
    lines.push(`**4. 思想神的話${catInfo ? ` (${catInfo.label})` : ''}:** ${note.coreInsightNote}`);
  }
  if (note.scholarsNote) lines.push(`**5. 學長姐的話:** ${note.scholarsNote}`);
  if (note.actionPlan) lines.push(`**6. 帶一招:** ${note.actionPlan}`);
  if (note.coolDownNote) lines.push(`**7. 安靜的心:** ${note.coolDownNote}`);
  return lines.join('\n\n');
};

const formatStudyNoteMarkdown = (entry: NotebookEntry): string => {
  const date = format(new Date(entry.session_date), 'yyyy-MM-dd', { locale: zhTW });
  const lines: string[] = [];
  lines.push(`## ${entry.verse_reference} - Soul Gym (${date})`);
  if (entry.title_phrase) lines.push(`**定標題:** ${entry.title_phrase}`);
  if (entry.heartbeat_verse) lines.push(`**心動經文:** ${entry.heartbeat_verse}`);
  if (entry.observation) lines.push(`**觀察:** ${entry.observation}`);
  if (entry.core_insight_note) lines.push(`**核心訓練:** ${entry.core_insight_note}`);
  if (entry.scholars_note) lines.push(`**學者分享:** ${entry.scholars_note}`);
  if (entry.action_plan) lines.push(`**行動計劃:** ${entry.action_plan}`);
  if (entry.cool_down_note) lines.push(`**緩和心得:** ${entry.cool_down_note}`);
  return lines.join('\n\n');
};

const downloadMarkdown = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const MyNotesPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('reading-plan');

  useEffect(() => {
    if (!loading && !user) {
      localStorage.removeItem('login_redirect');
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  const { data: devotionalNotes, isLoading: notesLoading } = useQuery<DevotionalNote[]>({
    queryKey: ['/api/devotional-notes'],
    enabled: !!user,
  });

  const userEmail = user?.email || localStorage.getItem('bible_study_guest_email') || '';

  const { data: notebookEntries, isLoading: notebookLoading } = useQuery<NotebookEntry[]>({
    queryKey: ['/api/notebook', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/notebook?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to fetch notebook');
      const data = await res.json();
      return (data?.entries || []) as NotebookEntry[];
    },
    enabled: !!user && !!userEmail,
    staleTime: 60000,
  });

  const readingPlanNotes = devotionalNotes?.filter(n => n.readingPlanId !== null) || [];
  const devotionalOnlyNotes = devotionalNotes?.filter(n => n.readingPlanId === null) || [];

  const handleExport = () => {
    let content = '';
    let filename = '';
    const today = format(new Date(), 'yyyy-MM-dd');

    if (activeTab === 'reading-plan') {
      if (readingPlanNotes.length === 0) {
        toast({ title: '沒有可匯出的筆記', variant: 'destructive' });
        return;
      }
      content = `# 讀經計劃筆記\n\n匯出日期: ${today}\n\n---\n\n` +
        readingPlanNotes.map(formatDevotionalNoteMarkdown).join('\n\n---\n\n');
      filename = `讀經計劃筆記_${today}.md`;
    } else if (activeTab === 'devotional') {
      if (devotionalOnlyNotes.length === 0) {
        toast({ title: '沒有可匯出的筆記', variant: 'destructive' });
        return;
      }
      content = `# 經文感動\n\n匯出日期: ${today}\n\n---\n\n` +
        devotionalOnlyNotes.map(formatDevotionalNoteMarkdown).join('\n\n---\n\n');
      filename = `經文感動_${today}.md`;
    } else if (activeTab === 'study') {
      if (!notebookEntries || notebookEntries.length === 0) {
        toast({ title: '沒有可匯出的筆記', variant: 'destructive' });
        return;
      }
      content = `# 共同查經筆記\n\n匯出日期: ${today}\n\n---\n\n` +
        notebookEntries.map(formatStudyNoteMarkdown).join('\n\n---\n\n');
      filename = `共同查經筆記_${today}.md`;
    }

    downloadMarkdown(content, filename);
    toast({ title: '筆記已匯出' });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="compact" title="我的筆記" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <FeatureGate
      featureKeys={["we_learn"]}
      title="筆記功能維護中"
      description="筆記功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background" data-testid="my-notes-page">
        <Header variant="compact" title="我的筆記" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8">
          <div className="max-w-2xl md:max-w-3xl mx-auto">
            <Tabs defaultValue="reading-plan" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
                <TabsList className="grid grid-cols-3 flex-1 min-w-0" data-testid="notes-tabs">
                  <TabsTrigger value="reading-plan" data-testid="tab-reading-plan">
                    讀經計劃
                  </TabsTrigger>
                  <TabsTrigger value="devotional" data-testid="tab-devotional">
                    經文感動
                  </TabsTrigger>
                  <TabsTrigger value="study" data-testid="tab-study">
                    共同查經
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  data-testid="button-export-notes"
                >
                  <Download className="w-4 h-4 mr-1" />
                  匯出
                </Button>
              </div>

              <TabsContent value="reading-plan" data-testid="tab-content-reading-plan">
                {notesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 w-full rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : readingPlanNotes.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2" data-testid="text-empty-reading-plan">尚無讀經計劃筆記</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        加入讀經計劃，開始每日靈修之旅
                      </p>
                      <Link to="/learn/reading-plans" data-testid="link-reading-plans">
                        <Button data-testid="button-go-reading-plans">
                          前往讀經計劃
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {readingPlanNotes.map((note) => (
                      <DevotionalNoteCard key={note.id} note={note} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="devotional" data-testid="tab-content-devotional">
                {notesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 w-full rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : devotionalOnlyNotes.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2" data-testid="text-empty-devotional">尚無經文感動</h3>
                      <p className="text-muted-foreground text-sm">
                        在聖經閱讀、耶穌事蹟、今日經文等頁面點擊「筆記」即可開始記錄
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {devotionalOnlyNotes.map((note) => (
                      <DevotionalNoteCard key={note.id} note={note} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="study" data-testid="tab-content-study">
                {notebookLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 w-full rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : !notebookEntries || notebookEntries.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2" data-testid="text-empty-study">尚無查經筆記</h3>
                      <p className="text-muted-foreground text-sm">
                        參加 Soul Gym 共同查經後，您的查經筆記會自動儲存在這裡
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {notebookEntries.map((entry) => (
                      <StudyNoteCard key={entry.id} entry={entry} userEmail={userEmail} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default MyNotesPage;
