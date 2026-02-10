import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen, Plus, ChevronRight, Clock, Trash2, Play, Pause,
  Calendar, Bell, AlertCircle, BookMarked, Library, X, Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FeatureGate } from '@/components/ui/feature-gate';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useReadingReminder } from '@/hooks/useReadingReminder';
import { ReadingReminderPopup, useReminderSimulation } from '@/components/reading/ReadingReminderPopup';
import { DevotionalAnalysisBatchDialog } from '@/components/scripture/DevotionalAnalysisBatchDialog';

interface BibleBook {
  bookName: string;
  bookNumber: number;
  chapterCount: number;
}

interface BookSelection {
  bookName: string;
  chapterStart: number;
  chapterEnd: number;
}

interface UserReadingPlan {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  totalDays: number | null;
  reminderEnabled: boolean;
  reminderMorning: string | null;
  reminderNoon: string | null;
  reminderEvening: string | null;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlanProgress {
  completedDays: number;
  totalDays: number;
  percentage: number;
}

interface ReadingPlanTemplate {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  category: string | null;
  isPublic: boolean;
}

type ViewMode = 'my-plans' | 'create' | 'browse';

const ReadingPlansPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { requestPermission, startReminder, stopReminder, isSupported } = useReadingReminder();
  const { showReminder, setShowReminder, reminderTimeSlot, summary: reminderSummary, triggerReminder } = useReminderSimulation();
  const [viewMode, setViewMode] = useState<ViewMode>('my-plans');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [showBatchAnalysis, setShowBatchAnalysis] = useState(false);

  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [selectedBooks, setSelectedBooks] = useState<BookSelection[]>([]);
  const [chaptersPerDay, setChaptersPerDay] = useState(3);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMorning, setReminderMorning] = useState('07:00');
  const [reminderNoon, setReminderNoon] = useState('12:00');
  const [reminderEvening, setReminderEvening] = useState('20:00');

  const { data: userPlans = [], isLoading: plansLoading } = useQuery<UserReadingPlan[]>({
    queryKey: ['/api/user-reading-plans'],
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || !userPlans.length) {
      stopReminder();
      return;
    }
    const activePlans = userPlans.filter(p => p.isActive);
    const hasReminders = activePlans.some(p => p.reminderEnabled);
    if (hasReminders) {
      const plan = activePlans.find(p => p.reminderEnabled);
      if (plan) {
        startReminder({
          enabled: true,
          morning: plan.reminderMorning || '07:00',
          noon: plan.reminderNoon || '12:00',
          evening: plan.reminderEvening || '20:00',
        });
      }
    } else {
      stopReminder();
    }
    return () => stopReminder();
  }, [user, userPlans, startReminder, stopReminder]);

  const { data: bibleBooks = [], isLoading: booksLoading } = useQuery<BibleBook[]>({
    queryKey: ['/api/bible/books'],
    enabled: viewMode === 'create',
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ReadingPlanTemplate[]>({
    queryKey: ['/api/reading-plans'],
    enabled: viewMode === 'browse',
  });

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/user-reading-plans', {
        name: planName,
        description: planDescription || null,
        startDate,
        bookSelections: selectedBooks,
        chaptersPerDay,
        reminderEnabled,
        reminderMorning: reminderEnabled ? reminderMorning : null,
        reminderNoon: reminderEnabled ? reminderNoon : null,
        reminderEvening: reminderEnabled ? reminderEvening : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-reading-plans'] });
      toast({ title: '計劃已建立', description: '開始你的讀經之旅吧！' });
      resetCreateForm();
      setViewMode('my-plans');
    },
    onError: (error: Error) => {
      toast({ title: '建立失敗', description: error.message, variant: 'destructive' });
    },
  });

  const togglePlanMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest('PATCH', `/api/user-reading-plans/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-reading-plans'] });
      toast({ title: '計劃已更新' });
    },
    onError: (error: Error) => {
      toast({ title: '更新失敗', description: error.message, variant: 'destructive' });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/user-reading-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-reading-plans'] });
      toast({ title: '計劃已刪除' });
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: '刪除失敗', description: error.message, variant: 'destructive' });
    },
  });

  const resetCreateForm = () => {
    setPlanName('');
    setPlanDescription('');
    setSelectedBooks([]);
    setChaptersPerDay(3);
    setStartDate(new Date().toISOString().split('T')[0]);
    setReminderEnabled(false);
    setReminderMorning('07:00');
    setReminderNoon('12:00');
    setReminderEvening('20:00');
  };

  const addBook = (bookName: string) => {
    const book = bibleBooks.find(b => b.bookName === bookName);
    if (!book || selectedBooks.some(s => s.bookName === bookName)) return;
    setSelectedBooks([...selectedBooks, {
      bookName,
      chapterStart: 1,
      chapterEnd: book.chapterCount,
    }]);
  };

  const removeBook = (bookName: string) => {
    setSelectedBooks(selectedBooks.filter(s => s.bookName !== bookName));
  };

  const updateBookRange = (bookName: string, field: 'chapterStart' | 'chapterEnd', value: number) => {
    setSelectedBooks(selectedBooks.map(s =>
      s.bookName === bookName ? { ...s, [field]: value } : s
    ));
  };

  const totalSelectedChapters = selectedBooks.reduce((sum, s) => sum + (s.chapterEnd - s.chapterStart + 1), 0);
  const estimatedDays = chaptersPerDay > 0 ? Math.ceil(totalSelectedChapters / chaptersPerDay) : 0;

  const canSubmit = planName.trim() && selectedBooks.length > 0 && chaptersPerDay > 0;

  const handleCreateSubmit = () => {
    if (!canSubmit) return;
    createPlanMutation.mutate();
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPlanToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleTogglePlan = (id: string, currentActive: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlanMutation.mutate({ id, isActive: !currentActive });
  };

  const getPlanProgress = (plan: UserReadingPlan): PlanProgress => {
    const totalDays = plan.totalDays || 0;
    const startMs = new Date(plan.startDate).getTime();
    const nowMs = Date.now();
    const daysSinceStart = Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)));
    const currentDay = Math.min(daysSinceStart + 1, totalDays);
    const percentage = totalDays > 0 ? Math.round((currentDay / totalDays) * 100) : 0;
    return {
      completedDays: currentDay,
      totalDays,
      percentage: Math.min(percentage, 100),
    };
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="讀經計劃" variant="compact" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6">
          <div className="max-w-3xl lg:max-w-4xl mx-auto text-center text-muted-foreground py-12">
            載入中...
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <FeatureGate featureKeys={["we_learn", "reading_plans"]} title="讀經計劃功能維護中" description="讀經計劃功能目前暫時關閉，請稍後再試">
        <div className="min-h-screen bg-background">
          <Header title="讀經計劃" variant="compact" />
          <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6">
            <div className="max-w-3xl lg:max-w-4xl mx-auto">
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-lg font-semibold mb-2">請先登入</h2>
                  <p className="text-muted-foreground mb-4">登入後即可建立和管理你的讀經計劃</p>
                  <Button asChild data-testid="button-login">
                    <Link to="/login">前往登入</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate featureKeys={["we_learn", "reading_plans"]} title="讀經計劃功能維護中" description="讀經計劃功能目前暫時關閉，請稍後再試">
      <div className="min-h-screen bg-background">
        <Header title="讀經計劃" variant="compact" />

        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={viewMode === 'my-plans' ? 'default' : 'outline'}
                onClick={() => setViewMode('my-plans')}
                data-testid="button-view-my-plans"
              >
                <BookMarked className="w-4 h-4 mr-1.5" />
                我的計劃
              </Button>
              <Button
                variant={viewMode === 'create' ? 'default' : 'outline'}
                onClick={() => setViewMode('create')}
                data-testid="button-view-create"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                建立計劃
              </Button>
              <Button
                variant={viewMode === 'browse' ? 'default' : 'outline'}
                onClick={() => setViewMode('browse')}
                data-testid="button-view-browse"
              >
                <Library className="w-4 h-4 mr-1.5" />
                瀏覽範本
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowBatchAnalysis(true)}
                data-testid="button-open-batch-analysis"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                AI 整合分析
              </Button>
            </div>

            <Card className="mb-4 border-amber-300/30 bg-amber-50/30 dark:bg-amber-950/10">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium">模擬提醒測試</span>
                  <Badge variant="outline" className="text-[10px]">測試功能</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  點擊下方按鈕模擬不同時段的靈修提醒彈窗
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => triggerReminder('morning')}
                    data-testid="button-test-reminder-morning"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    早安提醒
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => triggerReminder('noon')}
                    data-testid="button-test-reminder-noon"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    午安提醒
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => triggerReminder('evening')}
                    data-testid="button-test-reminder-evening"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    晚安提醒
                  </Button>
                </div>
              </CardContent>
            </Card>

            {viewMode === 'my-plans' && (
              <MyPlansView
                plans={userPlans}
                loading={plansLoading}
                getPlanProgress={getPlanProgress}
                onToggle={handleTogglePlan}
                onDelete={confirmDelete}
                onCreateClick={() => setViewMode('create')}
              />
            )}

            {viewMode === 'create' && (
              <CreatePlanView
                bibleBooks={bibleBooks}
                booksLoading={booksLoading}
                planName={planName}
                setPlanName={setPlanName}
                planDescription={planDescription}
                setPlanDescription={setPlanDescription}
                selectedBooks={selectedBooks}
                addBook={addBook}
                removeBook={removeBook}
                updateBookRange={updateBookRange}
                chaptersPerDay={chaptersPerDay}
                setChaptersPerDay={setChaptersPerDay}
                startDate={startDate}
                setStartDate={setStartDate}
                reminderEnabled={reminderEnabled}
                setReminderEnabled={setReminderEnabled}
                reminderMorning={reminderMorning}
                setReminderMorning={setReminderMorning}
                reminderNoon={reminderNoon}
                setReminderNoon={setReminderNoon}
                reminderEvening={reminderEvening}
                setReminderEvening={setReminderEvening}
                totalSelectedChapters={totalSelectedChapters}
                estimatedDays={estimatedDays}
                canSubmit={canSubmit}
                isPending={createPlanMutation.isPending}
                onSubmit={handleCreateSubmit}
                isSupported={isSupported}
                requestPermission={requestPermission}
                toast={toast}
              />
            )}

            {viewMode === 'browse' && (
              <BrowseTemplatesView
                templates={templates}
                loading={templatesLoading}
              />
            )}
          </div>
        </main>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>確認刪除</DialogTitle>
              <DialogDescription>確定要刪除這個讀經計劃嗎？此操作無法復原。</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-cancel-delete">
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => planToDelete && deletePlanMutation.mutate(planToDelete)}
                disabled={deletePlanMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deletePlanMutation.isPending ? '刪除中...' : '確認刪除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ReadingReminderPopup
          open={showReminder}
          onOpenChange={setShowReminder}
          summary={reminderSummary}
          timeSlot={reminderTimeSlot}
        />

        <DevotionalAnalysisBatchDialog
          open={showBatchAnalysis}
          onOpenChange={setShowBatchAnalysis}
        />
      </div>
    </FeatureGate>
  );
};

function MyPlansView({
  plans,
  loading,
  getPlanProgress,
  onToggle,
  onDelete,
  onCreateClick,
}: {
  plans: UserReadingPlan[];
  loading: boolean;
  getPlanProgress: (plan: UserReadingPlan) => PlanProgress;
  onToggle: (id: string, isActive: boolean, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onCreateClick: () => void;
}) {
  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">載入中...</div>;
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">你還沒有任何讀經計劃</p>
          <Button onClick={onCreateClick} data-testid="button-create-first-plan">
            <Plus className="w-4 h-4 mr-1.5" />
            建立第一個計劃
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {plans.map((plan) => {
        const progress = getPlanProgress(plan);
        const formattedDate = new Date(plan.startDate).toLocaleDateString('zh-TW');
        return (
          <Link
            key={plan.id}
            to={`/learn/reading-plans/${plan.id}/read`}
            className="block"
            data-testid={`link-plan-${plan.id}`}
          >
            <Card className="hover-elevate cursor-pointer transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                      <span className="truncate">{plan.name}</span>
                      {plan.isActive ? (
                        <Badge variant="default">進行中</Badge>
                      ) : (
                        <Badge variant="secondary">已暫停</Badge>
                      )}
                      {progress.percentage >= 100 && (
                        <Badge variant="default" className="bg-green-600">已完成</Badge>
                      )}
                    </CardTitle>
                    {plan.description && (
                      <CardDescription className="mt-1 line-clamp-1">{plan.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => onToggle(plan.id, plan.isActive, e)}
                      data-testid={`button-toggle-plan-${plan.id}`}
                    >
                      {plan.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => onDelete(plan.id, e)}
                      data-testid={`button-delete-plan-${plan.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formattedDate} 開始
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {progress.completedDays} / {progress.totalDays} 天
                  </span>
                  <span>{progress.percentage}%</span>
                </div>
                <Progress value={progress.percentage} className="h-2" data-testid={`progress-plan-${plan.id}`} />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function CreatePlanView({
  bibleBooks,
  booksLoading,
  planName,
  setPlanName,
  planDescription,
  setPlanDescription,
  selectedBooks,
  addBook,
  removeBook,
  updateBookRange,
  chaptersPerDay,
  setChaptersPerDay,
  startDate,
  setStartDate,
  reminderEnabled,
  setReminderEnabled,
  reminderMorning,
  setReminderMorning,
  reminderNoon,
  setReminderNoon,
  reminderEvening,
  setReminderEvening,
  totalSelectedChapters,
  estimatedDays,
  canSubmit,
  isPending,
  onSubmit,
  isSupported,
  requestPermission,
  toast,
}: {
  bibleBooks: BibleBook[];
  booksLoading: boolean;
  planName: string;
  setPlanName: (v: string) => void;
  planDescription: string;
  setPlanDescription: (v: string) => void;
  selectedBooks: BookSelection[];
  addBook: (bookName: string) => void;
  removeBook: (bookName: string) => void;
  updateBookRange: (bookName: string, field: 'chapterStart' | 'chapterEnd', value: number) => void;
  chaptersPerDay: number;
  setChaptersPerDay: (v: number) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (v: boolean) => void;
  reminderMorning: string;
  setReminderMorning: (v: string) => void;
  reminderNoon: string;
  setReminderNoon: (v: string) => void;
  reminderEvening: string;
  setReminderEvening: (v: string) => void;
  totalSelectedChapters: number;
  estimatedDays: number;
  canSubmit: boolean;
  isPending: boolean;
  onSubmit: () => void;
  isSupported: boolean;
  requestPermission: () => Promise<boolean>;
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}) {
  const availableBooks = bibleBooks.filter(b => !selectedBooks.some(s => s.bookName === b.bookName));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">計劃名稱 *</Label>
            <Input
              id="plan-name"
              placeholder="例如：一年讀完新約"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              data-testid="input-plan-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-description">描述（選填）</Label>
            <Input
              id="plan-description"
              placeholder="計劃描述..."
              value={planDescription}
              onChange={(e) => setPlanDescription(e.target.value)}
              data-testid="input-plan-description"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">選擇書卷</CardTitle>
          <CardDescription>選擇要閱讀的聖經書卷和章節範圍</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {booksLoading ? (
            <div className="text-center py-4 text-muted-foreground">載入書卷列表...</div>
          ) : (
            <div className="space-y-2">
              <Label>新增書卷</Label>
              <Select onValueChange={addBook} value="" data-testid="select-add-book">
                <SelectTrigger data-testid="select-add-book-trigger">
                  <SelectValue placeholder="選擇書卷..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBooks.map((book) => (
                    <SelectItem key={book.bookNumber} value={book.bookName}>
                      {book.bookName}（{book.chapterCount} 章）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedBooks.length > 0 && (
            <div className="space-y-3">
              <Label>已選書卷</Label>
              {selectedBooks.map((sel) => {
                const bookInfo = bibleBooks.find(b => b.bookName === sel.bookName);
                const maxChapter = bookInfo?.chapterCount || sel.chapterEnd;
                return (
                  <Card key={sel.bookName} className="bg-muted/30">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-medium text-sm">{sel.bookName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBook(sel.bookName)}
                          data-testid={`button-remove-book-${sel.bookName}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">第</span>
                        <Input
                          type="number"
                          min={1}
                          max={sel.chapterEnd}
                          value={sel.chapterStart}
                          onChange={(e) => updateBookRange(sel.bookName, 'chapterStart', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20"
                          data-testid={`input-chapter-start-${sel.bookName}`}
                        />
                        <span className="text-muted-foreground">到</span>
                        <Input
                          type="number"
                          min={sel.chapterStart}
                          max={maxChapter}
                          value={sel.chapterEnd}
                          onChange={(e) => updateBookRange(sel.bookName, 'chapterEnd', Math.min(maxChapter, parseInt(e.target.value) || maxChapter))}
                          className="w-20"
                          data-testid={`input-chapter-end-${sel.bookName}`}
                        />
                        <span className="text-muted-foreground">章（共 {sel.chapterEnd - sel.chapterStart + 1} 章）</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {selectedBooks.length === 0 && !booksLoading && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              請選擇至少一卷書
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">計劃設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chapters-per-day">每日章數</Label>
              <Input
                id="chapters-per-day"
                type="number"
                min={1}
                max={50}
                value={chaptersPerDay}
                onChange={(e) => setChaptersPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                data-testid="input-chapters-per-day"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date">開始日期</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
          </div>

          {totalSelectedChapters > 0 && (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
              <span>共 <strong className="text-foreground">{totalSelectedChapters}</strong> 章</span>
              <span>預計 <strong className="text-foreground">{estimatedDays}</strong> 天完成</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">提醒設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="reminder-switch">啟用提醒</Label>
              <p className="text-sm text-muted-foreground">每日提醒你完成讀經進度</p>
            </div>
            <Switch
              id="reminder-switch"
              checked={reminderEnabled}
              onCheckedChange={async (checked) => {
                if (checked && isSupported) {
                  const granted = await requestPermission();
                  if (!granted) {
                    toast({ title: '無法啟用提醒', description: '請在瀏覽器設定中允許通知權限', variant: 'destructive' });
                    return;
                  }
                }
                setReminderEnabled(checked);
              }}
              data-testid="switch-reminder"
            />
          </div>
          {reminderEnabled && (
            <div className="space-y-3">
              <Label>提醒時段</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">早上</Label>
                  <Input
                    type="time"
                    value={reminderMorning}
                    onChange={(e) => setReminderMorning(e.target.value)}
                    data-testid="input-reminder-morning"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">中午</Label>
                  <Input
                    type="time"
                    value={reminderNoon}
                    onChange={(e) => setReminderNoon(e.target.value)}
                    data-testid="input-reminder-noon"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">晚上</Label>
                  <Input
                    type="time"
                    value={reminderEvening}
                    onChange={(e) => setReminderEvening(e.target.value)}
                    data-testid="input-reminder-evening"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">設定三個時段的提醒時間</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full"
        size="lg"
        disabled={!canSubmit || isPending}
        onClick={onSubmit}
        data-testid="button-create-plan"
      >
        {isPending ? '建立中...' : '建立讀經計劃'}
      </Button>
    </div>
  );
}

function BrowseTemplatesView({
  templates,
  loading,
}: {
  templates: ReadingPlanTemplate[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">載入中...</div>;
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Library className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">暫無讀經計劃範本</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-sm">選擇一個範本快速開始讀經計劃</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className="hover-elevate cursor-pointer transition-all"
            data-testid={`card-template-${template.id}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {template.name}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
              {template.description && (
                <CardDescription>{template.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {template.durationDays} 天
                </Badge>
                {template.category && (
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default ReadingPlansPage;
