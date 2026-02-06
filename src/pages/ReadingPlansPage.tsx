import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Clock, ChevronRight, X, CheckCircle2, AlertCircle, Play, Pause, RotateCcw, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FeatureGate } from '@/components/ui/feature-gate';

interface ReadingPlan {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  category: string | null;
  isPublic: boolean;
}

interface ReadingPlanItem {
  id: number;
  templateId: string;
  dayNumber: number;
  title: string | null;
  scriptureReference: string | null;
  notes: string | null;
}

interface UserProgress {
  planId: string;
  startDate: string;
  completedDays: number[];
  isPaused: boolean;
}

const STORAGE_KEY = 'wechurch_reading_progress';

const getStoredProgress = (): Record<string, UserProgress> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveProgress = (progress: Record<string, UserProgress>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};

const ReadingPlansPage = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [viewMode, setViewMode] = useState<'browse' | 'my-plans'>('browse');
  const { toast } = useToast();

  useEffect(() => {
    setUserProgress(getStoredProgress());
  }, []);

  const { data: plans = [], isLoading: plansLoading, isError: plansError } = useQuery<ReadingPlan[]>({
    queryKey: ['/api/reading-plans'],
  });

  const { data: planItems = [], isLoading: itemsLoading, isError: itemsError } = useQuery<ReadingPlanItem[]>({
    queryKey: ['/api/reading-plans', selectedPlanId, 'items'],
    queryFn: async () => {
      const res = await fetch(`/api/reading-plans/${selectedPlanId}/items`);
      if (!res.ok) throw new Error('Failed to fetch plan items');
      return res.json();
    },
    enabled: !!selectedPlanId,
  });

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const currentProgress = selectedPlanId ? userProgress[selectedPlanId] : null;
  const myPlans = plans.filter(p => userProgress[p.id]);

  const startPlan = (planId: string) => {
    const newProgress = {
      ...userProgress,
      [planId]: {
        planId,
        startDate: new Date().toISOString(),
        completedDays: [],
        isPaused: false,
      },
    };
    setUserProgress(newProgress);
    saveProgress(newProgress);
    toast({
      title: "已開始計劃",
      description: "祝你靈修愉快！",
    });
  };

  const toggleDayComplete = (dayNumber: number) => {
    if (!selectedPlanId || !currentProgress) return;
    
    const completedDays = currentProgress.completedDays.includes(dayNumber)
      ? currentProgress.completedDays.filter(d => d !== dayNumber)
      : [...currentProgress.completedDays, dayNumber];
    
    const newProgress = {
      ...userProgress,
      [selectedPlanId]: {
        ...currentProgress,
        completedDays,
      },
    };
    setUserProgress(newProgress);
    saveProgress(newProgress);
  };

  const pausePlan = (planId: string) => {
    const progress = userProgress[planId];
    if (!progress) return;
    
    const newProgress = {
      ...userProgress,
      [planId]: {
        ...progress,
        isPaused: !progress.isPaused,
      },
    };
    setUserProgress(newProgress);
    saveProgress(newProgress);
    toast({
      title: progress.isPaused ? "已繼續計劃" : "已暫停計劃",
    });
  };

  const resetPlan = (planId: string) => {
    const newProgress = {
      ...userProgress,
      [planId]: {
        planId,
        startDate: new Date().toISOString(),
        completedDays: [],
        isPaused: false,
      },
    };
    setUserProgress(newProgress);
    saveProgress(newProgress);
    toast({
      title: "已重置計劃",
      description: "進度已清空",
    });
  };

  const removePlan = (planId: string) => {
    const newProgress = { ...userProgress };
    delete newProgress[planId];
    setUserProgress(newProgress);
    saveProgress(newProgress);
    toast({
      title: "已移除計劃",
    });
  };

  const getProgressPercentage = (planId: string, totalDays: number) => {
    const progress = userProgress[planId];
    if (!progress) return 0;
    return Math.round((progress.completedDays.length / totalDays) * 100);
  };

  return (
    <FeatureGate
      featureKeys={["we_learn", "reading_plans"]}
      title="讀經計劃功能維護中"
      description="讀經計劃功能目前暫時關閉，請稍後再試"
    >
    <div className="min-h-screen bg-background">
      <Header title="讀經計劃" subtitle="每日靈修" variant="compact" />
      
      <main className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="max-w-3xl mx-auto">
          {selectedPlan ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedPlan.name}</h2>
                  <p className="text-muted-foreground text-sm">{selectedPlan.description}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlanId(null)}>
                  <X className="w-4 h-4 mr-1" />
                  返回列表
                </Button>
              </div>

              {currentProgress && (
                <Card className="mb-4">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">進度：{currentProgress.completedDays.length} / {selectedPlan.durationDays} 天</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pausePlan(selectedPlan.id)}
                        >
                          {currentProgress.isPaused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                          {currentProgress.isPaused ? '繼續' : '暫停'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetPlan(selectedPlan.id)}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          重置
                        </Button>
                      </div>
                    </div>
                    <Progress value={getProgressPercentage(selectedPlan.id, selectedPlan.durationDays)} className="h-2" />
                  </CardContent>
                </Card>
              )}

              {!currentProgress && (
                <Card className="mb-4">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">開始這個計劃追蹤你的進度</span>
                      <Button onClick={() => startPlan(selectedPlan.id)}>
                        <Play className="w-4 h-4 mr-1" />
                        開始計劃
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="py-4">
                  {itemsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">載入中...</div>
                  ) : itemsError ? (
                    <div className="text-center py-8 text-destructive flex flex-col items-center gap-2">
                      <AlertCircle className="w-6 h-6" />
                      <span>載入計劃內容時發生錯誤</span>
                    </div>
                  ) : planItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">暫無計劃內容</div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {planItems.map((item) => {
                          const isCompleted = currentProgress?.completedDays.includes(item.dayNumber);
                          return (
                            <Card 
                              key={item.id} 
                              className={`transition-all ${isCompleted ? 'bg-primary/10 border-primary/30' : 'bg-muted/30'} ${currentProgress ? 'cursor-pointer hover-elevate' : ''}`}
                              onClick={() => currentProgress && toggleDayComplete(item.dayNumber)}
                            >
                              <CardContent className="py-3">
                                <div className="flex items-start gap-3">
                                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? 'bg-primary text-white' : 'bg-primary/10'}`}>
                                    {isCompleted ? (
                                      <Check className="w-5 h-5" />
                                    ) : (
                                      <span className="text-primary font-semibold text-sm">{item.dayNumber}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {item.title && (
                                      <h4 className={`font-medium mb-1 ${isCompleted ? 'text-primary' : 'text-foreground'}`}>{item.title}</h4>
                                    )}
                                    {item.scriptureReference && (
                                      <p className="text-sm text-primary mb-1">
                                        <BookOpen className="w-3 h-3 inline mr-1" />
                                        {item.scriptureReference}
                                      </p>
                                    )}
                                    {item.notes && (
                                      <p className="text-sm text-muted-foreground">{item.notes}</p>
                                    )}
                                  </div>
                                  {currentProgress && (
                                    <div className="flex-shrink-0">
                                      {isCompleted ? (
                                        <Badge variant="default" className="bg-primary">已完成</Badge>
                                      ) : (
                                        <Badge variant="outline">點擊完成</Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div>
              <div className="flex gap-2 mb-6">
                <Button
                  variant={viewMode === 'browse' ? 'default' : 'outline'}
                  onClick={() => setViewMode('browse')}
                >
                  瀏覽計劃
                </Button>
                <Button
                  variant={viewMode === 'my-plans' ? 'default' : 'outline'}
                  onClick={() => setViewMode('my-plans')}
                >
                  我的計劃 ({myPlans.length})
                </Button>
              </div>

              {viewMode === 'my-plans' ? (
                myPlans.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>你還沒有開始任何計劃</p>
                      <Button variant="link" onClick={() => setViewMode('browse')}>
                        瀏覽計劃
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {myPlans.map((plan) => {
                      const progress = userProgress[plan.id];
                      const percentage = getProgressPercentage(plan.id, plan.durationDays);
                      return (
                        <Card 
                          key={plan.id} 
                          className="hover-elevate cursor-pointer transition-all"
                          onClick={() => setSelectedPlanId(plan.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <CardTitle className="text-lg flex items-center gap-2">
                                  {plan.name}
                                  {progress.isPaused && <Badge variant="secondary">已暫停</Badge>}
                                  {percentage === 100 && <Badge variant="default" className="bg-green-500">已完成</Badge>}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  已完成 {progress.completedDays.length} / {plan.durationDays} 天
                                </CardDescription>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); removePlan(plan.id); }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <Progress value={percentage} className="h-2" />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )
              ) : (
                <>
                  <Card className="mb-6">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-primary" />
                        <span className="text-muted-foreground">選擇一個讀經計劃，開始你的靈修旅程</span>
                      </div>
                    </CardContent>
                  </Card>

                  {plansLoading ? (
                    <div className="text-center py-8 text-muted-foreground">載入中...</div>
                  ) : plansError ? (
                    <div className="text-center py-8 text-destructive flex flex-col items-center gap-2">
                      <AlertCircle className="w-6 h-6" />
                      <span>載入讀經計劃時發生錯誤</span>
                    </div>
                  ) : plans.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">暫無讀經計劃</div>
                  ) : (
                    <div className="grid gap-4">
                      {plans.map((plan) => {
                        const hasStarted = !!userProgress[plan.id];
                        const percentage = getProgressPercentage(plan.id, plan.durationDays);
                        return (
                          <Card 
                            key={plan.id} 
                            className="hover-elevate cursor-pointer transition-all"
                            onClick={() => setSelectedPlanId(plan.id)}
                            data-testid={`card-plan-${plan.id}`}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    {plan.name}
                                    {hasStarted && <Badge variant="secondary">進行中</Badge>}
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  </CardTitle>
                                  {plan.description && (
                                    <CardDescription className="mt-1">{plan.description}</CardDescription>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {plan.durationDays} 天
                                </Badge>
                                {plan.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {plan.category}
                                  </Badge>
                                )}
                              </div>
                              {hasStarted && <Progress value={percentage} className="h-2" />}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
    </FeatureGate>
  );
};

export default ReadingPlansPage;
