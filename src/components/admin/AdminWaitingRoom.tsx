import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useSession } from '@/contexts/SessionContext';
import { Users, UserCheck, Settings, Shuffle, Scale } from 'lucide-react';
import { GroupingSettings } from '@/types/bible-study';

interface AdminWaitingRoomProps {
  onGroupingComplete: () => void;
}

export const AdminWaitingRoom: React.FC<AdminWaitingRoomProps> = ({ onGroupingComplete }) => {
  const { users, currentSession, assignGroups } = useSession();
  const [showSettings, setShowSettings] = useState(false);
  const [groupSize, setGroupSize] = useState(4);
  const [method, setMethod] = useState<'random' | 'gender-balanced'>('random');
  const [isGrouping, setIsGrouping] = useState(false);

  const maleCount = users.filter(u => u.gender === 'male').length;
  const femaleCount = users.filter(u => u.gender === 'female').length;

  const handleStartGrouping = async () => {
    setIsGrouping(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const settings: GroupingSettings = { groupSize, method };
    assignGroups(settings);
    
    setIsGrouping(false);
    onGroupingComplete();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Session Info */}
      <Card variant="highlight">
        <CardContent className="py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground">今日經文</p>
              <p className="font-serif text-xl font-bold text-foreground">
                {currentSession?.verseReference}
              </p>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
              <span className="font-medium">等待參加者加入中</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" />
              已加入成員 Participants
            </CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                👨 <strong>{maleCount}</strong> 男
              </span>
              <span className="flex items-center gap-1">
                👩 <strong>{femaleCount}</strong> 女
              </span>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {users.map((user, index) => (
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
                    </p>
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
            <div className="space-y-4">
              <Label className="text-base">每組人數 Group Size: {groupSize} 人</Label>
              <Slider
                value={[groupSize]}
                onValueChange={(value) => setGroupSize(value[0])}
                min={3}
                max={7}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>3人</span>
                <span>7人</span>
              </div>
            </div>

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

      {/* Start Grouping Button */}
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
