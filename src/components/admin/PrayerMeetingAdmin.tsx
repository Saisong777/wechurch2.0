import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shuffle, Copy, Check, Users, Crown, QrCode, Trash2, Plus, ChevronLeft, ChevronUp, ChevronDown, Presentation, X, Sparkles, List, AlertTriangle, EyeOff, Maximize, Minimize, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';

interface PrayerMeeting {
  id: string;
  shortCode: string;
  title: string;
  status: string;
  groupingMode: string;
  groupSize: number | null;
  groupCount: number | null;
  genderMode: string;
  ownerId: string | null;
  createdAt: string;
}

interface PrayerMeetingParticipant {
  id: string;
  meetingId: string;
  userId: string | null;
  name: string;
  gender: string;
  groupNumber: number | null;
  prayerRequest: string | null;
  anonymousPrayer: string | null;
  isAnonymous: boolean;
  prayerCategory: string | null;
  isUrgent: boolean;
  joinedAt: string;
}

interface PrayerListData {
  meetingId: string;
  meetingTitle: string;
  groupNumber: number | null;
  urgentPrayers: PrayerItem[];
  categorizedPrayers: Record<string, PrayerItem[]>;
  totalCount: number;
}

interface PrayerItem {
  id: string;
  name: string;
  prayerRequest: string;
  category: string;
  isUrgent: boolean;
  isAnonymous: boolean;
  groupNumber: number | null;
}

type GroupingMode = 'bySize' | 'byCount';
type GenderMode = 'mixed' | 'separate' | 'male_only' | 'female_only';
type ViewStep = 'list' | 'create' | 'manage' | 'presentation' | 'prayer-list';

interface PresentationPage {
  title: string;
  subtitle?: string;
  prayers: { id: string; name: string; prayer: string; groupNumber: number | null; isUrgent?: boolean }[];
  type: 'urgent' | 'anonymous' | 'group';
  groupNumber?: number;
}

const GROUP_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-400 dark:border-blue-600', text: 'text-blue-700 dark:text-blue-300', accent: 'bg-blue-500' },
  { bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-400 dark:border-green-600', text: 'text-green-700 dark:text-green-300', accent: 'bg-green-500' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', border: 'border-purple-400 dark:border-purple-600', text: 'text-purple-700 dark:text-purple-300', accent: 'bg-purple-500' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400 dark:border-orange-600', text: 'text-orange-700 dark:text-orange-300', accent: 'bg-orange-500' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-400 dark:border-pink-600', text: 'text-pink-700 dark:text-pink-300', accent: 'bg-pink-500' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40', border: 'border-cyan-400 dark:border-cyan-600', text: 'text-cyan-700 dark:text-cyan-300', accent: 'bg-cyan-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-400 dark:border-amber-600', text: 'text-amber-700 dark:text-amber-300', accent: 'bg-amber-500' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-400 dark:border-rose-600', text: 'text-rose-700 dark:text-rose-300', accent: 'bg-rose-500' },
];

const getGroupColor = (groupNumber: number) => GROUP_COLORS[(groupNumber - 1) % GROUP_COLORS.length];

interface PrayerMeetingAdminProps {
  onBack: () => void;
}

export const PrayerMeetingAdmin = ({ onBack }: PrayerMeetingAdminProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<ViewStep>('list');
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [presentationGroup, setPresentationGroup] = useState<number>(0);
  const [presentationPageIndex, setPresentationPageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [title, setTitle] = useState('禱告會');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('bySize');
  const [groupSize, setGroupSize] = useState(4);
  const [groupCount, setGroupCount] = useState(3);
  const [genderMode, setGenderMode] = useState<GenderMode>('mixed');

  const [showHistory, setShowHistory] = useState(false);

  const { data: activeMeetings = [] } = useQuery<PrayerMeeting[]>({
    queryKey: ['/api/prayer-meetings/active'],
    queryFn: async () => {
      const res = await fetch('/api/prayer-meetings/active');
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: closedMeetings = [] } = useQuery<PrayerMeeting[]>({
    queryKey: ['/api/prayer-meetings/history'],
    queryFn: async () => {
      const res = await fetch('/api/prayer-meetings/history');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: meeting, refetch: refetchMeeting } = useQuery<PrayerMeeting>({
    queryKey: ['/api/prayer-meetings', currentMeetingId],
    queryFn: async () => {
      const res = await fetch(`/api/prayer-meetings/${currentMeetingId}`);
      if (!res.ok) throw new Error('Meeting not found');
      return res.json();
    },
    enabled: !!currentMeetingId && (step === 'manage' || step === 'presentation' || step === 'prayer-list'),
    refetchInterval: step === 'manage' || step === 'presentation' ? 3000 : false,
  });

  const { data: participants = [], refetch: refetchParticipants } = useQuery<PrayerMeetingParticipant[]>({
    queryKey: ['/api/prayer-meetings', currentMeetingId, 'participants'],
    queryFn: async () => {
      const res = await fetch(`/api/prayer-meetings/${currentMeetingId}/participants`);
      if (!res.ok) throw new Error('Failed to fetch participants');
      return res.json();
    },
    enabled: !!currentMeetingId && (step === 'manage' || step === 'presentation' || step === 'prayer-list'),
    refetchInterval: step === 'manage' || step === 'presentation' ? 3000 : false,
  });

  const isGrouped = meeting?.status === 'grouped' || meeting?.status === 'praying' || meeting?.status === 'completed' || meeting?.status === 'closed';
  const isPraying = meeting?.status === 'praying' || meeting?.status === 'completed' || meeting?.status === 'closed';
  const isClosed = meeting?.status === 'closed' || meeting?.status === 'completed';

  const getQRCodeUrl = (code: string) => {
    const joinUrl = `${window.location.origin}/prayer-meeting?code=${code}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;
  };

  const copyCode = () => {
    if (meeting?.shortCode) {
      navigator.clipboard.writeText(meeting.shortCode);
      setCopiedCode(true);
      toast.success('已複製代碼');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const createMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/prayer-meetings', {
        title,
        groupingMode,
        groupSize,
        groupCount,
        genderMode,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentMeetingId(data.id);
      setStep('manage');
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-meetings/active'] });
      toast.success('禱告會已建立');
    },
    onError: () => {
      toast.error('建立禱告會失敗');
    },
  });

  const executeGroupingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/prayer-meetings/${currentMeetingId}/execute-grouping`);
      return res.json();
    },
    onSuccess: () => {
      refetchMeeting();
      refetchParticipants();
      toast.success('分組完成！');
    },
    onError: () => {
      toast.error('分組失敗');
    },
  });

  const startPrayingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/prayer-meetings/${currentMeetingId}/start-praying`);
      return res.json();
    },
    onSuccess: () => {
      refetchMeeting();
      toast.success('開始禱告！');
    },
  });

  const endMeetingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PATCH', `/api/prayer-meetings/${currentMeetingId}`, { status: 'closed' });
    },
    onSuccess: () => {
      setCurrentMeetingId(null);
      setStep('list');
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-meetings/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-meetings/history'] });
      toast.success('禱告會已結束');
    },
    onError: () => {
      toast.error('結束禱告會失敗');
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      await apiRequest('DELETE', `/api/prayer-meetings/${meetingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-meetings/history'] });
      toast.success('禱告會記錄已刪除');
    },
    onError: () => {
      toast.error('刪除失敗');
    },
  });

  const handleDeleteMeeting = (e: React.MouseEvent, meetingId: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`確定要刪除「${title}」的禱告會記錄嗎？此操作無法復原。`)) {
      deleteMeetingMutation.mutate(meetingId);
    }
  };

  const classifyPrayersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/prayer-meetings/${currentMeetingId}/classify-prayers`);
      return res.json();
    },
    onSuccess: (data) => {
      refetchParticipants();
      toast.success(`已分類 ${data.classified} 個禱告事項`);
    },
    onError: () => {
      toast.error('分類禱告事項失敗');
    },
  });

  const [prayerListGroup, setPrayerListGroup] = useState<number | null>(null);
  const [prayerListMode, setPrayerListMode] = useState<'all' | 'named' | 'anonymous'>('all');

  const buildPrayerListQueryKey = () => {
    let url = `/api/prayer-meetings/${currentMeetingId}/prayer-list?mode=${prayerListMode}`;
    if (prayerListMode === 'named' && prayerListGroup !== null) {
      url += `&group=${prayerListGroup}`;
    }
    return url;
  };
  const prayerListQueryKey = buildPrayerListQueryKey();

  const { data: prayerListData, isLoading: isLoadingPrayerList } = useQuery<PrayerListData>({
    queryKey: [prayerListQueryKey],
    enabled: !!currentMeetingId && step === 'prayer-list',
  });

  const handleSelectMeeting = (meetingId: string) => {
    setCurrentMeetingId(meetingId);
    setStep('manage');
  };

  const groupedParticipants = participants.reduce((acc, p) => {
    const group = p.groupNumber || 0;
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {} as Record<number, PrayerMeetingParticipant[]>);

  const groupNumbers = Object.keys(groupedParticipants)
    .map(Number)
    .filter(n => n > 0)
    .sort((a, b) => a - b);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const computePresentationPages = () => {
    const pages: PresentationPage[] = [];
    const urgentPrayers: PresentationPage['prayers'] = [];
    const anonymousPrayers: PresentationPage['prayers'] = [];
    
    participants.forEach(p => {
      if (p.prayerRequest && p.isUrgent) {
        urgentPrayers.push({ id: p.id + '-urgent', name: p.name, prayer: p.prayerRequest, groupNumber: p.groupNumber, isUrgent: true });
      }
      if (p.anonymousPrayer) {
        anonymousPrayers.push({ id: p.id + '-anon', name: '匿名', prayer: p.anonymousPrayer, groupNumber: p.groupNumber });
      }
    });
    
    if (urgentPrayers.length > 0) {
      pages.push({ title: '緊急禱告事項', subtitle: '需要迫切代禱', prayers: urgentPrayers, type: 'urgent' });
    }
    if (anonymousPrayers.length > 0) {
      pages.push({ title: '匿名禱告事項', prayers: anonymousPrayers, type: 'anonymous' });
    }
    
    groupNumbers.forEach(num => {
      const groupPrayers: PresentationPage['prayers'] = [];
      const groupParticipants = groupedParticipants[num] || [];
      groupParticipants.forEach(p => {
        if (p.prayerRequest) {
          groupPrayers.push({ id: p.id + '-named', name: p.name, prayer: p.prayerRequest, groupNumber: p.groupNumber });
        }
      });
      if (groupPrayers.length > 0) {
        pages.push({ title: `第 ${num} 組`, subtitle: `${groupParticipants.length} 位組員`, prayers: groupPrayers, type: 'group', groupNumber: num });
      }
    });
    
    if (pages.length === 0) {
      pages.push({ title: '尚無禱告事項', prayers: [], type: 'group' });
    }
    return pages;
  };

  const presentationPages = computePresentationPages();
  const maxPageIndex = Math.max(0, presentationPages.length - 1);

  useEffect(() => {
    if (step === 'presentation' && presentationPageIndex > maxPageIndex) {
      setPresentationPageIndex(maxPageIndex);
    }
  }, [step, presentationPageIndex, maxPageIndex]);

  useEffect(() => {
    if (step !== 'presentation') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setPresentationPageIndex(prev => Math.min(prev + 1, maxPageIndex));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setPresentationPageIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen?.();
          setIsFullscreen(false);
        } else {
          setStep('manage');
          setPresentationPageIndex(0);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, isFullscreen, maxPageIndex]);

  if (step === 'presentation') {
    const pages = presentationPages;
    const currentPage = pages[Math.min(presentationPageIndex, maxPageIndex)];
    const safePageIndex = Math.min(presentationPageIndex, maxPageIndex);
    
    const getPageGradient = (type: PresentationPage['type']) => {
      switch (type) {
        case 'urgent':
          return 'from-red-900 via-rose-900 to-orange-900';
        case 'anonymous':
          return 'from-slate-800 via-gray-900 to-zinc-900';
        case 'group':
        default:
          return 'from-purple-900 via-indigo-900 to-blue-900';
      }
    };
    
    return (
      <div className={cn("fixed inset-0 z-50 overflow-hidden bg-gradient-to-br", getPageGradient(currentPage.type))}>
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleFullscreen} 
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            data-testid="button-toggle-fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setStep('manage'); setPresentationPageIndex(0); }} 
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            data-testid="button-exit-presentation"
          >
            <X className="w-4 h-4 mr-2" />
            退出
          </Button>
        </div>

        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPresentationPageIndex(prev => Math.max(prev - 1, 0))}
            disabled={safePageIndex === 0}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-30"
            data-testid="button-prev-page"
          >
            <ChevronUp className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPresentationPageIndex(prev => Math.min(prev + 1, pages.length - 1))}
            disabled={safePageIndex === pages.length - 1}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-30"
            data-testid="button-next-page"
          >
            <ChevronDown className="w-6 h-6" />
          </Button>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <span className="text-white/60 text-sm">
            {safePageIndex + 1} / {pages.length}
          </span>
          <div className="flex gap-1">
            {pages.map((page, idx) => (
              <button
                key={idx}
                onClick={() => setPresentationPageIndex(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  idx === safePageIndex ? "bg-white w-4" : "bg-white/40 hover:bg-white/60"
                )}
                data-testid={`button-page-dot-${idx}`}
              />
            ))}
          </div>
          <span className="text-white/40 text-xs ml-2">按上下鍵切換</span>
        </div>

        <div className="min-h-screen flex flex-col items-center justify-center p-8 pt-16">
          <div className="text-center mb-8">
            {currentPage.type === 'urgent' && (
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            )}
            {currentPage.type === 'anonymous' && (
              <EyeOff className="w-12 h-12 text-white/60 mx-auto mb-4" />
            )}
            <h1 className="text-5xl font-bold text-white mb-2">
              {currentPage.title}
            </h1>
            {currentPage.subtitle && (
              <p className="text-xl text-white/60">{currentPage.subtitle}</p>
            )}
          </div>

          <div className="w-full max-w-4xl bg-white/10 backdrop-blur rounded-xl p-8">
            {currentPage.prayers.length > 0 ? (
              <ul className="space-y-6">
                {currentPage.prayers.map((item, index) => (
                  <li key={item.id} className="flex items-start gap-4 text-white">
                    <span className="text-3xl font-bold text-white/40 min-w-[2.5rem]">{index + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-semibold text-xl">{item.name}</span>
                        {item.isUrgent && (
                          <Badge className="bg-red-500/80 text-white border-0">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            緊急
                          </Badge>
                        )}
                      </div>
                      <p className="text-white/90 text-2xl leading-relaxed">
                        {item.prayer}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-white/60 text-xl py-8">此分類沒有禱告事項</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'prayer-list') {
    const categoryColors: Record<string, string> = {
      '健康': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      '工作': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      '關係': 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
      '小孩': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      '婚姻': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      '財務': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      '學業': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
      '信仰': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
      '事工': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
      '感恩': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      '其他': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 z-50 overflow-auto">
        <div className="absolute top-4 right-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setStep('manage')}>
            <X className="w-4 h-4 mr-2" />
            返回管理
          </Button>
        </div>

        <div className="max-w-4xl mx-auto p-6 pt-16">
          <h1 className="text-3xl font-bold text-center mb-6">
            禱告清單
          </h1>

          <div className="flex gap-2 mb-6 flex-wrap justify-center items-center">
            <Button
              variant={prayerListMode === 'all' ? 'default' : 'outline'}
              onClick={() => { setPrayerListMode('all'); setPrayerListGroup(null); }}
              size="sm"
              data-testid="button-mode-all"
            >
              全部禱告
            </Button>
            <Button
              variant={prayerListMode === 'named' ? 'default' : 'outline'}
              onClick={() => { setPrayerListMode('named'); setPrayerListGroup(null); }}
              size="sm"
              data-testid="button-mode-named"
            >
              各組禱告
            </Button>
            <Button
              variant={prayerListMode === 'anonymous' ? 'default' : 'outline'}
              onClick={() => { setPrayerListMode('anonymous'); setPrayerListGroup(null); }}
              size="sm"
              data-testid="button-mode-anonymous"
            >
              匿名禱告
            </Button>
            
            {prayerListMode === 'named' && groupNumbers.length > 0 && (
              <>
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
                <Select
                  value={prayerListGroup?.toString() || 'all'}
                  onValueChange={(value) => setPrayerListGroup(value === 'all' ? null : parseInt(value))}
                >
                  <SelectTrigger className="w-32" data-testid="select-group-filter">
                    <SelectValue placeholder="選擇組別" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部組別</SelectItem>
                    {groupNumbers.map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        第 {num} 組
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPresentationGroup(prayerListGroup || 0);
                setPresentationPageIndex(0);
                setStep('presentation');
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
              data-testid="button-ppt-projection"
            >
              <Presentation className="w-4 h-4 mr-2" />
              PPT 投影
            </Button>
          </div>

          {prayerListData?.urgentPrayers && prayerListData.urgentPrayers.length > 0 && (
            <Card className="mb-6 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-5 h-5" />
                  緊急代禱事項
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {prayerListData.urgentPrayers.map(prayer => (
                  <div key={prayer.id} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-semibold">{prayer.name}</span>
                      <Badge className={categoryColors[prayer.category] || categoryColors['其他']}>
                        {prayer.category}
                      </Badge>
                      {prayer.groupNumber && (
                        <Badge variant="outline">第 {prayer.groupNumber} 組</Badge>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{prayer.prayerRequest}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {prayerListData?.categorizedPrayers && Object.entries(prayerListData.categorizedPrayers).map(([category, prayers]) => (
            <Card key={category} className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className={categoryColors[category] || categoryColors['其他']}>
                    {category}
                  </Badge>
                  <span className="text-sm text-gray-500">({prayers.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {prayers.map(prayer => (
                  <div key={prayer.id} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">{prayer.name}</span>
                      {prayer.groupNumber && (
                        <Badge variant="outline" className="text-xs">第 {prayer.groupNumber} 組</Badge>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{prayer.prayerRequest}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {isLoadingPrayerList && (
            <div className="text-center py-12 text-gray-500">
              載入中...
            </div>
          )}

          {!isLoadingPrayerList && (!prayerListData || prayerListData.totalCount === 0) && (
            <div className="text-center py-12 text-gray-500">
              尚無禱告事項
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'create') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setStep('list')} className="mb-2">
          <ChevronLeft className="w-4 h-4 mr-2" />
          返回
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-500" />
              建立禱告會
            </CardTitle>
            <CardDescription>設定禱告會分組方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>禱告會名稱</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：週三晚禱告會"
                data-testid="input-meeting-title"
              />
            </div>

            <div className="space-y-3">
              <Label>分組方式</Label>
              <RadioGroup value={groupingMode} onValueChange={(v) => setGroupingMode(v as GroupingMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bySize" id="bySize" />
                  <Label htmlFor="bySize" className="cursor-pointer">依人數分組</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="byCount" id="byCount" />
                  <Label htmlFor="byCount" className="cursor-pointer">指定組數</Label>
                </div>
              </RadioGroup>
            </div>

            {groupingMode === 'bySize' && (
              <div className="space-y-2">
                <Label>每組人數</Label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map(n => (
                    <Button
                      key={n}
                      type="button"
                      variant={groupSize === n ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGroupSize(n)}
                    >
                      {n}人
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {groupingMode === 'byCount' && (
              <div className="space-y-2">
                <Label>組數</Label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <Button
                      key={n}
                      type="button"
                      variant={groupCount === n ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGroupCount(n)}
                    >
                      {n}組
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label>性別分組</Label>
              <RadioGroup value={genderMode} onValueChange={(v) => setGenderMode(v as GenderMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mixed" id="mixed" />
                  <Label htmlFor="mixed" className="cursor-pointer">混合分組</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="separate" id="separate" />
                  <Label htmlFor="separate" className="cursor-pointer">男女分開</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male_only" id="male_only" />
                  <Label htmlFor="male_only" className="cursor-pointer">男生一組</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female_only" id="female_only" />
                  <Label htmlFor="female_only" className="cursor-pointer">女生一組</Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={() => createMeetingMutation.mutate()}
              disabled={createMeetingMutation.isPending}
              className="w-full"
              data-testid="button-create-meeting"
            >
              {createMeetingMutation.isPending ? '建立中...' : '建立禱告會'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'manage' && currentMeetingId && meeting) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setStep('list'); setCurrentMeetingId(null); }} className="mb-2">
          <ChevronLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{meeting.title}</CardTitle>
            <CardDescription>分享代碼讓參與者加入</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-center">
                <div className="text-4xl font-mono font-bold tracking-widest text-purple-600 dark:text-purple-400" data-testid="text-meeting-code">
                  {meeting.shortCode}
                </div>
                <Button variant="ghost" size="sm" onClick={copyCode} className="mt-2" data-testid="button-copy-code">
                  {copiedCode ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copiedCode ? '已複製' : '複製代碼'}
                </Button>
              </div>
              <img src={getQRCodeUrl(meeting.shortCode)} alt="QR Code" className="w-24 h-24" data-testid="img-qrcode" />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-300">目前參與者</span>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="badge-participant-count">
                {participants.length} 人
              </Badge>
            </div>

            {participants.length > 0 && (
              <div className="space-y-2">
                <Label>參與者名單</Label>
                <div className="flex flex-wrap gap-2">
                  {participants.map(p => (
                    <Badge
                      key={p.id}
                      variant="outline"
                      className={cn(
                        p.groupNumber && getGroupColor(p.groupNumber).bg,
                        p.groupNumber && getGroupColor(p.groupNumber).border
                      )}
                    >
                      {p.name} ({p.gender === 'M' ? '男' : '女'})
                      {p.groupNumber && ` - 第${p.groupNumber}組`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!isGrouped ? (
              <Button
                onClick={() => executeGroupingMutation.mutate()}
                disabled={executeGroupingMutation.isPending || participants.length < 2}
                className="w-full"
                data-testid="button-execute-grouping"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                {executeGroupingMutation.isPending ? '分組中...' : '開始分組'}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    已完成分組 - {groupNumbers.length} 組
                  </Badge>
                </div>

                {groupNumbers.map(num => (
                  <div key={num} className={cn('p-3 rounded-lg border', getGroupColor(num).bg, getGroupColor(num).border)}>
                    <div className="font-medium mb-2">第 {num} 組</div>
                    <div className="flex flex-wrap gap-2">
                      {groupedParticipants[num].map(p => (
                        <Badge key={p.id} variant="outline">
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}

                {!isPraying && (
                  <Button
                    onClick={() => startPrayingMutation.mutate()}
                    disabled={startPrayingMutation.isPending}
                    className="w-full"
                    data-testid="button-start-praying"
                  >
                    開始禱告
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => { setPresentationPageIndex(0); setStep('presentation'); }}
                  className="w-full"
                  data-testid="button-presentation-mode"
                >
                  <Presentation className="w-4 h-4 mr-2" />
                  簡報模式
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => classifyPrayersMutation.mutate()}
                    disabled={classifyPrayersMutation.isPending}
                    className="flex-1"
                    data-testid="button-classify-prayers"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {classifyPrayersMutation.isPending ? 'AI分類中...' : 'AI分類禱告'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStep('prayer-list')}
                    className="flex-1"
                    data-testid="button-view-prayer-list"
                  >
                    <List className="w-4 h-4 mr-2" />
                    禱告清單
                  </Button>
                </div>
              </div>
            )}

            {isClosed ? (
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-center text-gray-600 dark:text-gray-400">
                此禱告會已結束（歷史記錄）
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => endMeetingMutation.mutate()}
                disabled={endMeetingMutation.isPending}
                className="w-full"
                data-testid="button-end-meeting"
              >
                <XCircle className="w-4 h-4 mr-2" />
                結束禱告會
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <Button onClick={() => setStep('create')} data-testid="button-new-meeting">
          <Plus className="w-4 h-4 mr-2" />
          建立禱告會
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-500" />
            禱告會管理
          </CardTitle>
          <CardDescription>建立和管理禱告會活動</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 border-b pb-2">
            <Button
              variant={!showHistory ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowHistory(false)}
              data-testid="tab-active-meetings"
            >
              進行中 ({activeMeetings.length})
            </Button>
            <Button
              variant={showHistory ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowHistory(true)}
              data-testid="tab-history-meetings"
            >
              歷史記錄 ({closedMeetings.length})
            </Button>
          </div>

          {!showHistory ? (
            activeMeetings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>目前沒有進行中的禱告會</p>
                <p className="text-sm">點擊「建立禱告會」開始</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeMeetings.map(m => (
                  <div
                    key={m.id}
                    className="p-4 border rounded-lg cursor-pointer hover-elevate"
                    onClick={() => handleSelectMeeting(m.id)}
                    data-testid={`card-meeting-${m.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{m.title}</div>
                        <div className="text-sm text-gray-500">代碼: {m.shortCode}</div>
                      </div>
                      <Badge variant={m.status === 'waiting' ? 'outline' : 'secondary'}>
                        {m.status === 'waiting' && '等待中'}
                        {m.status === 'grouped' && '已分組'}
                        {m.status === 'praying' && '禱告中'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            closedMeetings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>沒有歷史禱告會記錄</p>
              </div>
            ) : (
              <div className="space-y-3">
                {closedMeetings.map(m => (
                  <div
                    key={m.id}
                    className="p-4 border rounded-lg cursor-pointer hover-elevate"
                    onClick={() => handleSelectMeeting(m.id)}
                    data-testid={`card-history-meeting-${m.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{m.title}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(m.createdAt).toLocaleDateString('zh-TW')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          已結束
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={(e) => handleDeleteMeeting(e, m.id, m.title)}
                          data-testid={`button-delete-meeting-${m.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};
