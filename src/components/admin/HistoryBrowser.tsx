import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { queryClient } from '@/lib/queryClient';
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
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Clock,
  CheckCircle2,
  CalendarDays,
  FolderOpen,
  Copy,
  Trash2,
  Presentation,
  X,
  Pencil,
  Church,
  Save,
  ChevronsUpDown,
  Building2,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { format, startOfMonth, isThisMonth, subMonths, isSameMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { INSIGHT_CATEGORIES, InsightCategory, parseCategories, parseNotes } from '@/types/spiritual-fitness';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { parseReportContent, GroupReport } from './report-viewer/parse';
import { EnhancedSection } from './report-elements';
import { OverallReportCharts } from './report-viewer/OverallReportCharts';

interface AIReport {
  id: string;
  reportType: 'group' | 'overall';
  groupNumber: number | null;
  content: string;
  createdAt: string;
  status?: string;
}

interface SessionMetadata {
  id: string;
  shortCode: string | null;
  verseReference: string;
  status: string;
  createdAt: string;
  participantCount: number;
  churchUnit: string | null;
}

interface SessionWithResponses extends SessionMetadata {
  responses: StudyResponseWithParticipant[];
  aiReports: AIReport[];
}

interface StudyResponseWithParticipant {
  id: string;
  participantName: string;
  groupNumber: number | null;
  titlePhrase: string | null;
  heartbeatVerse: string | null;
  observation: string | null;
  coreInsightCategory: InsightCategory | null;
  coreInsightNote: string | null;
  scholarsNote: string | null;
  actionPlan: string | null;
  coolDownNote: string | null;
  createdAt: string;
}

type TimeFilter = 'all' | 'this-month' | 'last-month' | 'older';
type GroupByMode = 'month' | 'churchUnit';

export const HistoryBrowser: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChurchUnit, setFilterChurchUnit] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('month');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'groups' | 'reports'>('notes');
  const [notesSearchTerm, setNotesSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedListGroups, setCollapsedListGroups] = useState<Record<string, boolean>>({});
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editingSession, setEditingSession] = useState<SessionMetadata | null>(null);
  const [editVerseReference, setEditVerseReference] = useState('');
  const [editChurchUnit, setEditChurchUnit] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toggleGroup = (groupNum: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupNum]: !prev[groupNum]
    }));
  };

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['admin_history_sessions'],
    queryFn: async (): Promise<SessionMetadata[]> => {
      const sessionsRes = await fetch('/api/sessions');
      if (!sessionsRes.ok) throw new Error('Failed to fetch sessions');
      const sessionsData = await sessionsRes.json();
      return sessionsData.map((session: any) => ({
        id: session.id,
        shortCode: session.shortCode,
        verseReference: session.verseReference,
        status: session.status,
        createdAt: session.createdAt,
        participantCount: session.participantCount || 0,
        churchUnit: session.churchUnit || null,
      }));
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const { data: sessionDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['admin_history_detail', selectedSessionId],
    queryFn: async (): Promise<SessionWithResponses | null> => {
      if (!selectedSessionId) return null;
      const sessionMeta = sessions?.find(s => s.id === selectedSessionId);
      if (!sessionMeta) return null;

      const [responsesRes, reportsRes] = await Promise.all([
        fetch(`/api/sessions/${selectedSessionId}/study-responses`),
        fetch(`/api/sessions/${selectedSessionId}/reports`),
      ]);

      const responses = responsesRes.ok ? await responsesRes.json() : [];
      const reports = reportsRes.ok ? await reportsRes.json() : [];

      return {
        ...sessionMeta,
        responses: (responses || []).map((r: any) => ({
          id: r.id || '',
          participantName: r.participantName || 'Unknown',
          groupNumber: r.groupNumber,
          titlePhrase: r.titlePhrase,
          heartbeatVerse: r.heartbeatVerse,
          observation: r.observation,
          coreInsightCategory: r.coreInsightCategory as InsightCategory | null,
          coreInsightNote: r.coreInsightNote,
          scholarsNote: r.scholarsNote,
          actionPlan: r.actionPlan,
          coolDownNote: r.coolDownNote,
          createdAt: r.createdAt || '',
        })),
        aiReports: (reports || [])
          .map((r: any) => ({
            id: r.id,
            reportType: r.reportType as 'group' | 'overall',
            groupNumber: r.groupNumber,
            content: r.content,
            createdAt: r.createdAt,
            status: r.status,
          }))
          .filter((r: any) => r.status === 'COMPLETED'),
      };
    },
    enabled: !!selectedSessionId && !!sessions,
    staleTime: 60000,
  });

  const selectedSession = sessionDetail || null;

  // Group responses by group number for the selected session
  const groupedResponses = useMemo(() => {
    if (!selectedSession) return {};
    
    const filtered = selectedSession.responses.filter(r => {
      if (!notesSearchTerm) return true;
      const query = notesSearchTerm.toLowerCase();
      return (
        r.participantName.toLowerCase().includes(query) ||
        (r.titlePhrase?.toLowerCase().includes(query) || '') ||
        (r.coreInsightNote?.toLowerCase().includes(query) || '') ||
        (r.actionPlan?.toLowerCase().includes(query) || '')
      );
    });

    const groups: Record<number, StudyResponseWithParticipant[]> = {};
    filtered.forEach(r => {
      const g = r.groupNumber || 0;
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    });
    return groups;
  }, [selectedSession, notesSearchTerm]);

  const presentationSlides = useMemo(() => {
    if (!selectedSession || selectedSession.aiReports.length === 0) return [];
    const slides: { type: 'title' | 'content' | 'end'; title?: string; subtitle?: string; section?: GroupReport }[] = [];
    slides.push({ type: 'title', title: '查經分析報告', subtitle: selectedSession.verseReference || '靈魂健身房' });
    const overallReport = selectedSession.aiReports.find(r => r.reportType === 'overall' || r.groupNumber === 0);
    if (overallReport) {
      const parsed = parseReportContent(overallReport.content);
      slides.push({ type: 'content', title: '全會眾綜合分析', section: parsed[0] });
    }
    const groupReportsSorted = selectedSession.aiReports
      .filter(r => r.reportType === 'group' && r.groupNumber !== 0)
      .sort((a, b) => (a.groupNumber || 0) - (b.groupNumber || 0));
    for (const report of groupReportsSorted) {
      const parsed = parseReportContent(report.content);
      slides.push({ type: 'content', title: `第 ${report.groupNumber} 組`, section: parsed[0] });
    }
    slides.push({ type: 'end', title: '感謝參與', subtitle: '願神的話語常存在我們心中' });
    return slides;
  }, [selectedSession]);

  React.useEffect(() => {
    if (!presentationMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, presentationSlides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setPresentationMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentationMode, presentationSlides.length]);

  const filterByTime = (session: SessionMetadata) => {
    const sessionDate = new Date(session.createdAt);
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

  const filteredSessions = useMemo(() => {
    return (sessions || []).filter(session => {
      const matchesSearch = 
        session.verseReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.shortCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (session.churchUnit?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
      const matchesTime = filterByTime(session);
      const matchesChurchUnit = filterChurchUnit === 'all' || 
        (filterChurchUnit === '__none__' ? !session.churchUnit : session.churchUnit === filterChurchUnit);

      return matchesSearch && matchesStatus && matchesTime && matchesChurchUnit;
    });
  }, [sessions, searchTerm, filterStatus, filterChurchUnit, timeFilter]);

  const uniqueChurchUnits = useMemo(() => {
    const units = new Set<string>();
    (sessions || []).forEach(s => {
      if (s.churchUnit) units.add(s.churchUnit);
    });
    return Array.from(units).sort();
  }, [sessions]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, SessionMetadata[]> = {};
    
    filteredSessions.forEach(session => {
      const monthKey = format(new Date(session.createdAt), 'yyyy-MM');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(session);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSessions]);

  const groupedByChurchUnit = useMemo(() => {
    const groups: Record<string, SessionMetadata[]> = {};
    
    filteredSessions.forEach(session => {
      const key = session.churchUnit || '未分類';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(session);
    });

    return Object.entries(groups).sort((a, b) => {
      if (a[0] === '未分類') return 1;
      if (b[0] === '未分類') return -1;
      return a[0].localeCompare(b[0], 'zh-TW');
    });
  }, [filteredSessions]);

  const displayGroups = groupByMode === 'month' ? groupedByMonth : groupedByChurchUnit;

  const toggleListGroup = (key: string) => {
    setCollapsedListGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const collapseAll = () => {
    const allKeys: Record<string, boolean> = {};
    displayGroups.forEach(([key]) => { allKeys[key] = true; });
    setCollapsedListGroups(allKeys);
  };

  const expandAll = () => {
    setCollapsedListGroups({});
  };

  const stats = useMemo(() => {
    const allSessions = sessions || [];
    const thisMonthSessions = allSessions.filter(s => isThisMonth(new Date(s.createdAt)));

    return {
      totalSessions: allSessions.length,
      thisMonthSessions: thisMonthSessions.length,
    };
  }, [sessions]);

  const handleDeleteReport = async (reportId: string, sessionId: string) => {
    if (!confirm('確定要刪除此報告嗎？')) return;
    
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('刪除失敗');
      
      toast.success('報告已刪除');
      queryClient.invalidateQueries({ queryKey: ['admin_history_detail', selectedSessionId] });
    } catch (err) {
      console.error('Error deleting report:', err);
      toast.error('刪除失敗');
    }
  };

  const handleDeleteResponse = async (responseId: string) => {
    if (!confirm('確定要刪除此筆記嗎？此操作無法復原。')) return;
    
    try {
      const res = await fetch(`/api/study-responses/${responseId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('刪除失敗');
      
      toast.success('筆記已刪除');
      queryClient.invalidateQueries({ queryKey: ['admin_history_detail', selectedSessionId] });
    } catch (err) {
      console.error('Error deleting response:', err);
      toast.error('刪除失敗');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('確定要刪除此聚會嗎？所有相關的筆記和報告都會一併刪除，此操作無法復原。')) return;
    
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('刪除失敗');
      
      toast.success('聚會已刪除');
      queryClient.invalidateQueries({ queryKey: ['admin_history_sessions'] });
    } catch (err) {
      console.error('Error deleting session:', err);
      toast.error('刪除失敗');
    }
  };

  const handleEditSession = (session: SessionMetadata) => {
    setEditingSession(session);
    setEditVerseReference(session.verseReference);
    setEditChurchUnit(session.churchUnit || '');
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    if (!editVerseReference.trim()) {
      toast.error('經文不能為空');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/sessions/${editingSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verseReference: editVerseReference.trim(),
          churchUnit: editChurchUnit.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('更新失敗');
      
      toast.success('已更新聚會資料');
      setEditingSession(null);
      queryClient.invalidateQueries({ queryKey: ['admin_history_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin_history_detail', editingSession.id] });
    } catch (err) {
      console.error('Error updating session:', err);
      toast.error('更新失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to text
  const handleExport = (session: SessionWithResponses) => {
    let content = `查經記錄 - ${session.verseReference}\n`;
    content += `日期：${format(new Date(session.createdAt), 'yyyy/MM/dd HH:mm')}\n`;
    content += `參與人數：${session.participantCount}\n`;
    content += `${'='.repeat(50)}\n\n`;

    content += `【個人筆記】\n${'─'.repeat(25)}\n\n`;
    session.responses.forEach((response) => {
      content += `【${response.participantName}】${response.groupNumber ? ` (第 ${response.groupNumber} 組)` : ''}\n`;
      if (response.titlePhrase) content += `📌 1. 標題分段：${response.titlePhrase}\n`;
      if (response.heartbeatVerse) content += `💓 2. 最感動的經文：${response.heartbeatVerse}\n`;
      if (response.observation) content += `👁 3. 經文上的資訊：${response.observation}\n`;
      if (response.coreInsightNote) {
        const cats = parseCategories(response.coreInsightCategory as any);
        const notes = parseNotes(response.coreInsightNote as any, cats);
        if (cats.length > 0) {
          cats.forEach(catVal => {
            const cat = INSIGHT_CATEGORIES.find(c => c.value === catVal);
            const noteText = notes[catVal] || '';
            if (noteText) {
              content += `💪 4. 思想神的話 (${cat?.label || catVal})：${noteText}\n`;
            }
          });
        } else {
          content += `💪 4. 思想神的話：${typeof response.coreInsightNote === 'string' ? response.coreInsightNote : ''}\n`;
        }
      }
      if (response.scholarsNote) content += `📖 5. 注釋書或其他的參考資料：${response.scholarsNote}\n`;
      if (response.actionPlan) content += `🎯 6. 與神同行的行動：${response.actionPlan}\n`;
      if (response.coolDownNote) content += `💬 7. 其他：${response.coolDownNote}\n`;
      content += '\n';
    });

    if (session.aiReports.length > 0) {
      content += `\n【AI 整合分析】\n${'─'.repeat(25)}\n\n`;
      
      const groupReports = session.aiReports.filter(r => r.reportType === 'group');
      groupReports.forEach(report => {
        content += `🤖 第 ${report.groupNumber} 組 AI 摘要\n`;
        content += `${report.content}\n\n`;
      });
      
      const overallReport = session.aiReports.find(r => r.reportType === 'overall');
      if (overallReport) {
        content += `🌟 全體整合報告\n`;
        content += `${overallReport.content}\n\n`;
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `查經記錄_${session.verseReference}_${format(new Date(session.createdAt), 'yyyyMMdd')}.txt`;
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

  // Presentation mode overlay
  if (presentationMode && selectedSession && presentationSlides.length > 0) {
    const slide = presentationSlides[currentSlide];
    const formatSlideContent = (text?: string) => {
      if (!text) return null;
      return text.replace(/\*\*/g, '').replace(/^[-•]\s*/gm, '').split('\n').filter(l => l.trim()).map((line, i) => (
        <div key={i} className="py-0.5 text-sm sm:text-base leading-relaxed">{line.trim()}</div>
      ));
    };
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <span className="text-white/60 text-xs sm:text-sm">
            {currentSlide + 1} / {presentationSlides.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPresentationMode(false)}
            className="text-white/70 hover:text-white"
            data-testid="button-close-presentation"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto">
          {slide?.type === 'title' || slide?.type === 'end' ? (
            <div className="text-center">
              <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.3)' }}>
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="text-xl sm:text-2xl text-white/80">{slide.subtitle}</p>
              )}
              {slide.type === 'title' && (
                <p className="mt-6 text-white/50 text-sm">
                  {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          ) : slide?.section ? (
            <div className="w-full max-w-5xl">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  slide.section.groupNumber === 0 ? "text-purple-300" : "text-teal-300"
                )}>
                  {slide.title}
                </h2>
                {slide.section.members && (
                  <span className="text-sm text-white/50 bg-white/10 px-3 py-1 rounded-full">
                    {slide.section.members}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {slide.section.themes && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-green-400">
                    <h3 className="text-green-300 font-semibold text-sm mb-2">主題</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.themes)}</div>
                  </div>
                )}
                {slide.section.observations && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-teal-400">
                    <h3 className="text-teal-300 font-semibold text-sm mb-2">事實發現</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.observations)}</div>
                  </div>
                )}
                {slide.section.insights && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-amber-400">
                    <h3 className="text-amber-300 font-semibold text-sm mb-2">獨特亮光</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.insights)}</div>
                  </div>
                )}
                {slide.section.applications && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-blue-400">
                    <h3 className="text-blue-300 font-semibold text-sm mb-2">如何應用</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.applications)}</div>
                  </div>
                )}
              </div>
              {slide.section.contributions && (
                <div className="mt-3 sm:mt-4 bg-white/5 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-purple-400">
                  <h3 className="text-purple-300 font-semibold text-sm mb-2">個人貢獻摘要</h3>
                  <div className="text-white/80 text-sm">{formatSlideContent(slide.section.contributions)}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-4 pb-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            className="text-white/70 hover:text-white disabled:opacity-30"
            data-testid="button-prev-slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex gap-1.5">
            {presentationSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === currentSlide ? "bg-white w-6" : "bg-white/30"
                )}
                data-testid={`button-slide-dot-${i}`}
              />
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCurrentSlide(prev => Math.min(prev + 1, presentationSlides.length - 1))}
            disabled={currentSlide === presentationSlides.length - 1}
            className="text-white/70 hover:text-white disabled:opacity-30"
            data-testid="button-next-slide"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
        <p className="text-center text-white/30 text-xs pb-3">使用方向鍵或點擊導航 · ESC 退出</p>
      </div>
    );
  }

  if (selectedSessionId) {
    if (isLoadingDetail || !selectedSession) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSessionId(null)} className="gap-1">
              <ChevronRight className="w-4 h-4 rotate-180" />
              返回列表
            </Button>
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedSessionId(null)}
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
                <CardTitle className="text-xl">{selectedSession.verseReference}</CardTitle>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  {selectedSession.churchUnit && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Building2 className="w-3.5 h-3.5" />
                      {selectedSession.churchUnit}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(selectedSession.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {selectedSession.participantCount} 人參與
                  </span>
                  <Badge variant={selectedSession.status === 'completed' ? 'default' : 'secondary'}>
                    {selectedSession.status === 'completed' ? '已完成' : 
                     selectedSession.status === 'studying' ? '進行中' : '等待中'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedSession.aiReports.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setCurrentSlide(0);
                      setPresentationMode(true);
                    }}
                    className="gap-2"
                    data-testid="button-presentation-mode"
                  >
                    <Presentation className="w-4 h-4" />
                    PPT
                  </Button>
                )}
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
            </div>
          </CardHeader>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'groups' | 'reports')}>
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="notes" className="gap-2 text-base">
              <User className="w-4 h-4" />
              個人筆記
              <Badge variant="secondary" className="ml-1">
                {selectedSession.responses.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2 text-base">
              <Users className="w-4 h-4" />
              分組成員
              <Badge variant="secondary" className="ml-1">
                {Object.keys(groupedResponses).length}
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
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋筆記內容或參與者..."
                value={notesSearchTerm}
                onChange={(e) => setNotesSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <ScrollArea className="h-[calc(100vh-480px)]">
              {Object.keys(groupedResponses).length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">尚無符合條件的筆記</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 pr-4">
                  {Object.entries(groupedResponses)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([groupNum, responses]) => (
                      <Collapsible
                        key={`group-notes-${groupNum}`}
                        open={!collapsedGroups[groupNum]}
                        onOpenChange={() => toggleGroup(groupNum)}
                      >
                        <Card className="overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover-elevate bg-muted/30">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-secondary" />
                                <h3 className="font-semibold text-sm">
                                  {groupNum === '0' ? '未分組' : `第 ${groupNum} 組`}
                                </h3>
                                <Badge variant="secondary" className="text-[10px]">
                                  {responses.length} 筆
                                </Badge>
                              </div>
                              {collapsedGroups[groupNum] ? (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="grid gap-3 p-4 pt-2">
                              {responses.map((response) => (
                                <ResponseCard 
                                  key={response.id} 
                                  response={response}
                                  onDelete={handleDeleteResponse}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            <ScrollArea className="h-[calc(100vh-480px)]">
              {Object.keys(groupedResponses).length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">尚無分組資料</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 pr-4">
                  {Object.entries(groupedResponses)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([groupNum, responses]) => (
                      <Card key={`group-members-${groupNum}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-secondary" />
                            {groupNum === '0' ? '未分組' : `第 ${groupNum} 組`}
                            <Badge variant="secondary">{responses.length} 人</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {responses.map((r) => (
                              <Badge key={r.id} variant="outline" className="gap-1 text-sm py-1 px-2.5">
                                <User className="w-3 h-3" />
                                {r.participantName}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
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
                <HistoryReportsWithCharts 
                  reports={selectedSession.aiReports} 
                  sessionId={selectedSession.id}
                  onDelete={handleDeleteReport}
                />
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-3">
      {/* Header with inline stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-secondary" />
          <h2 className="text-lg font-semibold">歷史查經資料</h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderOpen className="w-3.5 h-3.5" />
            共 <strong className="text-foreground">{stats.totalSessions}</strong> 場
          </span>
          <span className="hidden sm:flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            本月 <strong className="text-foreground">{stats.thisMonthSessions}</strong> 場
          </span>
        </div>
      </div>

      {/* Search + All Filters in One Row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋經文、單位、代碼..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
            data-testid="input-history-search"
          />
        </div>
        <div className="flex gap-2">
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-[100px] sm:w-[110px] h-9" data-testid="select-filter-time">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="時間" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">全部時間</SelectItem>
              <SelectItem value="this-month">本月</SelectItem>
              <SelectItem value="last-month">上月</SelectItem>
              <SelectItem value="older">更早</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[100px] sm:w-[110px] h-9" data-testid="select-filter-status">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="studying">進行中</SelectItem>
              <SelectItem value="waiting">等待中</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterChurchUnit} onValueChange={setFilterChurchUnit}>
            <SelectTrigger className="w-[100px] sm:w-[110px] h-9" data-testid="select-filter-church-unit">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="單位" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">全部單位</SelectItem>
              {uniqueChurchUnits.map(unit => (
                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
              ))}
              <SelectItem value="__none__">未分類</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Result Count + Group-by Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          找到 {filteredSessions.length} 場聚會
        </span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => { setGroupByMode('month'); setCollapsedListGroups({}); }}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                groupByMode === 'month' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted text-muted-foreground"
              )}
              data-testid="button-group-by-month"
            >
              月份
            </button>
            <button
              onClick={() => { setGroupByMode('churchUnit'); setCollapsedListGroups({}); }}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                groupByMode === 'churchUnit' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted text-muted-foreground"
              )}
              data-testid="button-group-by-church"
            >
              單位
            </button>
          </div>
          <button
            onClick={Object.keys(collapsedListGroups).length > 0 ? expandAll : collapseAll}
            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
            title={Object.keys(collapsedListGroups).length > 0 ? '全部展開' : '全部收起'}
            data-testid="button-collapse-all"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Edit Session Dialog */}
      {editingSession && (
        <Card className="border-accent/50 bg-accent/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-accent" />
                編輯聚會資料
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSession(null)}
                className="px-1.5"
                data-testid="button-cancel-edit"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">訓練經文</label>
              <Input
                value={editVerseReference}
                onChange={(e) => setEditVerseReference(e.target.value)}
                placeholder="例如: 約翰福音 3:16"
                className="text-base md:text-sm"
                data-testid="input-edit-verse"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">課程單位</label>
              <Input
                value={editChurchUnit}
                onChange={(e) => setEditChurchUnit(e.target.value)}
                placeholder="例如: 台北靈糧堂"
                className="text-base md:text-sm"
                data-testid="input-edit-church-unit"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingSession(null)}
                data-testid="button-cancel-edit-2"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="gap-1.5"
                data-testid="button-save-edit"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
        <ScrollArea className="h-[calc(100vh-340px)]">
          <div className="space-y-2 pr-4">
            {displayGroups.map(([groupKey, groupSessions]) => {
              const isCollapsed = !!collapsedListGroups[groupKey];
              const groupLabel = groupByMode === 'month'
                ? format(new Date(groupKey + '-01'), 'yyyy 年 M 月', { locale: zhTW })
                : groupKey;
              const GroupIcon = groupByMode === 'month' ? CalendarDays : Building2;

              return (
                <Collapsible
                  key={groupKey}
                  open={!isCollapsed}
                  onOpenChange={() => toggleListGroup(groupKey)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-2 sticky top-0 bg-background/95 backdrop-blur z-[100] transition-colors" data-testid={`trigger-group-${groupKey}`}>
                      <GroupIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                      <span className="font-medium text-sm">{groupLabel}</span>
                      <Badge variant="secondary" className="text-xs">
                        {groupSessions.length} 場
                      </Badge>
                      <div className="flex-1" />
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-2 pt-1">
                      {groupSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onClick={() => setSelectedSessionId(session.id)}
                          onEdit={() => handleEditSession(session)}
                          onDelete={() => handleDeleteSession(session.id)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

const SessionCard: React.FC<{
  session: SessionMetadata;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ session, onClick, onEdit, onDelete }) => {
  return (
    <Card 
      className="cursor-pointer hover:border-secondary/50 hover:shadow-md transition-all group"
      onClick={onClick}
      data-testid={`card-session-${session.id}`}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm sm:text-base truncate">{session.verseReference}</span>
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
            {session.churchUnit && (
              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1.5">
                <Building2 className="w-3 h-3" />
                {session.churchUnit}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(session.createdAt), 'MM/dd HH:mm')}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {session.participantCount} 人
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-accent px-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                data-testid={`button-edit-session-${session.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive px-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                data-testid={`button-delete-session-${session.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Response Card Component
const ResponseCard: React.FC<{
  response: StudyResponseWithParticipant;
  onDelete?: (responseId: string) => void;
}> = ({ response, onDelete }) => {
  const parsedCats = parseCategories(response.coreInsightCategory as any);
  const parsedNotes = parseNotes(response.coreInsightNote as any, parsedCats);

  return (
    <Card className="bg-muted/30 group relative">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-secondary" />
          </div>
          <span className="font-medium">{response.participantName}</span>
          {response.groupNumber && (
            <Badge variant="outline" className="text-xs">
              第 {response.groupNumber} 組
            </Badge>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(response.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2 text-sm">
        {response.titlePhrase && (
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
            <span><strong>標題分段：</strong>{response.titlePhrase}</span>
          </div>
        )}
        {response.heartbeatVerse && (
          <div className="flex items-start gap-2">
            <Heart className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
            <span><strong>最感動的經文：</strong>{response.heartbeatVerse}</span>
          </div>
        )}
        {response.observation && (
          <div className="flex items-start gap-2">
            <Eye className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
            <span><strong>經文上的資訊：</strong>{response.observation}</span>
          </div>
        )}
        {response.coreInsightNote && parsedCats.length > 0 ? (
          parsedCats.map(catVal => {
            const cat = INSIGHT_CATEGORIES.find(c => c.value === catVal);
            const noteText = parsedNotes[catVal];
            if (!noteText) return null;
            return (
              <div key={catVal} className="flex items-start gap-2">
                <Dumbbell className="w-3.5 h-3.5 mt-0.5 text-secondary flex-shrink-0" />
                <span>
                  <strong>思想神的話 ({cat?.label || catVal})：</strong>
                  {noteText}
                </span>
              </div>
            );
          })
        ) : response.coreInsightNote ? (
          <div className="flex items-start gap-2">
            <Dumbbell className="w-3.5 h-3.5 mt-0.5 text-secondary flex-shrink-0" />
            <span>
              <strong>思想神的話：</strong>
              {typeof response.coreInsightNote === 'string' ? response.coreInsightNote : ''}
            </span>
          </div>
        ) : null}
        {response.scholarsNote && (
          <div className="flex items-start gap-2">
            <BookOpen className="w-3.5 h-3.5 mt-0.5 text-secondary flex-shrink-0" />
            <span><strong>注釋書或其他的參考資料：</strong>{response.scholarsNote}</span>
          </div>
        )}
        {response.actionPlan && (
          <div className="flex items-start gap-2">
            <Target className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
            <span><strong>與神同行的行動：</strong>{response.actionPlan}</span>
          </div>
        )}
        {response.coolDownNote && (
          <div className="flex items-start gap-2">
            <MessageCircle className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
            <span><strong>其他：</strong>{response.coolDownNote}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// History Reports with Charts Wrapper
interface HistoryReportsWithChartsProps {
  reports: AIReport[];
  sessionId: string;
  onDelete?: (reportId: string, sessionId: string) => void;
}

const HistoryReportsWithCharts: React.FC<HistoryReportsWithChartsProps> = ({ reports, sessionId, onDelete }) => {
  const groupReports = reports.filter(r => r.reportType === 'group' && r.groupNumber !== 0);
  const overallReport = reports.find(r => r.reportType === 'overall' || r.groupNumber === 0);
  
  // Parse group reports for chart visualization
  const parsedGroupReports: GroupReport[] = useMemo(() => {
    return groupReports.map(r => {
      const parsed = parseReportContent(r.content);
      const section: GroupReport = parsed[0] || {
        groupNumber: 0, members: '', verse: '', themes: '',
        observations: '', insights: '', applications: '', contributions: '', raw: ''
      };
      return {
        groupNumber: r.groupNumber || 0,
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
        .filter(r => r.reportType === 'overall' || r.groupNumber === 0)
        .map(report => (
          <div key={report.id} className="relative group/report">
            <HistoryReportSection 
              report={report}
              variant="overall"
            />
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover/report:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(report.id, sessionId);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}

      {/* Separator if both overall and group reports exist */}
      {reports.some(r => r.reportType === 'overall' || r.groupNumber === 0) &&
       reports.some(r => r.reportType === 'group' && r.groupNumber !== 0) && (
        <div className="relative py-2">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
            各組報告
          </span>
        </div>
      )}

      {/* Group Reports - with enhanced formatting */}
      {reports
        .filter(r => r.reportType === 'group' && r.groupNumber !== 0)
        .map(report => (
          <div key={report.id} className="relative group/report">
            <HistoryReportSection 
              report={report}
              variant="group"
            />
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover/report:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(report.id, sessionId);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
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
    toast.success(isOverall ? '全體報告已複製！' : `第 ${report.groupNumber} 組報告已複製！`);
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
            {isOverall ? '📊 全會眾綜合分析' : `第 ${report.groupNumber} 組`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs",
            isOverall ? "text-muted-foreground" : "text-primary-foreground/70"
          )}>
            {format(new Date(report.createdAt), 'MM/dd HH:mm')}
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
