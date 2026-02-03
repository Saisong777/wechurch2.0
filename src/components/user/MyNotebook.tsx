import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
    queryKey: ['/api/notebook', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/notebook?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to fetch notebook');
      const data = await res.json();
      return (data?.entries || []) as NotebookEntry[];
    },
    enabled: !!userEmail,
    staleTime: 60000,
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
          <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">尚無筆記記錄</h3>
          <p className="text-muted-foreground text-sm">
            參加靈魂健身房後，您的查經筆記會自動儲存在這裡
          </p>
        </CardContent>
      </Card>
    );
  }

  const getCategoryInfo = (category: InsightCategory | null) => {
    if (!category) return null;
    return INSIGHT_CATEGORIES.find(c => c.value === category);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">我的查經筆記</h2>
        <Badge variant="secondary">{entries.length} 篇</Badge>
      </div>

      {entries.map((entry) => {
        const isExpanded = expandedIds.has(entry.id);
        const categoryInfo = getCategoryInfo(entry.core_insight_category);
        
        return (
          <Card 
            key={entry.id} 
            className="overflow-hidden hover-elevate cursor-pointer"
            onClick={() => toggleExpand(entry.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(entry.session_date), 'yyyy年M月d日', { locale: zhTW })}
                  </div>
                  <CardTitle className="text-base font-medium truncate">
                    {entry.verse_reference}
                  </CardTitle>
                  {entry.title_phrase && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {entry.title_phrase}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-4 border-t">
                {entry.heartbeat_verse && (
                  <div className="flex gap-2">
                    <Heart className="w-4 h-4 text-red-500 shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-1">心動經文</p>
                      <p className="text-sm text-muted-foreground">{entry.heartbeat_verse}</p>
                    </div>
                  </div>
                )}

                {entry.observation && (
                  <div className="flex gap-2">
                    <Eye className="w-4 h-4 text-blue-500 shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-1">觀察</p>
                      <p className="text-sm text-muted-foreground">{entry.observation}</p>
                    </div>
                  </div>
                )}

                {categoryInfo && (
                  <div className="flex gap-2">
                    <Dumbbell className="w-4 h-4 text-orange-500 shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-1">核心訓練</p>
                      <Badge variant="outline" className="mb-1">
                        {categoryInfo.emoji} {categoryInfo.label}
                      </Badge>
                      {entry.core_insight_note && (
                        <p className="text-sm text-muted-foreground">{entry.core_insight_note}</p>
                      )}
                    </div>
                  </div>
                )}

                {entry.scholars_note && (
                  <div className="flex gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-1">學者分享</p>
                      <p className="text-sm text-muted-foreground">{entry.scholars_note}</p>
                    </div>
                  </div>
                )}

                {entry.action_plan && (
                  <div className="flex gap-2">
                    <Target className="w-4 h-4 text-green-500 shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-1">行動計劃</p>
                      <p className="text-sm text-muted-foreground">{entry.action_plan}</p>
                    </div>
                  </div>
                )}

                {entry.cool_down_note && (
                  <div className="flex gap-2">
                    <MessageCircle className="w-4 h-4 text-teal-500 shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium mb-1">緩和心得</p>
                      <p className="text-sm text-muted-foreground">{entry.cool_down_note}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};
