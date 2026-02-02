import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, BookOpen, Clock, ChevronRight, X, CheckCircle2 } from 'lucide-react';

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

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const difficultyLabels: Record<string, string> = {
  easy: '入門',
  medium: '進階',
  hard: '挑戰',
};

const ReadingPlansPage = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery<ReadingPlan[]>({
    queryKey: ['/api/reading-plans'],
  });

  const { data: planItems = [], isLoading: itemsLoading } = useQuery<ReadingPlanItem[]>({
    queryKey: ['/api/reading-plans', selectedPlanId, 'items'],
    enabled: !!selectedPlanId,
  });

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="min-h-screen bg-background">
      <Header title="讀經計劃" subtitle="每日靈修" />
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/learn" className="gap-2" data-testid="link-back-learn">
              <ArrowLeft className="w-4 h-4" />
              返回學習
            </Link>
          </Button>

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

              <Card>
                <CardContent className="py-4">
                  {itemsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">載入中...</div>
                  ) : planItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">暫無計劃內容</div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {planItems.map((item) => (
                          <Card key={item.id} className="bg-muted/30">
                            <CardContent className="py-3">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-primary font-semibold text-sm">{item.dayNumber}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  {item.title && (
                                    <h4 className="font-medium text-foreground mb-1">{item.title}</h4>
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
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div>
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
              ) : plans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暫無讀經計劃</div>
              ) : (
                <div className="grid gap-4">
                  {plans.map((plan) => (
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
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </CardTitle>
                            {plan.description && (
                              <CardDescription className="mt-1">{plan.description}</CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReadingPlansPage;
