import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/contexts/SessionContext';
import { CheckCircle, Share2, Eye, Heart, Sparkles, BookOpen, Dumbbell, Target, MessageCircle, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudyResponse } from '@/hooks/useStudyResponse';
import { INSIGHT_CATEGORIES } from '@/types/spiritual-fitness';
import { GroupReportViewer } from './GroupReportViewer';
import { toast } from 'sonner';

interface SubmissionReviewProps {
  onEdit?: () => void;
}

export const SubmissionReview: React.FC<SubmissionReviewProps> = ({ onEdit }) => {
  const { currentUser, currentSession } = useSession();
  const { response, isLoading } = useStudyResponse({
    sessionId: currentSession?.id,
    userId: currentUser?.id,
    enabled: !!currentSession?.id && !!currentUser?.id,
  });
  const [activeTab, setActiveTab] = useState<'personal' | 'group'>('personal');

  // Show loading only briefly - if data never arrives, show recovery UI
  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card variant="highlight" className="text-center">
          <CardContent className="py-10 space-y-4">
            <div className="w-16 h-16 rounded-full gradient-gold mx-auto flex items-center justify-center glow-gold">
              <Loader2 className="w-8 h-8 text-secondary-foreground animate-spin" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">正在載入你的筆記…</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not loading but no response, show recovery UI
  if (!response) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card variant="highlight" className="text-center">
          <CardContent className="py-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center">
              <Pencil className="w-8 h-8 text-muted-foreground" />
            </div>

            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-bold text-foreground">找不到筆記資料</h2>
              <p className="text-muted-foreground">
                可能是資料尚未同步完成，請返回修改再按一次「完成」。
              </p>
            </div>

            {onEdit && (
              <div className="flex justify-center pt-2">
                <Button variant="gold" onClick={onEdit} className="gap-2">
                  <Pencil className="w-4 h-4" />
                  返回修改
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCategory = INSIGHT_CATEGORIES.find(c => c.value === response.core_insight_category);

  const phases = [
    {
      title: '🟢 暖身 Warm-up',
      color: 'border-green-500 bg-green-50/10',
      fields: [
        { key: 'title_phrase', label: '1. 定標題', icon: Sparkles, value: response.title_phrase },
        { key: 'heartbeat_verse', label: '2. 心跳的時刻', icon: Heart, value: response.heartbeat_verse },
        { key: 'observation', label: '3. 查看聖經的資訊', icon: Eye, value: response.observation },
      ],
    },
    {
      title: '🟡 重訓 Core Training',
      color: 'border-yellow-500 bg-yellow-50/10',
      fields: [
        { 
          key: 'core_insight', 
          label: `4. 思想神的話 ${selectedCategory ? `(${selectedCategory.emoji} ${selectedCategory.label})` : ''}`, 
          icon: Dumbbell, 
          value: response.core_insight_note 
        },
        { key: 'scholars_note', label: '5. 學長姐的話', icon: BookOpen, value: response.scholars_note },
      ],
    },
    {
      title: '🔵 伸展 Stretch',
      color: 'border-blue-500 bg-blue-50/10',
      fields: [
        { key: 'action_plan', label: '6. 我決定要這樣做', icon: Target, value: response.action_plan },
        { key: 'cool_down_note', label: '7. 自由發揮', icon: MessageCircle, value: response.cool_down_note },
      ],
    },
  ];

  const handleSharePersonal = async () => {
    const content = phases
      .map(phase => {
        const filledFields = phase.fields.filter(f => f.value);
        if (filledFields.length === 0) return '';
        return `${phase.title}\n${filledFields.map(f => `• ${f.label}: ${f.value}`).join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');
    
    const shareText = `📖 ${currentSession?.verseReference}\n第 ${currentUser?.groupNumber} 組\n\n${content}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Spiritual Fitness 筆記',
          text: shareText,
        });
      } catch {
        navigator.clipboard.writeText(shareText);
        toast.success('已複製到剪貼簿！');
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('已複製到剪貼簿！');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Tab Navigation between Personal and Group Report */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'personal' | 'group')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 sm:h-10">
          <TabsTrigger value="personal" className="gap-2 text-base sm:text-sm">
            <Dumbbell className="w-5 h-5 sm:w-4 sm:h-4" />
            我的筆記
          </TabsTrigger>
          <TabsTrigger value="group" className="gap-2 text-base sm:text-sm">
            <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" />
            小組報告
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2">
                <CardTitle className="text-xl sm:text-xl">您的 Spiritual Fitness 筆記</CardTitle>
                <div className="flex gap-2">
                  {onEdit && (
                    <Button variant="outline" size="default" onClick={onEdit} className="flex-1 sm:flex-none h-11 sm:h-9 text-base sm:text-sm touch-manipulation active:scale-[0.98]">
                      <Pencil className="w-5 h-5 sm:w-4 sm:h-4 mr-2" />
                      繼續編輯
                    </Button>
                  )}
                  <Button variant="outline" size="default" onClick={handleSharePersonal} className="flex-1 sm:flex-none h-11 sm:h-9 text-base sm:text-sm touch-manipulation active:scale-[0.98]">
                    <Share2 className="w-5 h-5 sm:w-4 sm:h-4 mr-2" />
                    分享
                  </Button>
                </div>
              </div>
              <div className="text-base sm:text-sm text-muted-foreground mt-2 sm:mt-0">
                <span className="font-medium text-foreground">{currentSession?.verseReference}</span>
                {' · '}
                <span>第 {currentUser?.groupNumber} 組</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6 space-y-5 sm:space-y-6">
              {phases.map((phase) => (
                <div key={phase.title} className={`rounded-lg border-l-4 p-4 ${phase.color}`}>
                  <h3 className="font-semibold text-base sm:text-sm mb-3">{phase.title}</h3>
                  <div className="space-y-4 sm:space-y-4">
                    {phase.fields.map(({ key, label, icon: Icon, value }) => {
                      if (!value) return null;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Icon className="w-5 h-5 sm:w-4 sm:h-4 text-secondary" />
                            <span className="text-base sm:text-sm font-medium">{label}</span>
                          </div>
                          <p className="text-base sm:text-sm text-foreground pl-7 sm:pl-6 whitespace-pre-wrap">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="group" className="mt-4">
          {currentSession?.id && currentUser?.groupNumber && (
            <GroupReportViewer
              sessionId={currentSession.id}
              groupNumber={currentUser.groupNumber}
              verseReference={currentSession.verseReference}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
