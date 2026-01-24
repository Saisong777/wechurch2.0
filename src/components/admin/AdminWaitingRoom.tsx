import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useSession } from '@/contexts/SessionContext';
import { useRealtime } from '@/hooks/useRealtime';
import { fetchParticipants, assignGroupsToParticipants } from '@/lib/supabase-helpers';
import { Users, UserCheck, Settings, Shuffle, Scale, Copy } from 'lucide-react';
import { GroupingSettings } from '@/types/bible-study';
import { toast } from 'sonner';
import { SessionQRCode } from './SessionQRCode';
import { StressTestSimulator } from './StressTestSimulator';

interface AdminWaitingRoomProps {
  onGroupingComplete: () => void;
}

export const AdminWaitingRoom: React.FC<AdminWaitingRoomProps> = ({ onGroupingComplete }) => {
  const { users, setUsers, currentSession, setCurrentSession, addUser } = useSession();
  const [showSettings, setShowSettings] = useState(false);
  const [minSize, setMinSize] = useState(4);
  const [maxSize, setMaxSize] = useState(6);
  const [method, setMethod] = useState<'random' | 'gender-balanced'>('random');
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
  useEffect(() => {
    const loadParticipants = async () => {
      if (currentSession?.id) {
        const participants = await fetchParticipants(currentSession.id);
        setUsers(participants);
      }
    };
    loadParticipants();
  }, [currentSession?.id, setUsers]);

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
    if (currentSession?.id) {
      navigator.clipboard.writeText(currentSession.id);
      toast.success('Session ID 已複製！');
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
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Session Info + QR Code */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card variant="highlight" className="md:col-span-2">
          <CardContent className="py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-muted-foreground">今日經文</p>
                <p className="font-serif text-xl font-bold text-foreground">
                  {currentSession?.verseReference}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={handleCopySessionId}>
                  <Copy className="w-4 h-4 mr-2" />
                  複製 ID
                </Button>
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
            verseReference={currentSession.verseReference}
          />
        )}
      </div>

      {/* Participants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" />
              已加入成員 Participants
            </CardTitle>
            <div className="flex items-center gap-4 text-sm flex-wrap">
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
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>等待成員加入...</p>
              <p className="text-sm mt-1">Waiting for participants to join...</p>
            </div>
          ) : (
            <div className="space-y-6">
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {locationUsers.map((user, index) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-slide-in-right"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center text-secondary-foreground font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{user.name}</p>
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-secondary" />
              分組設定 Grouping Settings
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? '收起' : '展開'}
            </Button>
          </div>
        </CardHeader>
        {showSettings && (
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minSize">每組最少人數 Min</Label>
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
                  className="text-center text-lg font-medium"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxSize">每組最多人數 Max</Label>
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
                  className="text-center text-lg font-medium"
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
                onValueChange={(value) => setMethod(value as 'random' | 'gender-balanced')}
                className="grid grid-cols-2 gap-4"
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
                    <p className="text-sm text-muted-foreground">Gender-balanced</p>
                  </div>
                </Label>
            </RadioGroup>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Stress Test Simulator */}
      <StressTestSimulator 
        onParticipantsGenerated={async () => {
          // Refresh participants after generation
          if (currentSession?.id) {
            const participants = await fetchParticipants(currentSession.id);
            setUsers(participants);
          }
        }}
      />
      <Button
        variant="gold"
        size="xl"
        className="w-full"
        onClick={handleStartGrouping}
        disabled={users.length < 2 || isGrouping}
      >
        {isGrouping ? (
          '分組中...'
        ) : (
          <>
            <UserCheck className="w-5 h-5" />
            開始分組 Start Grouping ({users.length} 人)
          </>
        )}
      </Button>
    </div>
  );
};
