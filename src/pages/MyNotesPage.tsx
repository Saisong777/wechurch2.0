import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureGate } from '@/components/ui/feature-gate';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { DevotionWallShareDialog } from '@/components/scripture/DevotionWallShareDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { removeLocalDevotionalNote } from '@/lib/localDevotionalNotes';
import { useDevotionalNotes } from '@/hooks/useDevotionalNotes';
import { NotesLoadNotice } from '@/components/scripture/NotesLoadNotice';
import { BookMarked, ChevronDown, ChevronUp, Loader2, Calendar, Pencil, Heart, Eye, Target, MessageCircle, BookOpen, EyeOff, Download } from 'lucide-react';
import { INSIGHT_CATEGORIES, parseCategories, parseNotes } from '@/types/spiritual-fitness';
import { createDevotionShareDraft } from '@/lib/devotionShareDraft';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { ImportedReadingHistory } from '@/components/scripture/ImportedReadingHistory';

interface DevotionalNote {
  sourceDevotionalDate?: string | null;
  sourceLabel?: string | null;
  syncStatus?: 'pending' | 'blocked' | 'synced';
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

const getCategoryInfo = (category: string | null) => {
  if (!category) return null;
  return INSIGHT_CATEGORIES.find(c => c.value === category);
};

const getDevotionalReceivingText = (note: DevotionalNote): string => {
  const categories = parseCategories(note.coreInsightCategory);
  const notes = parseNotes(note.coreInsightNote, categories);
  return (
    notes.GOD_ATTRIBUTE ||
    Object.values(notes).filter(Boolean).join('\n') ||
    note.heartbeatVerse ||
    ''
  );
};

const countFilledFields = (note: DevotionalNote): number => {
  return [
    note.observation,
    getDevotionalReceivingText(note),
    note.actionPlan,
  ].filter(Boolean).length;
};

const DevotionalNoteCard = ({ note }: { note: DevotionalNote }) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [showReadingContext, setShowReadingContext] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [shareOnWall, setShareOnWall] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const filledCount = countFilledFields(note);
  const receivingText = getDevotionalReceivingText(note);
  const isFromReadingPlan = !!note.readingPlanId;
  const sourceVerses = (note.verseText || '')
      .split('\n')
      .filter(Boolean)
      .map((text, index) => ({ verse: index + 1, text }));

  const hideMutation = useMutation({
    mutationFn: async () => {
      if (note.id.startsWith('local-devotional-')) {
        removeLocalDevotionalNote(note.id, user?.id || '');
        return;
      }
      await apiRequest('PATCH', `/api/devotional-notes/${note.id}/hidden`, { hidden: true });
      removeLocalDevotionalNote(note.id, user?.id || '');
    },
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
                {(note.syncStatus === 'pending' || note.syncStatus === 'blocked' || note.id.startsWith('local-devotional-')) && (
                  <Badge variant="outline">此裝置草稿，尚未同步</Badge>
                )}
                <Calendar className="w-4 h-4" />
                {format(new Date(note.sourceDevotionalDate ? `${note.sourceDevotionalDate}T00:00:00` : note.updatedAt), 'yyyy年M月d日', { locale: zhTW })}
                {note.sourceLabel && <Badge variant="outline">{note.sourceLabel} · 讀經日期</Badge>}
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
                {filledCount}/3
              </Badge>
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        <div className="px-6 pb-3"><Button variant="outline" size="sm" disabled={note.id.startsWith('local-devotional-') || note.syncStatus==='pending' || note.syncStatus==='blocked'} onClick={e=>{e.stopPropagation();setShareOnWall(true);}}><BookOpen className="mr-2 h-4 w-4" />分享到今日靈修牆</Button></div>

        {expanded && (
          <CardContent className="pt-0 space-y-4 border-t">
            {sourceVerses.length > 0 && (
              <div className="rounded-xl border bg-muted/20 p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-between gap-3 px-0 py-0 text-left hover:bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReadingContext((current) => !current);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                    <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">筆記保存的經文</span>
                  </span>
                  {showReadingContext ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </Button>

                {showReadingContext && (
                  <div
                    className="mt-3 space-y-3 border-t pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sourceVerses.length > 0 && (
                      <div className="rounded-lg bg-background p-3">
                        <p className="mb-2 text-xs font-semibold text-primary">經文</p>
                        <div className="space-y-2">
                          {sourceVerses.map((verse, index) => (
                            <p key={`${verse.verse}-${index}`} className="text-sm leading-6 text-muted-foreground">
                              {verse.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {note.observation && (
              <div className="flex gap-2">
                <Eye className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">1. 看見</p>
                  <p className="text-sm text-muted-foreground">{note.observation}</p>
                </div>
              </div>
            )}

            {receivingText && (
              <div className="flex gap-2">
                <Heart className="w-4 h-4 text-sky-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">2. 領受</p>
                  <p className="text-sm text-muted-foreground">{receivingText}</p>
                </div>
              </div>
            )}

            {note.actionPlan && (
              <div className="flex gap-2">
                <Target className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-medium mb-1">3. 回應</p>
                  <p className="text-sm text-muted-foreground">{note.actionPlan}</p>
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
      {shareOnWall && <DevotionWallShareDialog draft={createDevotionShareDraft(note)} close={()=>setShareOnWall(false)} />}
    </>
  );
};

const formatDevotionalNoteMarkdown = (note: DevotionalNote): string => {
  const date = note.sourceDevotionalDate || format(new Date(note.updatedAt), 'yyyy-MM-dd', { locale: zhTW });
  const lines: string[] = [];
  lines.push(`## ${note.verseReference} (${date})`);
  if (note.sourceLabel) lines.push(`來源：${note.sourceLabel}；日期為讀經日期，原撰寫時間未知。`);
  const receivingText = getDevotionalReceivingText(note);
  if (note.observation) lines.push(`**1. 看見:** ${note.observation}`);
  if (receivingText) lines.push(`**2. 領受:** ${receivingText}`);
  if (note.actionPlan) lines.push(`**3. 回應:** ${note.actionPlan}`);
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
  const [activeTab, setActiveTab] = useState('devotional');

  useEffect(() => {
    if (!loading && !user) {
      localStorage.removeItem('login_redirect');
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  const { data: devotionalNotes, isLoading: notesLoading, isError: notesError, isFetching: notesFetching, refetch: retryNotes } = useDevotionalNotes<DevotionalNote>(user?.id);

  const [search, setSearch] = useState('');
  const matchesSearch = (content: string) => content.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const readingPlanNotes = devotionalNotes?.filter(n => n.readingPlanId !== null) || [];
  const devotionalOnlyNotes = devotionalNotes?.filter(n => n.readingPlanId === null) || [];
  const totalNotes = readingPlanNotes.length + devotionalOnlyNotes.length;
  const latestDevotionalNote = [...readingPlanNotes, ...devotionalOnlyNotes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const latestNoteDate = [
    latestDevotionalNote?.updatedAt,
  ]
    .filter(Boolean)
    .map((date) => new Date(date as string))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const actionItemsCount = [
    ...(devotionalNotes || []).map((note) => note.actionPlan),
  ].filter(Boolean).length;
  const nextActionText =
    latestDevotionalNote?.actionPlan ||
    '今天可以先打開聖經，留下第一個可回看的行動。';
  const noteStats = [
    {
      label: '讀經計劃',
      value: readingPlanNotes.length,
      icon: BookOpen,
      tone: 'bg-primary/10 text-primary',
    },
    {
      label: '經文感動',
      value: devotionalOnlyNotes.length,
      icon: BookMarked,
      tone: 'bg-rose-500/10 text-rose-500',
    },
    {
      label: '行動操練',
      value: actionItemsCount,
      icon: Target,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

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
    }

    if (notesError) content = '> 此次僅匯出目前可用的筆記，尚未取得完整的最新資料。\n\n' + content;
    downloadMarkdown(content, filename);
    toast({ title: '筆記已匯出' });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="compact" title="我的筆記" backTo="/learn" />
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
        <Header variant="compact" title="我的筆記" backTo="/learn" />
        <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <Link to="/groups?view=note" className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-primary">選擇筆記分享給小家</Link>
          <Link to="/devotion-wall" className="mb-4 ml-4 inline-flex min-h-11 items-center text-sm font-medium text-primary">今日靈修牆</Link>
          <div className="max-w-2xl md:max-w-3xl mx-auto">
            <section className="mb-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h1 className="text-2xl font-semibold">我的筆記</h1><p className="mt-1 text-sm text-muted-foreground">私人筆記 · {notesLoading ? '載入中' : notesError ? `目前可用 ${totalNotes} 則` : `${totalNotes} 則紀錄`}</p></div>
                <Button asChild><Link to="/learn/church-reading"><BookOpen className="h-4 w-4" />今日靈修</Link></Button>
              </div>
              {notesError && <NotesLoadNotice onRetry={() => { void retryNotes(); }} busy={notesFetching} />}
              <Input aria-label="搜尋筆記" type="search" placeholder="搜尋經文、心得或行動" value={search} onChange={e => setSearch(e.target.value)} />
              <details className="border-b pb-3">
                <summary className="cursor-pointer py-2 text-sm text-muted-foreground">筆記回顧與下一步</summary>
                <div className="mt-2 space-y-2 text-sm leading-6">
                  <p>{noteStats.map(stat => `${stat.label} ${stat.value}`).join(' · ')}</p>
                  {latestNoteDate && <p>最近更新：{format(latestNoteDate, 'M月d日', { locale: zhTW })}</p>}
                  <p>{nextActionText}</p>
                </div>
              </details>
            </section>

            <ImportedReadingHistory userId={user.id} />
            <Tabs defaultValue="devotional" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
                <TabsList className="grid grid-cols-2 flex-1 min-w-0" data-testid="notes-tabs">
                  <TabsTrigger value="reading-plan" data-testid="tab-reading-plan">
                    讀經計劃
                  </TabsTrigger>
                  <TabsTrigger value="devotional" data-testid="tab-devotional">
                    靈修筆記
                  </TabsTrigger>

                </TabsList>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  data-testid="button-export-notes"
                >
                  <Download className="w-4 h-4 mr-1" />
                  {notesError ? '匯出目前可用筆記' : '匯出'}
                </Button>
              </div>

              {search.trim() && <p role="status" className="mb-3 text-sm text-muted-foreground">找到 {((activeTab === 'reading-plan' ? readingPlanNotes : devotionalOnlyNotes).filter(note => matchesSearch(formatDevotionalNoteMarkdown(note)))).length} 則 · 匯出仍包含此分類全部筆記</p>}
              <TabsContent value="reading-plan" data-testid="tab-content-reading-plan">
                {notesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 w-full rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : notesError && readingPlanNotes.length === 0 ? null : readingPlanNotes.length === 0 ? (
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
                    {readingPlanNotes.filter(note => matchesSearch(formatDevotionalNoteMarkdown(note))).map((note) => (
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
                ) : notesError && devotionalOnlyNotes.length === 0 ? null : devotionalOnlyNotes.length === 0 ? (
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
                    {devotionalOnlyNotes.filter(note => matchesSearch(formatDevotionalNoteMarkdown(note))).map((note) => (
                      <DevotionalNoteCard key={note.id} note={note} />
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
