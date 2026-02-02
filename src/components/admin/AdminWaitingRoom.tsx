import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useSession } from '@/contexts/SessionContext';
import { useRealtime } from '@/hooks/useRealtime';
import { assignGroupsToParticipants } from '@/lib/supabase-helpers';
import { Users, UserCheck, Settings, Shuffle, Scale, Copy, UserX, Share2 } from 'lucide-react';
import { GroupingSettings, User } from '@/types/bible-study';
import { toast } from 'sonner';
import { SessionQRCode } from './SessionQRCode';
import { StressTestSimulator } from './StressTestSimulator';
import { getSessionJoinUrl } from '@/lib/url-helpers';

// Fetch participants from Express API
const fetchParticipantsFromAPI = async (sessionId: string): Promise<User[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/participants`, {
      credentials: 'include',
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email || '',
      gender: p.gender as 'male' | 'female',
      groupNumber: p.groupNumber,
      readyConfirmed: p.readyConfirmed || false,
      location: p.location || 'On-site',
    }));
  } catch (error) {
    console.error('Error fetching participants:', error);
    return [];
  }
};

interface AdminWaitingRoomProps {
  onGroupingComplete: () => void;
}

export const AdminWaitingRoom: React.FC<AdminWaitingRoomProps> = ({ onGroupingComplete }) => {
  const { users, setUsers, currentSession, setCurrentSession, addUser } = useSession();
  const [showSettings, setShowSettings] = useState(false);
  const [minSize, setMinSize] = useState(4);
  const [maxSize, setMaxSize] = useState(6);
  const [method, setMethod] = useState<'random' | 'gender-balanced' | 'gender-separated'>('random');
  const [isGrouping, setIsGrouping] = useState(false);

  // Real-time updates
  useRealtime({
    sessionId: currentSession?.id || null,
    onParticipantJoined: (user) => {
      addUser(user);
      toast.success(`${user.name} 已加入！`);
    },
  });

  // Load existing participants on mount
  const loadParticipants = useCallback(async () => {
    if (currentSession?.id) {
      const participants = await fetchParticipantsFromAPI(currentSession.id);
      setUsers(participants);
    }
  }, [currentSession?.id, setUsers]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  const maleCount = users.filter(u => u.gender === 'male').length;
  const femaleCount = users.filter(u => u.gender === 'female').length;
  
  // Group users by location for display
  const locationGroups = users.reduce((acc, user) => {
    const loc = user.location || 'On-site';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(user);
    return acc;
  }, {} as Record<string, typeof users>);
  
  const locationCount = Object.keys(locationGroups).length;

  const handleCopySessionId = () => {
    const codeToCopy = currentSession?.shortCode || currentSession?.id;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy);
      toast.success('課程代碼已複製！');
    }
  };

  const handleShare = async () => {
    const code = currentSession?.shortCode || currentSession?.id;
    if (!code) return;
    
    const joinUrl = getSessionJoinUrl(code);
    const shareText = `🏋️ Soul Gym 靈魂健身房\n\n📖 ${currentSession?.verseReference || '查經聚會'}\n\n加入代碼: ${code}\n點擊連結加入: ${joinUrl}`;
    
    // Check if Web Share API is available (mainly mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Soul Gym 靈魂健身房',
          text: shareText,
          url: joinUrl,
        });
        toast.success('分享成功！');
      } catch (err) {
        // User cancelled or share failed - copy to clipboard as fallback
        if ((err as Error).name !== 'AbortError') {
          navigator.clipboard.writeText(shareText);
          toast.success('已複製分享內容！');
        }
      }
    } else {
      // Fallback for desktop - copy formatted text
      navigator.clipboard.writeText(shareText);
      toast.success('已複製分享內容，可貼到 LINE 或其他軟體！');
    }
  };

  const handleStartGrouping = async () => {
    if (!currentSession?.id) return;
    
    setIsGrouping(true);
    
    try {
      const settings: GroupingSettings = { minSize, maxSize, method };
      const groups = await assignGroupsToParticipants(currentSession.id, users, settings);
      
      // Update local state with groups and set status to 'grouping' (verification phase)
      const updatedUsers = users.map(u => {
        const group = groups.find(g => g.members.some(m => m.id === u.id));
        return group ? { ...u, groupNumber: group.number, readyConfirmed: false } : u;
      });
      
      setCurrentSession({ ...currentSession, groups, status: 'grouping' });
      setUsers(updatedUsers);
      
      toast.success(`分組完成！已分為 ${groups.length} 組，進入驗證階段。`, {
        description: 'Grouping complete! Entering verification phase.',
        duration: 5000,
      });
      
      setIsGrouping(false);
      onGroupingComplete();
    } catch (error) {
      console.error('Grouping error:', error);
      toast.error('分組失敗，請重試');
      setIsGrouping(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Session Info + QR Code */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <Card variant="highlight" className="md:col-span-2">
          <CardContent className="py-4 sm:py-6 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-muted-foreground">今日經文</p>
                <p className="font-serif text-lg sm:text-xl font-bold text-foreground">
                  {currentSession?.verseReference}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-lg">
                  <span className="font-mono font-bold text-lg">
                    {currentSession?.shortCode || currentSession?.id?.slice(0, 8)}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopySessionId} title="複製代碼">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleShare} title="分享到 LINE">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-accent">
                  <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
                  <span className="font-medium text-sm">等待中</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* QR Code */}
        {currentSession?.id && (
          <SessionQRCode 
            sessionId={currentSession.id}
            shortCode={currentSession.shortCode}
            verseReference={currentSession.verseReference}
          />
        )}
      </div>

      {/* Participants */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="w-5 h-5 text-secondary" />
              已加入成員 Participants
            </CardTitle>
            <div className="flex items-center gap-3 sm:gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1">
                👨 <strong>{maleCount}</strong> 男
              </span>
              <span className="flex items-center gap-1">
                👩 <strong>{femaleCount}</strong> 女
              </span>
              {locationCount > 1 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  📍 <strong>{locationCount}</strong> 地點
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {users.length === 0 ? (
            <div className="text-center py-10 sm:py-12 text-muted-foreground">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
              <p className="text-base sm:text-lg">等待成員加入...</p>
              <p className="text-sm mt-1">Waiting for participants to join...</p>
            </div>
          ) : (
            <div className="space-y-5 sm:space-y-6">
              {Object.entries(locationGroups).map(([location, locationUsers]) => (
                <div key={location}>
                  {locationCount > 1 && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                      <span className="font-medium">
                        {location === 'On-site' ? '📍 現場' : `📍 ${location}`}
                      </span>
                      <span>({locationUsers.length} 人)</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                    {locationUsers.map((user, index) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2 sm:gap-3 p-3 sm:p-3 rounded-lg bg-muted/50 animate-slide-in-right"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full gradient-gold flex items-center justify-center text-secondary-foreground font-bold text-sm sm:text-base flex-shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.gender === 'male' ? '男' : '女'}
                            {locationCount === 1 && user.location !== 'On-site' && ` • ${user.location}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grouping Settings */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Settings className="w-5 h-5 text-secondary" />
              分組設定 Grouping Settings
            </CardTitle>
            <Button
              variant="ghost"
              size="default"
              onClick={() => setShowSettings(!showSettings)}
              className="h-10 sm:h-9"
            >
              {showSettings ? '收起' : '展開'}
            </Button>
          </div>
        </CardHeader>
        {showSettings && (
          <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="minSize" className="text-sm sm:text-base">每組最少人數 Min</Label>
                <Input
                  id="minSize"
                  type="number"
                  min={2}
                  max={10}
                  value={minSize}
                  onChange={(e) => {
                    const val = Math.max(2, Math.min(10, parseInt(e.target.value) || 2));
                    setMinSize(val);
                    if (val > maxSize) setMaxSize(val);
                  }}
                  className="text-center text-lg font-medium h-12 sm:h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxSize" className="text-sm sm:text-base">每組最多人數 Max</Label>
                <Input
                  id="maxSize"
                  type="number"
                  min={2}
                  max={12}
                  value={maxSize}
                  onChange={(e) => {
                    const val = Math.max(2, Math.min(12, parseInt(e.target.value) || 2));
                    setMaxSize(val);
                    if (val < minSize) setMinSize(val);
                  }}
                  className="text-center text-lg font-medium h-12 sm:h-11"
                />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              💡 優先以 {minSize} 人分組，不足時才擴展到 {maxSize} 人
            </p>

            <div className="space-y-3">
              <Label className="text-base">分組方式 Grouping Method</Label>
              <RadioGroup
                value={method}
                onValueChange={(value) => setMethod(value as 'random' | 'gender-balanced' | 'gender-separated')}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <Label
                  htmlFor="random"
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    method === 'random' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <RadioGroupItem value="random" id="random" />
                  <Shuffle className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">隨機分組</p>
                    <p className="text-sm text-muted-foreground">Random</p>
                  </div>
                </Label>
                <Label
                  htmlFor="gender-balanced"
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    method === 'gender-balanced' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <RadioGroupItem value="gender-balanced" id="gender-balanced" />
                  <Scale className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">性別平衡</p>
                    <p className="text-sm text-muted-foreground">Balanced</p>
                  </div>
                </Label>
                <Label
                  htmlFor="gender-separated"
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    method === 'gender-separated' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <RadioGroupItem value="gender-separated" id="gender-separated" />
                  <UserX className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">男女分組</p>
                    <p className="text-sm text-muted-foreground">Separated</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Stress Test Simulator */}
      <StressTestSimulator 
        onParticipantsGenerated={loadParticipants}
      />
      <Button
        variant="gold"
        size="xl"
        className="w-full h-14 sm:h-12 text-base sm:text-lg"
        onClick={handleStartGrouping}
        disabled={users.length < 2 || isGrouping}
      >
        {isGrouping ? (
          '分組中...'
        ) : (
          <>
            <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            開始分組 Start Grouping ({users.length} 人)
          </>
        )}
      </Button>
    </div>
  );
};
