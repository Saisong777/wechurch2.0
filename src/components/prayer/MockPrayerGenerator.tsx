import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Wand2, Loader2, CheckCircle, Heart, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const MOCK_PRAYER_CONTENTS = [
  '請為我的家人禱告，願神保守他們平安健康。',
  '求神賜我智慧，讓我在工作中做出正確的決定。',
  '為我們教會的事工禱告，願更多人認識主。',
  '請為我的考試禱告，願神賜我平靜的心。',
  '為我的婚姻禱告，願神幫助我們更加相愛。',
  '求神醫治我的疾病，恢復我的健康。',
  '為我的兒女禱告，願他們在信仰上成長。',
  '請為我的財務狀況禱告，願神供應我的需要。',
  '為我們的國家禱告，願神賜下平安與公義。',
  '求神幫助我勝過試探，過聖潔的生活。',
  '為我失業的朋友禱告，願神為他開路。',
  '請為教會的年輕人禱告，願他們火熱愛主。',
  '為我的心理健康禱告，願神賜我平安。',
  '求神賜我勇氣，向身邊的人分享福音。',
  '為我們小組的合一禱告，願彼此相愛。',
];

const MOCK_NAMES = [
  '小明', '美玲', '志豪', '雅婷', '家豪',
  '怡君', '建宏', '淑芬', '俊傑', '雅雯',
  '宗翰', '欣怡', '偉倫', '佳穎', '冠廷',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const MockPrayerGenerator: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [prayerCount, setPrayerCount] = useState([10]);
  const [amenRange, setAmenRange] = useState([0, 20]);
  const [generatedStats, setGeneratedStats] = useState<{ prayers: number; amens: number } | null>(null);

  const generateMockData = async () => {
    if (!user) {
      toast.error('請先登入');
      return;
    }

    setIsGenerating(true);
    setGeneratedStats(null);

    try {
      const count = prayerCount[0];
      const maxAmens = amenRange[1];

      // Generate prayers via Express API
      const insertedPrayers: { id: string }[] = [];
      for (let i = 0; i < count; i++) {
        const prayerData = {
          userId: user.id,
          content: getRandomItem(MOCK_PRAYER_CONTENTS),
          isAnonymous: Math.random() > 0.5,
          category: 'other',
        };
        const res = await fetch('/api/prayers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(prayerData),
        });
        if (res.ok) {
          const prayer = await res.json();
          insertedPrayers.push(prayer);
        }
      }

      // Generate amens for each prayer
      let totalAmens = 0;
      for (const prayer of insertedPrayers) {
        const shouldAddAmen = getRandomInt(0, 100) < maxAmens;
        if (shouldAddAmen) {
          const res = await fetch(`/api/prayers/${prayer.id}/amen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId: user.id }),
          });
          if (res.ok) {
            totalAmens++;
          }
        }
      }

      setGeneratedStats({ prayers: insertedPrayers.length, amens: totalAmens });
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      toast.success(`成功生成 ${insertedPrayers.length} 個禱告事項！`);
    } catch (error) {
      console.error('Error generating mock data:', error);
      toast.error('生成失敗');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearAllPrayers = async () => {
    if (!user) return;

    try {
      // Delete prayers by fetching first, then deleting each one
      const res = await fetch('/api/prayers', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch prayers');
      const prayers = await res.json();
      
      const userPrayers = prayers.filter((p: any) => p.userId === user.id);
      for (const prayer of userPrayers) {
        await fetch(`/api/prayers/${prayer.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      toast.success('已清除所有禱告');
      setGeneratedStats(null);
    } catch (error) {
      console.error('Error clearing prayers:', error);
      toast.error('清除失敗');
    }
  };

  return (
    <Card className="border-dashed border-2 border-muted-foreground/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="w-5 h-5 text-primary" />
          模擬資料產生器
          <Badge variant="secondary" className="text-xs">Admin</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          快速生成測試禱告事項，用於測試禱告牆功能。
        </p>

        {/* Prayer Count Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm">禱告數量</Label>
            <span className="text-sm font-medium">{prayerCount[0]} 個</span>
          </div>
          <Slider
            value={prayerCount}
            onValueChange={setPrayerCount}
            min={1}
            max={50}
            step={1}
            className="w-full"
          />
        </div>

        {/* Amen Range */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm">阿門機率</Label>
            <span className="text-sm font-medium">
              {Math.round((amenRange[1] / 100) * 100)}%
            </span>
          </div>
          <Slider
            value={[amenRange[1]]}
            onValueChange={(v) => setAmenRange([0, v[0]])}
            min={0}
            max={100}
            step={10}
            className="w-full"
          />
        </div>

        {/* Info Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            50% 匿名
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Heart className="w-3 h-3 mr-1" />
            隨機阿門
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={generateMockData}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                生成禱告
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={clearAllPrayers}
            disabled={isGenerating}
          >
            清除我的禱告
          </Button>
        </div>

        {/* Generated Stats */}
        {generatedStats && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            已生成 {generatedStats.prayers} 個禱告，{generatedStats.amens} 個阿門
          </div>
        )}
      </CardContent>
    </Card>
  );
};
