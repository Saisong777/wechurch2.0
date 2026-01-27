import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  Download,
  User,
  Sparkles,
  Heart,
  Eye,
  Dumbbell,
  Target,
  MessageCircle,
  Brain,
  FileText,
  ChevronRight,
  BarChart3,
  Clock,
  CheckCircle2,
  CalendarDays,
  FolderOpen,
  Copy
} from 'lucide-react';
import { format, startOfMonth, isThisMonth, subMonths, isSameMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { INSIGHT_CATEGORIES, InsightCategory } from '@/types/spiritual-fitness';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { parseReportContent, GroupReport } from './report-viewer/parse';
import { EnhancedSection } from './report-elements';
import { OverallReportCharts } from './report-viewer/OverallReportCharts';

interface AIReport {
  id: string;
  report_type: 'group' | 'overall';
  group_number: number | null;
  content: string;
  created_at: string;
}

interface SessionWithResponses {
  id: string;
  short_code: string | null;
  verse_reference: string;
  status: string;
  created_at: string;
  participant_count: number;
  responses: StudyResponseWithParticipant[];
  aiReports: AIReport[];
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

type TimeFilter = 'all' | 'this-month' | 'last-month' | 'older';

export const HistoryBrowser: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [selectedSession, setSelectedSession] = useState<SessionWithResponses | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'reports'>('notes');

  // Fetch all sessions with their responses
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['admin_history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, short_code, verse_reference, status, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;
      if (!sessionsData) return [];

      const sessionsWithData = await Promise.all(
        sessionsData.map(async (session) => {
          const [countResult, responsesResult, reportsResult] = await Promise.all([
            supabase
              .from('participants')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.id),
            supabase
              .from('study_responses_public')
              .select('*')
              .eq('session_id', session.id)
              .order('group_number', { ascending: true }),
            supabase
              .from('ai_reports')
              .select('id, report_type, group_number, content, created_at')
              .eq('session_id', session.id)
              .eq('status', 'COMPLETED')
              .order('group_number', { ascending: true, nullsFirst: false }),
          ]);

          return {
            ...session,
            participant_count: countResult.count || 0,
            responses: (responsesResult.data || []).map(r => ({
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
            aiReports: (reportsResult.data || []).map(r => ({
              id: r.id,
              report_type: r.report_type as 'group' | 'overall',
              group_number: r.group_number,
              content: r.content,
              created_at: r.created_at,
            })),
          };
        })
      );

      return sessionsWithData as SessionWithResponses[];
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Filter sessions by time
  const filterByTime = (session: SessionWithResponses) => {
    const sessionDate = new Date(session.created_at);
    const now = new Date();
    const lastMonth = subMonths(now, 1);

    switch (timeFilter) {
      case 'this-month':
        return isThisMonth(sessionDate);
      case 'last-month':
        return isSameMonth(sessionDate, lastMonth);
      case 'older':
        return sessionDate < startOfMonth(lastMonth);
      default:
        return true;
    }
  };

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return (sessions || []).filter(session => {
      const matchesSearch = 
        session.verse_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.short_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.responses.some(r => 
          r.participant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.title_phrase?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.core_insight_note?.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
      const matchesTime = filterByTime(session);

      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [sessions, searchTerm, filterStatus, timeFilter]);

  // Group sessions by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, SessionWithResponses[]> = {};
    
    filteredSessions.forEach(session => {
      const monthKey = format(new Date(session.created_at), 'yyyy-MM');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(session);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSessions]);

  // Statistics
  const stats = useMemo(() => {
    const allSessions = sessions || [];
    const thisMonthSessions = allSessions.filter(s => isThisMonth(new Date(s.created_at)));
    const totalNotes = allSessions.reduce((sum, s) => sum + s.responses.length, 0);
    const totalReports = allSessions.reduce((sum, s) => sum + s.aiReports.length, 0);

    return {
      totalSessions: allSessions.length,
      thisMonthSessions: thisMonthSessions.length,
      totalNotes,
      totalReports,
    };
  }, [sessions]);

  // Export to text
  const handleExport = (session: SessionWithResponses) => {
    let content = `查經記錄 - ${session.verse_reference}\n`;
    content += `日期：${format(new Date(session.created_at), 'yyyy/MM/dd HH:mm')}\n`;
    content += `參與人數：${session.participant_count}\n`;
    content += `${'='.repeat(50)}\n\n`;

    content += `【個人筆記】\n${'─'.repeat(25)}\n\n`;
    session.responses.forEach((response) => {
      content += `【${response.participant_name}】${response.group_number ? ` (第 ${response.group_number} 組)` : ''}\n`;
      if (response.title_phrase) content += `📌 1. 定標題：${response.title_phrase}\n`;
      if (response.heartbeat_verse) content += `💓 2. 心跳的時刻：${response.heartbeat_verse}\n`;
      if (response.observation) content += `👁 3. 查看聖經的資訊：${response.observation}\n`;
      if (response.core_insight_note) {
        const cat = INSIGHT_CATEGORIES.find(c => c.value === response.core_insight_category);
        content += `💪 4. 思想神的話${cat ? ` (${cat.emoji} ${cat.label})` : ''}：${response.core_insight_note}\n`;
      }
      if (response.scholars_note) content += `📖 5. 學長姐的話：${response.scholars_note}\n`;
      if (response.action_plan) content += `🎯 6. 我決定要這樣做：${response.action_plan}\n`;
      if (response.cool_down_note) content += `💬 7. 自由發揮：${response.cool_down_note}\n`;
      content += '\n';
    });

    if (session.aiReports.length > 0) {
      content += `\n【AI 整合分析】\n${'─'.repeat(25)}\n\n`;
      
      const groupReports = session.aiReports.filter(r => r.report_type === 'group');
      groupReports.forEach(report => {
        content += `🤖 第 ${report.group_number} 組 AI 摘要\n`;
        content += `${report.content}\n\n`;
      });
      
      const overallReport = session.aiReports.find(r => r.report_type === 'overall');
      if (overallReport) {
        content += `🌟 全體整合報告\n`;
        content += `${overallReport.content}\n\n`;
      }
    }

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  // Detail View
  if (selectedSession) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedSession(null)}
            className="gap-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            返回列表
          </Button>
        </div>

        {/* Session Header Card */}
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{selectedSession.verse_reference}</CardTitle>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(selectedSession.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {selectedSession.participant_count} 人參與
                  </span>
                  <Badge variant={selectedSession.status === 'completed' ? 'default' : 'secondary'}>
                    {selectedSession.status === 'completed' ? '已完成' : 
                     selectedSession.status === 'studying' ? '進行中' : '等待中'}
                  </Badge>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport(selectedSession)}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                匯出
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'reports')}>
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="notes" className="gap-2 text-base">
              <User className="w-4 h-4" />
              個人筆記
              <Badge variant="secondary" className="ml-1">
                {selectedSession.responses.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 text-base">
              <Brain className="w-4 h-4" />
              AI 報告
              <Badge variant="secondary" className="ml-1">
                {selectedSession.aiReports.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4">
            <ScrollArea className="h-[calc(100vh-420px)]">
              {selectedSession.responses.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">尚無筆記提交</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 pr-4">
                  {selectedSession.responses.map((response) => (
                    <ResponseCard key={response.id} response={response} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <ScrollArea className="h-[calc(100vh-420px)]">
              {selectedSession.aiReports.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Brain className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">尚無 AI 報告</p>
                  </CardContent>
                </Card>
              ) : (
                <HistoryReportsWithCharts reports={selectedSession.aiReports} />
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-secondary" />
          <h2 className="text-lg font-semibold">歷史查經資料</h2>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <FolderOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">總聚會數</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/20">
                <CalendarDays className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisMonthSessions}</p>
                <p className="text-xs text-muted-foreground">本月聚會</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <FileText className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalNotes}</p>
                <p className="text-xs text-muted-foreground">筆記總數</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalReports}</p>
                <p className="text-xs text-muted-foreground">AI 報告</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'all', label: '全部', icon: FolderOpen },
          { value: 'this-month', label: '本月', icon: Calendar },
          { value: 'last-month', label: '上月', icon: Clock },
          { value: 'older', label: '更早', icon: CalendarDays },
        ].map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={timeFilter === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeFilter(value as TimeFilter)}
            className="gap-1.5"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {/* Search and Filter */}
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
          <SelectTrigger className="w-full sm:w-[140px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="studying">進行中</SelectItem>
            <SelectItem value="waiting">等待中</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>找到 {filteredSessions.length} 場聚會</span>
      </div>

      {/* Sessions List Grouped by Month */}
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
        <ScrollArea className="h-[calc(100vh-520px)]">
          <div className="space-y-6 pr-4">
            {groupedByMonth.map(([monthKey, monthSessions]) => (
              <div key={monthKey}>
                {/* Month Header */}
                <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                  <CalendarDays className="w-4 h-4 text-secondary" />
                  <span className="font-medium">
                    {format(new Date(monthKey + '-01'), 'yyyy 年 M 月', { locale: zhTW })}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {monthSessions.length} 場
                  </Badge>
                </div>

                {/* Sessions Grid */}
                <div className="grid gap-3">
                  {monthSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onClick={() => setSelectedSession(session)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

// Session Card Component
const SessionCard: React.FC<{
  session: SessionWithResponses;
  onClick: () => void;
}> = ({ session, onClick }) => {
  return (
    <Card 
      className="cursor-pointer hover:border-secondary/50 hover:shadow-md transition-all group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-base truncate">{session.verse_reference}</span>
              <Badge 
                variant={session.status === 'completed' ? 'default' : 'secondary'}
                className="flex-shrink-0"
              >
                {session.status === 'completed' ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" />完成</>
                ) : session.status === 'studying' ? (
                  <><Clock className="w-3 h-3 mr-1" />進行中</>
                ) : '等待中'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(session.created_at), 'MM/dd HH:mm')}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {session.participant_count} 人
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {session.responses.length} 篇筆記
              </span>
              {session.aiReports.length > 0 && (
                <span className="flex items-center gap-1 text-secondary">
                  <Brain className="w-3.5 h-3.5" />
                  {session.aiReports.length} 份報告
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
};

// Response Card Component
const ResponseCard: React.FC<{
  response: StudyResponseWithParticipant;
}> = ({ response }) => {
  const selectedCategory = INSIGHT_CATEGORIES.find(
    c => c.value === response.core_insight_category
  );

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-secondary" />
          </div>
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
            <Sparkles className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
            <span><strong>定標題：</strong>{response.title_phrase}</span>
          </div>
        )}
        {response.heartbeat_verse && (
          <div className="flex items-start gap-2">
            <Heart className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
            <span><strong>抓心跳：</strong>{response.heartbeat_verse}</span>
          </div>
        )}
        {response.observation && (
          <div className="flex items-start gap-2">
            <Eye className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
            <span><strong>看現場：</strong>{response.observation}</span>
          </div>
        )}
        {response.core_insight_note && (
          <div className="flex items-start gap-2">
            <Dumbbell className="w-3.5 h-3.5 mt-0.5 text-secondary flex-shrink-0" />
            <span>
              <strong>練核心{selectedCategory ? ` (${selectedCategory.emoji})` : ''}：</strong>
              {response.core_insight_note}
            </span>
          </div>
        )}
        {response.scholars_note && (
          <div className="flex items-start gap-2">
            <BookOpen className="w-3.5 h-3.5 mt-0.5 text-secondary flex-shrink-0" />
            <span><strong>學長姐的話：</strong>{response.scholars_note}</span>
          </div>
        )}
        {response.action_plan && (
          <div className="flex items-start gap-2">
            <Target className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
            <span><strong>帶一招：</strong>{response.action_plan}</span>
          </div>
        )}
        {response.cool_down_note && (
          <div className="flex items-start gap-2">
            <MessageCircle className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
            <span><strong>自由發揮：</strong>{response.cool_down_note}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// History Reports with Charts Wrapper
interface HistoryReportsWithChartsProps {
  reports: AIReport[];
}

const HistoryReportsWithCharts: React.FC<HistoryReportsWithChartsProps> = ({ reports }) => {
  const groupReports = reports.filter(r => r.report_type === 'group' && r.group_number !== 0);
  const overallReport = reports.find(r => r.report_type === 'overall' || r.group_number === 0);
  
  // Parse group reports for chart visualization
  const parsedGroupReports: GroupReport[] = useMemo(() => {
    return groupReports.map(r => {
      const parsed = parseReportContent(r.content);
      const section: GroupReport = parsed[0] || {
        groupNumber: 0, members: '', verse: '', themes: '',
        observations: '', insights: '', applications: '', contributions: '', raw: ''
      };
      return {
        groupNumber: r.group_number || 0,
        members: section.members || '',
        verse: section.verse || '',
        themes: section.themes || '',
        observations: section.observations || '',
        insights: section.insights || '',
        applications: section.applications || '',
        contributions: section.contributions || '',
        raw: r.content,
      };
    });
  }, [groupReports]);
  
  // Parse overall report for chart
  const parsedOverallReport: GroupReport | undefined = useMemo(() => {
    if (!overallReport) return undefined;
    const parsed = parseReportContent(overallReport.content);
    const section: GroupReport = parsed[0] || {
      groupNumber: 0, members: '', verse: '', themes: '',
      observations: '', insights: '', applications: '', contributions: '', raw: ''
    };
    return {
      groupNumber: 0,
      members: section.members || '',
      verse: section.verse || '',
      themes: section.themes || '',
      observations: section.observations || '',
      insights: section.insights || '',
      applications: section.applications || '',
      contributions: section.contributions || '',
      raw: overallReport.content,
    };
  }, [overallReport]);
  
  const hasMultipleGroups = groupReports.length >= 2;
  
  return (
    <div className="space-y-6 pr-4">
      {/* Visualization Charts - only show if multiple groups exist */}
      {hasMultipleGroups && (
        <OverallReportCharts 
          groupReports={parsedGroupReports}
          overallReport={parsedOverallReport}
        />
      )}
      
      {/* Overall Report First - with enhanced formatting */}
      {reports
        .filter(r => r.report_type === 'overall' || r.group_number === 0)
        .map(report => (
          <HistoryReportSection 
            key={report.id}
            report={report}
            variant="overall"
          />
        ))}

      {/* Separator if both overall and group reports exist */}
      {reports.some(r => r.report_type === 'overall' || r.group_number === 0) &&
       reports.some(r => r.report_type === 'group' && r.group_number !== 0) && (
        <div className="relative py-2">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
            各組報告
          </span>
        </div>
      )}

      {/* Group Reports - with enhanced formatting */}
      {reports
        .filter(r => r.report_type === 'group' && r.group_number !== 0)
        .map(report => (
          <HistoryReportSection 
            key={report.id}
            report={report}
            variant="group"
          />
        ))}
    </div>
  );
};

// Enhanced AI Report Section for History Browser
interface HistoryReportSectionProps {
  report: AIReport;
  variant: 'overall' | 'group';
}

const HistoryReportSection: React.FC<HistoryReportSectionProps> = ({ report, variant }) => {
  const isOverall = variant === 'overall';
  
  // Parse the report content to extract structured sections
  const parsedSections = parseReportContent(report.content);
  const section = parsedSections[0]; // Use first parsed section
  
  const handleCopy = () => {
    navigator.clipboard.writeText(report.content);
    toast.success(isOverall ? '全體報告已複製！' : `第 ${report.group_number} 組報告已複製！`);
  };
  
  const hasStructuredContent = section && (section.themes || section.observations || section.insights || section.applications);
  
  return (
    <div className={cn(
      "rounded-xl overflow-hidden",
      isOverall 
        ? "ring-1 ring-accent/30 bg-gradient-to-br from-accent/5 to-secondary/5" 
        : "border border-secondary/20"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        isOverall 
          ? "bg-gradient-to-r from-accent/20 via-accent/10 to-secondary/10 border-b border-accent/20" 
          : "gradient-navy text-primary-foreground"
      )}>
        <div className="flex items-center gap-2">
          {isOverall ? (
            <BarChart3 className="w-5 h-5 text-accent" />
          ) : (
            <Users className="w-4 h-4" />
          )}
          <span className={cn(
            "font-semibold",
            isOverall && "text-accent"
          )}>
            {isOverall ? '📊 全會眾綜合分析' : `第 ${report.group_number} 組`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs",
            isOverall ? "text-muted-foreground" : "text-primary-foreground/70"
          )}>
            {format(new Date(report.created_at), 'MM/dd HH:mm')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              isOverall 
                ? "text-accent hover:bg-accent/20" 
                : "text-primary-foreground hover:bg-white/20"
            )}
            onClick={handleCopy}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Meta Info - Members & Verse */}
      {section && (section.members || section.verse) && (
        <div className={cn(
          "px-4 py-3 border-b",
          isOverall ? "bg-accent/5 border-accent/10" : "bg-muted/30 border-border/50"
        )}>
          {section.members && (
            <p className="text-sm flex flex-wrap items-start gap-2">
              <span className="font-medium shrink-0">👥 組員：</span>
              <span className="text-muted-foreground">
                {section.members.split(/[,，、]/).map((name, idx, arr) => (
                  <span key={idx}>
                    <span className="font-medium text-primary">{name.trim()}</span>
                    {idx < arr.length - 1 && <span className="text-muted-foreground">、</span>}
                  </span>
                ))}
              </span>
            </p>
          )}
          {section.verse && (
            <p className="text-sm text-muted-foreground mt-2 flex items-start gap-2">
              <span className="font-medium text-foreground shrink-0">📖 經文：</span>
              <span className="italic">{section.verse}</span>
            </p>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        {hasStructuredContent ? (
          <div className="space-y-4">
            {section.themes && (
              <EnhancedSection type="themes" content={section.themes} showKeywords={false} />
            )}
            {section.observations && (
              <EnhancedSection type="observations" content={section.observations} showKeywords={false} />
            )}
            {section.insights && (
              <EnhancedSection type="insights" content={section.insights} showQuotes={true} showKeywords={false} />
            )}
            {section.applications && (
              <EnhancedSection type="applications" content={section.applications} showKeywords={false} />
            )}
            {section.contributions && (
              <div className="p-4 border-l-4 rounded-r-lg bg-gradient-to-r from-accent/15 to-accent/5 border-accent">
                <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-accent">
                  <User className="w-4 h-4" />
                  👤 個人貢獻摘要
                </h3>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {section.contributions}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {report.content}
          </div>
        )}
      </div>
    </div>
  );
};
