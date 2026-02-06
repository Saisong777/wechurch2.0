import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, Users, Sparkles, UserPlus, Clock, QrCode, Search, Home, PenLine, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Crown, Shuffle, Presentation, EyeOff, Pencil, AlertTriangle } from 'lucide-react';
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
  urgentPrayer: string | null;
  anonymousPrayer: string | null;
  isAnonymous: boolean;
  prayerCategory: string | null;
  isUrgent: boolean;
  joinedAt: string;
  updatedAt: string | null;
}

type GroupingMode = 'bySize' | 'byCount';
type GenderMode = 'mixed' | 'separate' | 'male_only' | 'female_only';
type ViewMode = 'home' | 'host' | 'join' | 'meeting' | 'praying' | 'presentation';

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

interface PrayerMeetingManagerProps {
  initialCode?: string;
}

export const PrayerMeetingManager = ({ initialCode }: PrayerMeetingManagerProps) => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  
  const [title, setTitle] = useState('禱告會');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('bySize');
  const [groupSize, setGroupSize] = useState(4);
  const [groupCount, setGroupCount] = useState(3);
  const [genderMode, setGenderMode] = useState<GenderMode>('mixed');
  
  const [joinCode, setJoinCode] = useState(initialCode || '');
  const [joinName, setJoinName] = useState('');
  const [joinGender, setJoinGender] = useState<'M' | 'F' | ''>('');
  const [hasJoined, setHasJoined] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [meetingDeleted, setMeetingDeleted] = useState(false);
  const [myNamedPrayer, setMyNamedPrayer] = useState('');
  const [myUrgentPrayer, setMyUrgentPrayer] = useState('');
  const [myAnonymousPrayer, setMyAnonymousPrayer] = useState('');
  const [presentationGroup, setPresentationGroup] = useState<number>(0);
  const [isEditingPrayer, setIsEditingPrayer] = useState(false);
  const [isGroupListExpanded, setIsGroupListExpanded] = useState(false);

  const isLeaderOrAbove = user?.role && ['leader', 'future_leader', 'admin'].includes(user.role);

  const { data: meetingData, refetch: refetchMeeting, error: meetingError } = useQuery<PrayerMeeting>({
    queryKey: ['/api/prayer-meetings', currentMeetingId],
    queryFn: async () => {
      const res = await fetch(`/api/prayer-meetings/${currentMeetingId}`);
      if (!res.ok) throw new Error('Meeting not found');
      return res.json();
    },
    enabled: !!currentMeetingId && (viewMode === 'host' || viewMode === 'meeting' || viewMode === 'praying' || viewMode === 'presentation'),
    refetchInterval: 3000,
    retry: false,
  });

  const { data: participants = [], refetch: refetchParticipants } = useQuery<PrayerMeetingParticipant[]>({
    queryKey: ['/api/prayer-meetings', currentMeetingId, 'participants'],
    queryFn: async () => {
      const res = await fetch(`/api/prayer-meetings/${currentMeetingId}/participants`);
      if (!res.ok) throw new Error('Failed to fetch participants');
      return res.json();
    },
    enabled: !!currentMeetingId && (viewMode === 'meeting' || viewMode === 'praying' || viewMode === 'presentation' || viewMode === 'host'),
    refetchInterval: 3000,
  });

  const meeting = meetingData;
  const isOwner = meeting?.ownerId === user?.id;
  const isGrouped = meeting?.status === 'grouped' || meeting?.status === 'praying' || meeting?.status === 'completed';
  const isPraying = meeting?.status === 'praying' || meeting?.status === 'completed';

  useEffect(() => {
    if (meetingError && viewMode === 'meeting' && currentMeetingId && !meetingDeleted) {
      setMeetingDeleted(true);
      toast.info('禱告會已結束');
      navigate('/');
      setViewMode('home');
      setCurrentMeetingId(null);
      setHasJoined(false);
      setMyParticipantId(null);
    }
  }, [meetingError, viewMode, currentMeetingId, meetingDeleted, navigate]);

  useEffect(() => {
    if (meeting?.status === 'closed' && (viewMode === 'meeting' || viewMode === 'praying') && !meetingDeleted) {
      setMeetingDeleted(true);
      toast.info('禱告會已結束，感謝您的參與！');
      navigate('/');
      setViewMode('home');
      setCurrentMeetingId(null);
      setHasJoined(false);
      setMyParticipantId(null);
    }
  }, [meeting?.status, viewMode, meetingDeleted, navigate]);

  useEffect(() => {
    if (initialCode && viewMode === 'home') {
      const lookupMeeting = async () => {
        try {
          const res = await fetch(`/api/prayer-meetings/code/${initialCode.toUpperCase()}`);
          if (res.ok) {
            const data = await res.json();
            setCurrentMeetingId(data.id);
            setMeetingDeleted(false);
            setViewMode('meeting');
          } else {
            toast.error('找不到此禱告會');
          }
        } catch (error) {
          toast.error('查詢失敗');
        }
      };
      lookupMeeting();
    }
  }, [initialCode]);

  // Load existing prayer data into form for editing (only on initial load or when entering edit mode)
  useEffect(() => {
    if (myParticipantId && participants.length > 0 && !isEditingPrayer) {
      const myParticipant = participants.find(p => p.id === myParticipantId);
      if (myParticipant) {
        setMyNamedPrayer(myParticipant.prayerRequest || '');
        setMyUrgentPrayer(myParticipant.urgentPrayer || '');
        setMyAnonymousPrayer(myParticipant.anonymousPrayer || '');
      }
    }
  }, [myParticipantId, participants, isEditingPrayer]);

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
      setViewMode('host');
      toast.success('禱告會已建立');
    },
    onError: () => {
      toast.error('建立禱告會失敗');
    },
  });

  const joinMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, name, gender }: { meetingId: string; name: string; gender: string }) => {
      const res = await apiRequest('POST', `/api/prayer-meetings/${meetingId}/join`, {
        name,
        gender,
        userId: user?.id || null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setHasJoined(true);
      setMyParticipantId(data.id);
      toast.success('成功加入禱告會');
    },
    onError: (error: Error) => {
      toast.error(error.message || '加入禱告會失敗');
    },
  });

  const executeGroupingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/prayer-meetings/${currentMeetingId}/execute-grouping`, {});
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

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('PATCH', `/api/prayer-meetings/${currentMeetingId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      refetchMeeting();
    },
  });

  const updateBothPrayersMutation = useMutation({
    mutationFn: async ({ namedPrayer, urgentPrayer, anonymousPrayer }: { namedPrayer: string; urgentPrayer: string; anonymousPrayer: string }) => {
      const res = await apiRequest('PATCH', `/api/prayer-meetings/${currentMeetingId}/my-prayers/${myParticipantId}`, { 
        namedPrayer: namedPrayer || '', 
        urgentPrayer: urgentPrayer || '',
        anonymousPrayer: anonymousPrayer || '' 
      });
      return res.json();
    },
    onSuccess: () => {
      refetchParticipants();
      setIsEditingPrayer(false);
      toast.success('禱告事項已儲存');
    },
    onError: () => {
      toast.error('儲存失敗，請重試');
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/prayer-meetings/${currentMeetingId}`, {});
      return res.json();
    },
    onSuccess: () => {
      setViewMode('home');
      setCurrentMeetingId(null);
      toast.success('禱告會已關閉');
    },
  });

  const handleFindMeeting = async () => {
    if (!joinCode.trim()) {
      toast.error('請輸入活動代碼');
      return;
    }
    try {
      const res = await fetch(`/api/prayer-meetings/code/${joinCode.toUpperCase()}`);
      if (!res.ok) {
        toast.error('找不到此禱告會');
        return;
      }
      const data = await res.json();
      setCurrentMeetingId(data.id);
      setMeetingDeleted(false);
      setViewMode('meeting');
    } catch (error) {
      toast.error('查詢失敗');
    }
  };

  const handleJoinMeeting = () => {
    if (!joinName.trim() || !joinGender) {
      toast.error('請填寫姓名和性別');
      return;
    }
    if (currentMeetingId) {
      joinMeetingMutation.mutate({
        meetingId: currentMeetingId,
        name: joinName,
        gender: joinGender,
      });
    }
  };

  const copyCode = () => {
    if (meeting?.shortCode) {
      navigator.clipboard.writeText(meeting.shortCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success('代碼已複製');
    }
  };

  const getQRCodeUrl = (code: string) => {
    const joinUrl = `${window.location.origin}/prayer-meeting?code=${code}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;
  };

  const myParticipant = participants.find(p => p.id === myParticipantId);
  const myGroupNumber = myParticipant?.groupNumber;
  const myGroupMembers = myGroupNumber ? participants.filter(p => p.groupNumber === myGroupNumber) : [];

  const groupedParticipants = participants.reduce((acc, p) => {
    if (p.groupNumber) {
      if (!acc[p.groupNumber]) acc[p.groupNumber] = [];
      acc[p.groupNumber].push(p);
    }
    return acc;
  }, {} as Record<number, PrayerMeetingParticipant[]>);

  const groupNumbers = Object.keys(groupedParticipants).map(Number).sort((a, b) => a - b);

  if (authLoading) {
    return <div className="flex items-center justify-center p-8">載入中...</div>;
  }

  if (viewMode === 'presentation') {
    const allPrayerRequests = participants.filter(p => p.prayerRequest).map(p => ({
      name: p.name,
      request: p.prayerRequest,
      group: p.groupNumber,
    }));

    const currentGroupRequests = presentationGroup === 0
      ? allPrayerRequests
      : allPrayerRequests.filter(p => p.group === presentationGroup);

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-sky-900 via-indigo-900 to-purple-900 text-white flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <Button variant="ghost" size="sm" onClick={() => setViewMode('host')} className="text-white hover:bg-white/10">
            <Home className="w-4 h-4 mr-2" />
            返回管理
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant={presentationGroup === 0 ? "default" : "outline"}
              size="sm"
              onClick={() => setPresentationGroup(0)}
              className={presentationGroup === 0 ? "bg-white text-black" : "border-white text-white hover:bg-white/10"}
            >
              全部
            </Button>
            {groupNumbers.map(num => (
              <Button
                key={num}
                variant={presentationGroup === num ? "default" : "outline"}
                size="sm"
                onClick={() => setPresentationGroup(num)}
                className={presentationGroup === num ? "bg-white text-black" : "border-white text-white hover:bg-white/10"}
              >
                第 {num} 組
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresentationGroup(p => Math.max(0, p - 1))}
              disabled={presentationGroup === 0}
              className="border-white text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresentationGroup(p => Math.min(groupNumbers.length, p + 1))}
              disabled={presentationGroup === groupNumbers.length}
              className="border-white text-white hover:bg-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-8">
          <h1 className="text-4xl font-bold text-center mb-8">
            {presentationGroup === 0 ? '全體禱告事項' : `第 ${presentationGroup} 組禱告事項`}
          </h1>
          
          <div className="max-w-4xl mx-auto space-y-6">
            {currentGroupRequests.length === 0 ? (
              <p className="text-center text-xl text-white/60">尚無禱告事項</p>
            ) : (
              currentGroupRequests.map((item, idx) => (
                <Card key={idx} className="bg-white/10 border-white/20 backdrop-blur">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                        {item.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-lg">{item.name}</span>
                          {presentationGroup === 0 && item.group && (
                            <Badge variant="secondary" className="bg-white/20">第 {item.group} 組</Badge>
                          )}
                        </div>
                        <p className="text-lg leading-relaxed whitespace-pre-wrap">{item.request}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">禱告會</h1>
            <p className="text-gray-500 dark:text-gray-400">分組禱告，彼此代禱</p>
          </div>

          <Card className="hover-elevate cursor-pointer" onClick={() => setViewMode('join')}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">加入禱告會</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">輸入代碼或掃描 QR Code</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'host') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl mx-auto pt-4">
          <Button variant="ghost" size="sm" onClick={() => setViewMode('home')} className="mb-4">
            <Home className="w-4 h-4 mr-2" />
            返回首頁
          </Button>

          {!currentMeetingId ? (
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
                  
                  {groupingMode === 'bySize' ? (
                    <div className="flex items-center gap-2">
                      <Label>每組</Label>
                      <Input
                        type="number"
                        value={groupSize}
                        onChange={(e) => setGroupSize(parseInt(e.target.value) || 4)}
                        className="w-20"
                        min={2}
                        max={20}
                      />
                      <span>人</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Label>分成</Label>
                      <Input
                        type="number"
                        value={groupCount}
                        onChange={(e) => setGroupCount(parseInt(e.target.value) || 3)}
                        className="w-20"
                        min={2}
                        max={20}
                      />
                      <span>組</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>性別分組</Label>
                  <RadioGroup value={genderMode} onValueChange={(v) => setGenderMode(v as GenderMode)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mixed" id="mixed" />
                      <Label htmlFor="mixed" className="cursor-pointer">男女混合</Label>
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
                >
                  {createMeetingMutation.isPending ? '建立中...' : '建立禱告會'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{meeting?.title || '禱告會'}</CardTitle>
                  <CardDescription>分享代碼讓參與者加入</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-center">
                      <div className="text-4xl font-mono font-bold tracking-widest text-purple-600 dark:text-purple-400">
                        {meeting?.shortCode}
                      </div>
                      <Button variant="ghost" size="sm" onClick={copyCode} className="mt-2">
                        {copiedCode ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                        {copiedCode ? '已複製' : '複製代碼'}
                      </Button>
                    </div>
                    {meeting?.shortCode && (
                      <img src={getQRCodeUrl(meeting.shortCode)} alt="QR Code" className="w-24 h-24" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-gray-500" />
                      <span className="text-gray-600 dark:text-gray-300">目前參與者</span>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
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
                    >
                      <Shuffle className="w-4 h-4 mr-2" />
                      {executeGroupingMutation.isPending ? '分組中...' : '開始分組'}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {meeting?.status === 'grouped' && (
                        <Button
                          onClick={() => updateStatusMutation.mutate('praying')}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          <PenLine className="w-4 h-4 mr-2" />
                          開始填寫禱告事項
                        </Button>
                      )}
                      
                      {(meeting?.status === 'praying' || meeting?.status === 'completed') && (
                        <>
                          <Button
                            onClick={() => setViewMode('presentation')}
                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                          >
                            <Presentation className="w-4 h-4 mr-2" />
                            投影展示模式
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {isGrouped && (
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="font-semibold">分組結果</h3>
                      {groupNumbers.map(groupNum => {
                        const color = getGroupColor(groupNum);
                        const members = groupedParticipants[groupNum];
                        return (
                          <Card key={groupNum} className={cn('border-2', color.border, color.bg)}>
                            <CardHeader className="pb-2">
                              <CardTitle className={cn('text-lg', color.text)}>第 {groupNum} 組</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {members.map(m => (
                                  <div key={m.id} className="flex items-start gap-2">
                                    <Badge variant="outline" className="shrink-0">
                                      {m.name}
                                    </Badge>
                                    {m.prayerRequest && (
                                      <span className="text-sm text-gray-600 dark:text-gray-300">
                                        {m.prayerRequest}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  <Button
                    variant="destructive"
                    onClick={() => deleteMeetingMutation.mutate()}
                    className="w-full"
                  >
                    關閉禱告會
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-8">
          <Button variant="ghost" size="sm" onClick={() => setViewMode('home')} className="mb-4">
            <Home className="w-4 h-4 mr-2" />
            返回首頁
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-green-500" />
                加入禱告會
              </CardTitle>
              <CardDescription>輸入活動代碼加入</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>活動代碼</Label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="輸入4位代碼"
                  maxLength={4}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <Button onClick={handleFindMeeting} className="w-full">
                查詢禱告會
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'meeting' || viewMode === 'praying') {
    if (!meeting) {
      return <div className="flex items-center justify-center p-8">載入中...</div>;
    }

    if (!hasJoined) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
          <div className="max-w-md mx-auto pt-8">
            <Button variant="ghost" size="sm" onClick={() => {
              setViewMode('home');
              setCurrentMeetingId(null);
            }} className="mb-4">
              <Home className="w-4 h-4 mr-2" />
              返回首頁
            </Button>

            <Card>
              <CardHeader>
                <CardTitle>{meeting.title}</CardTitle>
                <CardDescription>填寫您的資料加入</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="請輸入您的姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label>性別</Label>
                  <RadioGroup value={joinGender} onValueChange={(v) => setJoinGender(v as 'M' | 'F')}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="M" id="male" />
                        <Label htmlFor="male" className="cursor-pointer">男</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="F" id="female" />
                        <Label htmlFor="female" className="cursor-pointer">女</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                <Button
                  onClick={handleJoinMeeting}
                  disabled={joinMeetingMutation.isPending}
                  className="w-full"
                >
                  {joinMeetingMutation.isPending ? '加入中...' : '加入禱告會'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    if (!isGrouped) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
          <div className="max-w-md mx-auto pt-8">
            <Card className="text-center">
              <CardContent className="pt-8 pb-8">
                <Clock className="w-16 h-16 mx-auto text-purple-500 mb-4 animate-pulse" />
                <h2 className="text-xl font-semibold mb-2">等待分組中...</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">請等待主持人進行分組</p>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  目前 {participants.length} 人等待中
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    const color = myGroupNumber ? getGroupColor(myGroupNumber) : GROUP_COLORS[0];

    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-4">
          <div className={cn('text-center py-8 rounded-2xl mb-4', color.bg, 'border-2', color.border)}>
            <div className={cn('text-8xl font-bold', color.text)}>
              {myGroupNumber}
            </div>
            <p className={cn('text-lg mt-2', color.text)}>第 {myGroupNumber} 組</p>
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-2">
              <button
                type="button"
                onClick={() => setIsGroupListExpanded(!isGroupListExpanded)}
                className="flex items-center justify-between w-full"
                data-testid="button-toggle-group-list"
              >
                <CardTitle className="text-lg flex items-center gap-2">
                  同組成員
                  <Badge variant="secondary">{myGroupMembers.length}人</Badge>
                </CardTitle>
                {isGroupListExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </CardHeader>
            {isGroupListExpanded && (
              <CardContent>
                <div className="space-y-2">
                  {myGroupMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium', color.accent)}>
                        {m.name.charAt(0)}
                      </div>
                      <span className="font-medium">{m.name}</span>
                      {m.id === myParticipantId && <Badge variant="secondary">我</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {isPraying && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PenLine className="w-5 h-5" />
                  我的禱告事項
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {(!myParticipant?.prayerRequest && !myParticipant?.urgentPrayer && !myParticipant?.anonymousPrayer) || isEditingPrayer ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <Label className="font-medium text-red-600 dark:text-red-400">緊急禱告事項</Label>
                      </div>
                      <p className="text-xs text-red-500 dark:text-red-400">
                        非常緊急需要大家一起禱告的事項，會顯示在小組禱告清單及PPT投影上
                      </p>
                      <Textarea
                        value={myUrgentPrayer}
                        onChange={(e) => setMyUrgentPrayer(e.target.value)}
                        placeholder="請輸入緊急禱告事項..."
                        rows={3}
                        data-testid="textarea-urgent-prayer"
                      />
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <Label className="font-medium">一般禱告事項</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        可以在小組裡公開代禱的事項，顯示在小組禱告清單裡面
                      </p>
                      <Textarea
                        value={myNamedPrayer}
                        onChange={(e) => setMyNamedPrayer(e.target.value)}
                        placeholder="請輸入一般禱告事項..."
                        rows={3}
                        data-testid="textarea-named-prayer"
                      />
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-gray-500" />
                        <Label className="font-medium">匿名禱告事項</Label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        不方便公布姓名但需要大家禱告，不顯示在小組清單，但可以顯示在PPT讓大家一起禱告
                      </p>
                      <Textarea
                        value={myAnonymousPrayer}
                        onChange={(e) => setMyAnonymousPrayer(e.target.value)}
                        placeholder="請輸入匿名禱告事項..."
                        rows={3}
                        data-testid="textarea-anonymous-prayer"
                      />
                    </div>

                    <Button
                      onClick={() => updateBothPrayersMutation.mutate({ namedPrayer: myNamedPrayer, urgentPrayer: myUrgentPrayer, anonymousPrayer: myAnonymousPrayer })}
                      disabled={updateBothPrayersMutation.isPending}
                      className="w-full"
                      data-testid="button-save-prayers"
                    >
                      {updateBothPrayersMutation.isPending ? '儲存中...' : '儲存禱告事項'}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    {myParticipant?.urgentPrayer && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mb-1">
                          <AlertTriangle className="w-3 h-3" />
                          緊急禱告：
                        </div>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {myParticipant.urgentPrayer.length > 50
                            ? `${myParticipant.urgentPrayer.substring(0, 50)}...`
                            : myParticipant.urgentPrayer}
                        </p>
                      </div>
                    )}
                    {myParticipant?.prayerRequest && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">一般禱告：</div>
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                          {myParticipant.prayerRequest.length > 50
                            ? `${myParticipant.prayerRequest.substring(0, 50)}...`
                            : myParticipant.prayerRequest}
                        </p>
                      </div>
                    )}
                    {myParticipant?.anonymousPrayer && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <EyeOff className="w-3 h-3" />
                          匿名禱告：
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                          {myParticipant.anonymousPrayer.length > 50
                            ? `${myParticipant.anonymousPrayer.substring(0, 50)}...`
                            : myParticipant.anonymousPrayer}
                        </p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setIsEditingPrayer(true)}
                      className="w-full"
                      data-testid="button-edit-prayer"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      編輯
                    </Button>
                  </div>
                )}

                {myGroupMembers.some(m => (m.prayerRequest || m.urgentPrayer) && !m.isAnonymous) && (
                  <div className="pt-4 border-t space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">組員禱告事項</h4>
                    <div className="space-y-3">
                      {myGroupMembers.filter(m => (m.prayerRequest || m.urgentPrayer) && !m.isAnonymous).map(m => (
                        <div key={m.id} className={cn(
                          "flex gap-3 p-3 rounded-lg border",
                          m.id === myParticipantId 
                            ? "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700" 
                            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        )}>
                          <div className="shrink-0">
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium', color.accent)}>
                              {m.name.charAt(0)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">{m.name}</span>
                              {m.id === myParticipantId && (
                                <Badge variant="secondary" className="text-xs">我</Badge>
                              )}
                              {m.prayerCategory && (
                                <Badge variant="outline" className="text-xs">{m.prayerCategory}</Badge>
                              )}
                              {m.urgentPrayer && (
                                <Badge variant="destructive" className="text-xs">緊急</Badge>
                              )}
                            </div>
                            {m.urgentPrayer && (
                              <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap break-words mb-1">{m.urgentPrayer}</p>
                            )}
                            {m.prayerRequest && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">{m.prayerRequest}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default PrayerMeetingManager;
