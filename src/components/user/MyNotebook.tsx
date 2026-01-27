import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Heart, 
  Sparkles, 
  Eye, 
  Dumbbell, 
  Target, 
  MessageCircle,
  BookMarked
} from 'lucide-react';
import { INSIGHT_CATEGORIES, InsightCategory } from '@/types/spiritual-fitness';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface NotebookEntry {
  id: string;
  session_id: string;
  verse_reference: string;
  session_date: string;
  title_phrase: string | null;
  heartbeat_verse: string | null;
  observation: string | null;
  core_insight_category: InsightCategory | null;
  core_insight_note: string | null;
  scholars_note: string | null;
  action_plan: string | null;
  cool_down_note: string | null;
}

interface MyNotebookProps {
  userEmail: string;
}

export const MyNotebook: React.FC<MyNotebookProps> = ({ userEmail }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: entries, isLoading } = useQuery({
    queryKey: ['my_notebook', userEmail],
    queryFn: async () => {
      // Use edge function to fetch user's historical notes securely
      const { data, error } = await supabase.functions.invoke('get-user-notebook', {
        body: { email: userEmail },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return (data?.entries || []) as NotebookEntry[];
    },
    enabled: !!userEmail,
    staleTime: 60000, // 1 minute
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <BookMarked className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            尚無筆記
          </h3>
          <p className="text-sm text-muted-foreground">
            參加查經課程後，您的筆記會自動保存在這裡
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-secondary" />
          <h2 className="text-lg font-semibold">我的筆記本</h2>
        </div>
        <Badge variant="secondary">{entries.length} 篇筆記</Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="space-y-3 pr-4">
          {entries.map((entry) => {
            const isExpanded = expandedIds.has(entry.id);
            const selectedCategory = INSIGHT_CATEGORIES.find(
              c => c.value === entry.core_insight_category
            );

            return (
              <Card 
                key={entry.id} 
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => toggleExpand(entry.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-secondary" />
                        {entry.verse_reference}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(entry.session_date), 'yyyy/MM/dd (EEEE)', { locale: zhTW })}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Preview when collapsed */}
                  {!isExpanded && entry.title_phrase && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                      📌 {entry.title_phrase}
                    </p>
                  )}
                </CardHeader>

                {/* Expanded content */}
                {isExpanded && (
                  <CardContent className="pt-0 space-y-4" onClick={e => e.stopPropagation()}>
                    {/* Phase 1: Warm-up */}
                    {(entry.title_phrase || entry.heartbeat_verse || entry.observation) && (
                      <div className="rounded-lg border-l-4 border-green-500 bg-green-50/10 p-3 space-y-2">
                        <h4 className="font-medium text-sm text-green-600">🟢 暖身</h4>
                        {entry.title_phrase && (
                          <div className="flex items-start gap-2 text-sm">
                            <Sparkles className="w-4 h-4 text-secondary mt-0.5" />
                            <div>
                              <span className="font-medium">定標題：</span>
                              <span className="text-muted-foreground">{entry.title_phrase}</span>
                            </div>
                          </div>
                        )}
                        {entry.heartbeat_verse && (
                          <div className="flex items-start gap-2 text-sm">
                            <Heart className="w-4 h-4 text-secondary mt-0.5" />
                            <div>
                              <span className="font-medium">抓心跳：</span>
                              <span className="text-muted-foreground">{entry.heartbeat_verse}</span>
                            </div>
                          </div>
                        )}
                        {entry.observation && (
                          <div className="flex items-start gap-2 text-sm">
                            <Eye className="w-4 h-4 text-secondary mt-0.5" />
                            <div>
                              <span className="font-medium">看現場：</span>
                              <span className="text-muted-foreground">{entry.observation}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Phase 2: Core Training */}
                    {(entry.core_insight_note || entry.scholars_note) && (
                      <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50/10 p-3 space-y-2">
                        <h4 className="font-medium text-sm text-yellow-600">🟡 重訓</h4>
                        {entry.core_insight_note && (
                          <div className="flex items-start gap-2 text-sm">
                            <Dumbbell className="w-4 h-4 text-secondary mt-0.5" />
                            <div>
                              <span className="font-medium">
                                練核心{selectedCategory ? ` (${selectedCategory.emoji} ${selectedCategory.label})` : ''}：
                              </span>
                              <span className="text-muted-foreground">{entry.core_insight_note}</span>
                            </div>
                          </div>
                        )}
                        {entry.scholars_note && (
                          <div className="flex items-start gap-2 text-sm">
                            <BookOpen className="w-4 h-4 text-secondary mt-0.5" />
                            <div>
                              <span className="font-medium">學長姐的話：</span>
                              <span className="text-muted-foreground">{entry.scholars_note}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Phase 3: Stretch */}
                    {(entry.action_plan || entry.cool_down_note) && (
                      <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50/10 p-3 space-y-2">
                        <h4 className="font-medium text-sm text-blue-600">🔵 伸展</h4>
                        {entry.action_plan && (
                          <div className="flex items-start gap-2 text-sm">
                            <Target className="w-4 h-4 text-secondary mt-0.5" />
                            <div>
                              <span className="font-medium">帶一招：</span>
                              <span className="text-muted-foreground">{entry.action_plan}</span>
                            </div>
                          </div>
                        )}
                        {entry.cool_down_note && (
                          <div className="flex items-start gap-2 text-sm">
                            <MessageCircle className="w-4 h-4 text-secondary mt-0.5" />
                            <div>
                              <span className="font-medium">自由發揮：</span>
                              <span className="text-muted-foreground">{entry.cool_down_note}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
