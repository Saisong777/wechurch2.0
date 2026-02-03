import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Shuffle, Copy, Check, Users, Sparkles, UserPlus, Crown, Clock, QrCode, Search } from 'lucide-react';
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
  'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
  'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
  'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700',
  'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',
  'bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700',
  'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-300 dark:border-cyan-700',
  'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
  'bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700',
];

export const RandomGrouper = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
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
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isLeaderOrAbove = user?.role && ['leader', 'future_leader', 'admin'].includes(user.role);

  const { data: myActivitiesData, refetch: refetchMyActivities } = useQuery<{ activities: { activity: GroupingActivity; participants: GroupingParticipant[] }[] }>({
    queryKey: ['/api/grouping/my-activities'],
    enabled: isLeaderOrAbove,
    refetchInterval: viewMode === 'host' ? 3000 : false,
  });

  const { data: activityData, refetch: refetchActivity } = useQuery<{ activity: GroupingActivity; participants: GroupingParticipant[] }>({
    queryKey: [`/api/grouping/${currentActivityId}`],
    enabled: !!currentActivityId && viewMode === 'activity',
    refetchInterval: 3000,
  });

  const activity = activityData?.activity;
  const participants = activityData?.participants || [];
  const isOwner = activity?.ownerId === user?.id;
  const isFinished = activity?.status === 'finished';

  useEffect(() => {
    if (!activity && viewMode === 'activity') {
      setViewMode('home');
      setCurrentActivityId(null);
    }
  }, [activity, viewMode]);

  useEffect(() => {
    setHasJoined(false);
    setJoinName('');
    setJoinGender('');
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
      return apiRequest('POST', `/api/grouping/${currentActivityId}/join`, { name: joinName, gender: joinGender });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/grouping/${currentActivityId}`] });
      setHasJoined(true);
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
            <div className="flex items-center justify-end">
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
                .map(([num, members]) => (
                  <Card 
                    key={num}
                    className={cn("border-2", GROUP_COLORS[(Number(num) - 1) % GROUP_COLORS.length])}
                    data-testid={`card-group-${num}`}
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        第 {num} 組
                        <Badge variant="secondary" className="text-xs">
                          {members.length} 人
                        </Badge>
                      </CardTitle>
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
                ))}
            </div>

            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setViewMode('home');
                  setCurrentActivityId(null);
                }}
              >
                返回首頁
              </Button>
              {(isOwner || user?.role === 'admin') && (
                <Button
                  variant="outline"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  data-testid="button-finish"
                >
                  結束活動
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};
