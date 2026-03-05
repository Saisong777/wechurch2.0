import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPollingInterval } from '@/lib/retry-utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Shuffle, Copy, Check, Users, Sparkles, UserPlus, Crown, Clock, QrCode, Search, Home } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';

interface GroupingActivity {
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

interface GroupingParticipant {
  id: string;
  activityId: string;
  name: string;
  gender: string;
  groupNumber: number | null;
  joinedAt: string;
}

type GroupingMode = 'bySize' | 'byCount';
type GenderMode = 'mixed' | 'split';
type ViewMode = 'home' | 'host' | 'join' | 'activity';

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

export const RandomGrouper = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);
  
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('bySize');
  const [groupSize, setGroupSize] = useState(4);
  const [groupCount, setGroupCount] = useState(3);
  const [genderMode, setGenderMode] = useState<GenderMode>('mixed');
  
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinGender, setJoinGender] = useState<'M' | 'F' | ''>('');
  const [hasJoined, setHasJoined] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activityDeleted, setActivityDeleted] = useState(false);

  const isLeaderOrAbove = user?.role && ['leader', 'future_leader', 'admin'].includes(user.role);

  const { data: myActivitiesData, refetch: refetchMyActivities } = useQuery<{ activities: { activity: GroupingActivity; participants: GroupingParticipant[] }[] }>({
    queryKey: ['/api/grouping/my-activities'],
    enabled: isLeaderOrAbove,
    refetchInterval: viewMode === 'host' ? getPollingInterval(5000) : false,
  });

  const { data: activityData, refetch: refetchActivity, error: activityError } = useQuery<{ activity: GroupingActivity; participants: GroupingParticipant[] }>({
    queryKey: [`/api/grouping/${currentActivityId}`],
    enabled: !!currentActivityId && viewMode === 'activity',
    refetchInterval: getPollingInterval(5000),
    retry: false,
  });

  const activity = activityData?.activity;
  const participants = activityData?.participants || [];
  const isOwner = activity?.ownerId === user?.id;
  const isFinished = activity?.status === 'finished';

  // Detect when activity is deleted by leader and redirect to homepage
  useEffect(() => {
    if (activityError && viewMode === 'activity' && currentActivityId && !activityDeleted) {
      const errorMessage = (activityError as Error)?.message || '';
      const isNotFound = errorMessage.startsWith('404') || errorMessage.includes('not found') || errorMessage.includes('Not Found');
      if (isNotFound) {
        setActivityDeleted(true);
        toast.info('活動已結束，返回首頁');
        setTimeout(() => {
          setViewMode('home');
          setCurrentActivityId(null);
          setHasJoined(false);
          setMyParticipantId(null);
          setActivityDeleted(false);
          navigate('/');
        }, 1500);
      }
    }
  }, [activityError, viewMode, currentActivityId, navigate, activityDeleted]);

  useEffect(() => {
    if (!activity && viewMode === 'activity' && !activityError && !activityDeleted) {
      setViewMode('home');
      setCurrentActivityId(null);
    }
  }, [activity, viewMode, activityError, activityDeleted]);

  useEffect(() => {
    if (currentActivityId) {
      const stored = localStorage.getItem(`grouping_participant_${currentActivityId}`);
      if (stored) {
        setHasJoined(true);
        setMyParticipantId(stored);
      } else {
        setHasJoined(false);
        setJoinName('');
        setJoinGender('');
        setMyParticipantId(null);
      }
    }
  }, [currentActivityId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/grouping', {
        title: '神的安排',
        groupingMode,
        groupSize,
        groupCount,
        genderMode,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/grouping/my-activities'] });
      setCurrentActivityId(data.id);
      setViewMode('activity');
      toast.success(`活動已建立！代碼：${data.shortCode}`);
    },
    onError: (error: any) => {
      toast.error(error?.message || '建立活動失敗');
    },
  });

  const lookupMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch(`/api/grouping/code/${code.toUpperCase()}`);
      if (!response.ok) {
        throw new Error('找不到此活動代碼');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setCurrentActivityId(data.activity.id);
      setViewMode('activity');
    },
    onError: (error: any) => {
      toast.error(error?.message || '找不到此活動');
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!currentActivityId) throw new Error('No activity');
      const response = await apiRequest('POST', `/api/grouping/${currentActivityId}/join`, { name: joinName, gender: joinGender });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/grouping/${currentActivityId}`] });
      setHasJoined(true);
      setMyParticipantId(data?.id || null);
      if (data?.id && currentActivityId) {
        localStorage.setItem(`grouping_participant_${currentActivityId}`, data.id);
      }
      toast.success('加入成功！');
    },
    onError: (error: any) => {
      toast.error(error?.message || '加入失敗');
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!currentActivityId) throw new Error('No activity');
      return apiRequest('POST', `/api/grouping/${currentActivityId}/execute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/grouping/${currentActivityId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/grouping/my-activities'] });
      toast.success('分組完成！');
    },
    onError: (error: any) => {
      toast.error(error?.message || '分組失敗');
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!currentActivityId) throw new Error('No activity');
      return apiRequest('POST', `/api/grouping/${currentActivityId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/grouping/${currentActivityId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/grouping/my-activities'] });
      setHasJoined(false);
      setCurrentActivityId(null);
      setViewMode('home');
      toast.success('活動已結束');
    },
    onError: (error: any) => {
      toast.error(error?.message || '結束活動失敗');
    },
  });

  const copyResults = () => {
    if (!isFinished || participants.length === 0) return;
    
    const groups: { [key: number]: GroupingParticipant[] } = {};
    participants.forEach(p => {
      if (p.groupNumber) {
        if (!groups[p.groupNumber]) groups[p.groupNumber] = [];
        groups[p.groupNumber].push(p);
      }
    });

    const text = Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([num, members]) => `【第 ${num} 組】\n${members.map(m => `${m.name} (${m.gender === 'M' ? '男' : '女'})`).join('\n')}`)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success('已複製分組結果');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('已複製代碼');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getQRCodeUrl = (code: string) => {
    const url = `${window.location.origin}/icebreaker?code=${code}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && code.length === 4) {
      setJoinCode(code.toUpperCase());
      lookupMutation.mutate(code);
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full gradient-gold flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-secondary-foreground" />
          </div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'home') {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            神的安排
          </h1>
          <p className="text-muted-foreground text-sm">隨機分組工具</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4" />
              加入活動
            </CardTitle>
            <CardDescription>輸入 4 位數代碼加入分組活動</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="輸入 4 位數代碼"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                className="text-center text-lg font-mono tracking-widest"
                maxLength={4}
                data-testid="input-join-code"
              />
              <Button
                onClick={() => lookupMutation.mutate(joinCode)}
                disabled={joinCode.length !== 4 || lookupMutation.isPending}
                data-testid="button-lookup"
              >
                加入
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLeaderOrAbove && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                組長功能
              </CardTitle>
              <CardDescription>建立新的分組活動</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setViewMode('host')}
                className="w-full"
                size="lg"
                data-testid="button-create-new"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                建立分組活動
              </Button>

              {myActivitiesData?.activities && myActivitiesData.activities.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">進行中的活動：</p>
                  {myActivitiesData.activities.map(({ activity: act, participants: parts }) => (
                    <Button
                      key={act.id}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => {
                        setCurrentActivityId(act.id);
                        setViewMode('activity');
                      }}
                      data-testid={`button-activity-${act.shortCode}`}
                    >
                      <span className="font-mono">{act.shortCode}</span>
                      <Badge variant="secondary">{parts.length} 人</Badge>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (viewMode === 'host') {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            神的安排
          </h1>
          <p className="text-muted-foreground text-sm">建立隨機分組活動</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              活動設定
            </CardTitle>
            <CardDescription>設定分組方式，然後開啟活動讓大家加入</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">分組方式</Label>
                <RadioGroup
                  value={groupingMode}
                  onValueChange={(v) => setGroupingMode(v as GroupingMode)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bySize" id="bySize" data-testid="radio-by-size" />
                    <Label htmlFor="bySize" className="text-sm cursor-pointer">每組人數</Label>
                    {groupingMode === 'bySize' && (
                      <Input
                        type="number"
                        min={2}
                        max={20}
                        value={groupSize}
                        onChange={(e) => setGroupSize(parseInt(e.target.value) || 4)}
                        className="w-16 text-center"
                        data-testid="input-group-size"
                      />
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="byCount" id="byCount" data-testid="radio-by-count" />
                    <Label htmlFor="byCount" className="text-sm cursor-pointer">總組數</Label>
                    {groupingMode === 'byCount' && (
                      <Input
                        type="number"
                        min={2}
                        max={50}
                        value={groupCount}
                        onChange={(e) => setGroupCount(parseInt(e.target.value) || 3)}
                        className="w-16 text-center"
                        data-testid="input-group-count"
                      />
                    )}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">性別選項</Label>
                <RadioGroup
                  value={genderMode}
                  onValueChange={(v) => setGenderMode(v as GenderMode)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mixed" id="mixed" data-testid="radio-mixed" />
                    <Label htmlFor="mixed" className="text-sm cursor-pointer">男女混合</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="split" id="split" data-testid="radio-split" />
                    <Label htmlFor="split" className="text-sm cursor-pointer">男女分開</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setViewMode('home')}
                className="flex-1"
              >
                返回
              </Button>
              <Button 
                onClick={() => createMutation.mutate()}
                className="flex-1"
                size="lg"
                disabled={createMutation.isPending}
                data-testid="button-create-activity"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                開啟活動
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewMode === 'activity' && activity) {
    const groups: { [key: number]: GroupingParticipant[] } = {};
    if (isFinished) {
      participants.forEach(p => {
        if (p.groupNumber) {
          if (!groups[p.groupNumber]) groups[p.groupNumber] = [];
          groups[p.groupNumber].push(p);
        }
      });
    }

    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            神的安排
          </h1>
          <p className="text-muted-foreground text-sm">
            {isFinished ? '分組結果' : '隨機分組活動進行中'}
          </p>
        </div>

        {!isFinished && (isOwner || user?.role === 'admin') && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">分享代碼</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-3xl font-mono font-bold tracking-widest">{activity.shortCode}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyCode(activity.shortCode)}
                      data-testid="button-copy-code"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <img 
                    src={getQRCodeUrl(activity.shortCode)} 
                    alt="QR Code"
                    className="w-24 h-24 rounded-lg border bg-white"
                    loading="lazy"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <QrCode className="w-3 h-3" />
                    掃碼加入
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isFinished && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  目前參與者 ({participants.length} 人)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    <Clock className="w-5 h-5 inline-block mr-2" />
                    等待參與者加入...
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {participants.map((p) => (
                      <Badge
                        key={p.id}
                        variant="secondary"
                        className={cn(
                          "text-sm",
                          p.gender === 'M' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-pink-100 dark:bg-pink-900/30'
                        )}
                      >
                        {p.name}
                        <span className="ml-1 text-xs opacity-60">
                          {p.gender === 'M' ? '♂' : '♀'}
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {!hasJoined && !(isOwner || user?.role === 'admin') && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">加入活動</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-name">姓名</Label>
                    <Input
                      id="join-name"
                      placeholder="請輸入您的姓名"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      data-testid="input-join-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>性別</Label>
                    <RadioGroup
                      value={joinGender}
                      onValueChange={(v) => setJoinGender(v as 'M' | 'F')}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="M" id="gender-m" data-testid="radio-gender-m" />
                        <Label htmlFor="gender-m" className="cursor-pointer">男</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="F" id="gender-f" data-testid="radio-gender-f" />
                        <Label htmlFor="gender-f" className="cursor-pointer">女</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button
                    onClick={() => joinMutation.mutate()}
                    className="w-full"
                    disabled={!joinName.trim() || !joinGender || joinMutation.isPending}
                    data-testid="button-join"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    加入活動
                  </Button>
                </CardContent>
              </Card>
            )}

            {hasJoined && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="py-4 text-center">
                  <Check className="w-8 h-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
                  <p className="font-medium">您已加入活動</p>
                  <p className="text-sm text-muted-foreground">請等待組長開始分組</p>
                </CardContent>
              </Card>
            )}

            {(isOwner || user?.role === 'admin') && (
              <div className="flex gap-3">
                <Button
                  onClick={() => executeMutation.mutate()}
                  className="flex-1"
                  size="lg"
                  disabled={participants.length < 2 || executeMutation.isPending}
                  data-testid="button-execute"
                >
                  <Shuffle className="w-5 h-5 mr-2" />
                  開始分組 ({participants.length} 人)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  data-testid="button-close"
                >
                  取消
                </Button>
              </div>
            )}
          </>
        )}

        {isFinished && Object.keys(groups).length > 0 && (
          <>
            {/* Leader view - shows all groups */}
            {(isOwner || user?.role === 'admin') ? (
              <>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    組長檢視模式
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyResults}
                    data-testid="button-copy-all"
                  >
                    {copiedAll ? (
                      <Check className="w-4 h-4 mr-1 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    複製結果
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(groups)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([num, members]) => {
                      const color = getGroupColor(Number(num));
                      return (
                        <Card 
                          key={num}
                          className={cn("border-2", color.bg, color.border)}
                          data-testid={`card-group-${num}`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl", color.accent)}>
                                {num}
                              </div>
                              <div>
                                <CardTitle className={cn("text-lg", color.text)}>第 {num} 組</CardTitle>
                                <p className="text-sm text-muted-foreground">{members.length} 人</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-1">
                              {members.map((member) => (
                                <li 
                                  key={member.id}
                                  className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                                >
                                  <span>{member.name}</span>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs",
                                      member.gender === 'M' 
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                                        : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                                    )}
                                  >
                                    {member.gender === 'M' ? '男' : '女'}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>

                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setViewMode('home');
                      setCurrentActivityId(null);
                    }}
                  >
                    <Home className="w-4 h-4 mr-2" />
                    返回首頁
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                    data-testid="button-finish"
                  >
                    結束活動
                  </Button>
                </div>
              </>
            ) : (
              /* Participant view - shows only their own group with large number */
              (() => {
                const myParticipant = myParticipantId 
                  ? participants.find(p => p.id === myParticipantId)
                  : null;
                const myGroup = myParticipant?.groupNumber || null;
                const myGroupMembers = myGroup ? groups[myGroup] || [] : [];
                const color = myGroup ? getGroupColor(myGroup) : GROUP_COLORS[0];

                if (!myGroup) {
                  return (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground">找不到您的分組資料</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => {
                            setViewMode('home');
                            setCurrentActivityId(null);
                          }}
                        >
                          <Home className="w-4 h-4 mr-2" />
                          返回首頁
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* Large group number display */}
                    <Card className={cn("border-4", color.bg, color.border)}>
                      <CardContent className="py-8">
                        <div className="text-center space-y-4">
                          <div className={cn(
                            "w-32 h-32 mx-auto rounded-full flex items-center justify-center text-white font-bold shadow-lg",
                            color.accent
                          )}>
                            <span className="text-6xl">{myGroup}</span>
                          </div>
                          <div>
                            <h2 className={cn("text-3xl font-bold", color.text)}>第 {myGroup} 組</h2>
                            <p className="text-muted-foreground mt-1">請找到同組的組員！</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Group members list */}
                    <Card className={cn("border-2", color.bg, color.border)}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          組員名單 ({myGroupMembers.length} 人)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {myGroupMembers.map((member) => {
                            const isMe = member.id === myParticipantId;
                            return (
                              <li 
                                key={member.id}
                                className={cn(
                                  "flex items-center justify-between py-2 px-3 rounded-lg",
                                  isMe 
                                    ? "bg-primary/10 border border-primary/30" 
                                    : "bg-muted/50"
                                )}
                              >
                                <span className={cn(
                                  "font-medium",
                                  isMe && "text-primary"
                                )}>
                                  {member.name}
                                  {isMe && (
                                    <span className="ml-2 text-xs text-muted-foreground">(你)</span>
                                  )}
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    member.gender === 'M' 
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                                      : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                                  )}
                                >
                                  {member.gender === 'M' ? '男' : '女'}
                                </Badge>
                              </li>
                            );
                          })}
                        </ul>
                      </CardContent>
                    </Card>

                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setViewMode('home');
                          setCurrentActivityId(null);
                        }}
                      >
                        <Home className="w-4 h-4 mr-2" />
                        返回首頁
                      </Button>
                    </div>
                  </div>
                );
              })()
            )}
          </>
        )}
      </div>
    );
  }

  return null;
};
