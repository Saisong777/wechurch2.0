import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Calendar, 
  Users, 
  BookOpen, 
  Filter,
  ChevronDown,
  Download,
  User,
  Sparkles,
  Heart,
  Eye,
  Dumbbell,
  Target,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { INSIGHT_CATEGORIES, InsightCategory } from '@/types/spiritual-fitness';
import { useAuth } from '@/contexts/AuthContext';

interface SessionWithResponses {
  id: string;
  short_code: string | null;
  verse_reference: string;
  status: string;
  created_at: string;
  participant_count: number;
  responses: StudyResponseWithParticipant[];
}

interface StudyResponseWithParticipant {
  id: string;
  participant_name: string;
  group_number: number | null;
  title_phrase: string | null;
  heartbeat_verse: string | null;
  observation: string | null;
  core_insight_category: InsightCategory | null;
  core_insight_note: string | null;
  scholars_note: string | null;
  action_plan: string | null;
  cool_down_note: string | null;
  created_at: string;
}

export const HistoryBrowser: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Fetch all sessions with their responses
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['admin_history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all sessions for this admin
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, short_code, verse_reference, status, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;
      if (!sessionsData) return [];

      // Get participant counts and responses for each session
      const sessionsWithData = await Promise.all(
        sessionsData.map(async (session) => {
          // Get participant count
          const { count } = await supabase
            .from('participants')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);

          // Get study responses with participant info
          const { data: responses } = await supabase
            .from('study_responses_public')
            .select('*')
            .eq('session_id', session.id)
            .order('group_number', { ascending: true });

          return {
            ...session,
            participant_count: count || 0,
            responses: (responses || []).map(r => ({
              id: r.id || '',
              participant_name: r.participant_name || 'Unknown',
              group_number: r.group_number,
              title_phrase: r.title_phrase,
              heartbeat_verse: r.heartbeat_verse,
              observation: r.observation,
              core_insight_category: r.core_insight_category as InsightCategory | null,
              core_insight_note: r.core_insight_note,
              scholars_note: r.scholars_note,
              action_plan: r.action_plan,
              cool_down_note: r.cool_down_note,
              created_at: r.created_at || '',
            })),
          };
        })
      );

      return sessionsWithData as SessionWithResponses[];
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Filter sessions
  const filteredSessions = (sessions || []).filter(session => {
    const matchesSearch = 
      session.verse_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.short_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.responses.some(r => 
        r.participant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.title_phrase?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.core_insight_note?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesStatus = filterStatus === 'all' || session.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Export to text
  const handleExport = (session: SessionWithResponses) => {
    let content = `查經記錄 - ${session.verse_reference}\n`;
    content += `日期：${format(new Date(session.created_at), 'yyyy/MM/dd HH:mm')}\n`;
    content += `參與人數：${session.participant_count}\n`;
    content += `${'='.repeat(50)}\n\n`;

    session.responses.forEach((response, index) => {
      content += `【${response.participant_name}】${response.group_number ? ` (第 ${response.group_number} 組)` : ''}\n`;
      if (response.title_phrase) content += `📌 定標題：${response.title_phrase}\n`;
      if (response.heartbeat_verse) content += `💓 抓心跳：${response.heartbeat_verse}\n`;
      if (response.observation) content += `👁 看現場：${response.observation}\n`;
      if (response.core_insight_note) {
        const cat = INSIGHT_CATEGORIES.find(c => c.value === response.core_insight_category);
        content += `💪 練核心${cat ? ` (${cat.emoji} ${cat.label})` : ''}：${response.core_insight_note}\n`;
      }
      if (response.scholars_note) content += `📖 學長姐的話：${response.scholars_note}\n`;
      if (response.action_plan) content += `🎯 帶一招：${response.action_plan}\n`;
      if (response.cool_down_note) content += `💬 自由發揮：${response.cool_down_note}\n`;
      content += '\n';
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `查經記錄_${session.verse_reference}_${format(new Date(session.created_at), 'yyyyMMdd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-secondary" />
          <h2 className="text-lg font-semibold">歷史查經資料</h2>
        </div>
        <Badge variant="secondary">{filteredSessions.length} 場聚會</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋經文、參與者、內容..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="studying">進行中</SelectItem>
            <SelectItem value="waiting">等待中</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              尚無歷史資料
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? '找不到符合條件的聚會' : '建立查經聚會後，資料會顯示在這裡'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-350px)]">
          <Accordion 
            type="single" 
            collapsible 
            value={expandedSession || undefined}
            onValueChange={(value) => setExpandedSession(value)}
            className="space-y-3 pr-4"
          >
            {filteredSessions.map((session) => (
              <AccordionItem 
                key={session.id} 
                value={session.id}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-start justify-between w-full mr-4">
                    <div className="text-left space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{session.verse_reference}</span>
                        <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                          {session.status === 'completed' ? '已完成' : 
                           session.status === 'studying' ? '進行中' : '等待中'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(session.created_at), 'yyyy/MM/dd', { locale: zhTW })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {session.participant_count} 人
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {session.responses.length} 篇筆記
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Export Button */}
                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleExport(session)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        匯出文字檔
                      </Button>
                    </div>

                    {/* Responses */}
                    {session.responses.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        尚無筆記提交
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {session.responses.map((response) => {
                          const selectedCategory = INSIGHT_CATEGORIES.find(
                            c => c.value === response.core_insight_category
                          );

                          return (
                            <Card key={response.id} className="bg-muted/30">
                              <CardHeader className="pb-2">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-secondary" />
                                  <span className="font-medium">{response.participant_name}</span>
                                  {response.group_number && (
                                    <Badge variant="outline" className="text-xs">
                                      第 {response.group_number} 組
                                    </Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0 space-y-2 text-sm">
                                {response.title_phrase && (
                                  <div className="flex items-start gap-2">
                                    <Sparkles className="w-3 h-3 mt-1 text-green-600" />
                                    <span><strong>定標題：</strong>{response.title_phrase}</span>
                                  </div>
                                )}
                                {response.heartbeat_verse && (
                                  <div className="flex items-start gap-2">
                                    <Heart className="w-3 h-3 mt-1 text-green-600" />
                                    <span><strong>抓心跳：</strong>{response.heartbeat_verse}</span>
                                  </div>
                                )}
                                {response.observation && (
                                  <div className="flex items-start gap-2">
                                    <Eye className="w-3 h-3 mt-1 text-green-600" />
                                    <span><strong>看現場：</strong>{response.observation}</span>
                                  </div>
                                )}
                                {response.core_insight_note && (
                                  <div className="flex items-start gap-2">
                                    <Dumbbell className="w-3 h-3 mt-1 text-yellow-600" />
                                    <span>
                                      <strong>練核心{selectedCategory ? ` (${selectedCategory.emoji})` : ''}：</strong>
                                      {response.core_insight_note}
                                    </span>
                                  </div>
                                )}
                                {response.scholars_note && (
                                  <div className="flex items-start gap-2">
                                    <BookOpen className="w-3 h-3 mt-1 text-yellow-600" />
                                    <span><strong>學長姐的話：</strong>{response.scholars_note}</span>
                                  </div>
                                )}
                                {response.action_plan && (
                                  <div className="flex items-start gap-2">
                                    <Target className="w-3 h-3 mt-1 text-blue-600" />
                                    <span><strong>帶一招：</strong>{response.action_plan}</span>
                                  </div>
                                )}
                                {response.cool_down_note && (
                                  <div className="flex items-start gap-2">
                                    <MessageCircle className="w-3 h-3 mt-1 text-blue-600" />
                                    <span><strong>自由發揮：</strong>{response.cool_down_note}</span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      )}
    </div>
  );
};
