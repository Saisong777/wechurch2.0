import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureGate } from '@/components/ui/feature-gate';
import { MyNotebook } from '@/components/user/MyNotebook';
import { useAuth } from '@/contexts/AuthContext';
import { BookMarked, ChevronDown, ChevronUp, Loader2, Calendar, Pencil, Heart, Eye, Dumbbell, Target, MessageCircle } from 'lucide-react';
import { INSIGHT_CATEGORIES, type InsightCategory } from '@/types/spiritual-fitness';
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
  const navigate = useNavigate();
  const filledCount = countFilledFields(note);
  const categoryInfo = getCategoryInfo(note.coreInsightCategory);

  return (
    <Card
      className="overflow-visible cursor-pointer hover-elevate"
      onClick={() => setExpanded(!expanded)}
      data-testid={`card-devotional-note-${note.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(note.updatedAt), 'yyyy年M月d日', { locale: zhTW })}
              {note.dayNumber && (
                <span>第 {note.dayNumber} 天</span>
              )}
            </div>
            <CardTitle className="text-base font-medium truncate">
              {note.verseReference}
            </CardTitle>
            {note.titlePhrase && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {note.titlePhrase}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs">
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

          {note.readingPlanId && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/learn/reading-plans/${note.readingPlanId}/read${note.dayNumber ? `?day=${note.dayNumber}` : ''}`);
                }}
                data-testid={`button-edit-note-${note.id}`}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                前往編輯
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

const MyNotesPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const userEmail = user?.email || localStorage.getItem('bible_study_guest_email') || '';

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
      featureKeys={["we_live", "notebook"]}
      title="筆記功能維護中"
      description="筆記功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background" data-testid="my-notes-page">
        <Header variant="compact" title="我的筆記" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8">
          <div className="max-w-2xl md:max-w-3xl mx-auto">
            <Tabs defaultValue="devotional" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6" data-testid="notes-tabs">
                <TabsTrigger value="devotional" data-testid="tab-devotional">
                  個人靈修
                </TabsTrigger>
                <TabsTrigger value="group-study" data-testid="tab-group-study">
                  共同查經
                </TabsTrigger>
              </TabsList>

              <TabsContent value="devotional" data-testid="tab-content-devotional">
                {notesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 w-full rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : !devotionalNotes || devotionalNotes.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2" data-testid="text-empty-devotional">尚無靈修筆記</h3>
                      <p className="text-muted-foreground text-sm">
                        開始讀經計劃後筆記會出現在這裡
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {devotionalNotes.map((note) => (
                      <DevotionalNoteCard key={note.id} note={note} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="group-study" data-testid="tab-content-group-study">
                <MyNotebook userEmail={userEmail} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default MyNotesPage;
