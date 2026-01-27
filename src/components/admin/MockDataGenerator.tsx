import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { INSIGHT_CATEGORIES, InsightCategory } from '@/types/spiritual-fitness';
import { Wand2, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MockDataGeneratorProps {
  sessionId: string;
}

const MOCK_TITLE_PHRASES = [
  '逆轉勝的故事',
  '愛的冒險旅程',
  '勇氣的代價',
  '信心的飛躍',
  '恩典無限供應',
  '從灰燼中重生',
];

const MOCK_HEARTBEAT_VERSES = [
  '第五節讓我心跳加速！',
  '這句話深深觸動我的心',
  '感覺神在直接對我說話',
  '這是我今年最需要的提醒',
];

const MOCK_OBSERVATIONS = [
  '看到了一個勇敢的人面對困難',
  '發現神的信實貫穿整個故事',
  '注意到人物的轉變過程很戲劇化',
  '看到群眾的反應和耶穌形成對比',
];

const MOCK_CORE_NOTES = [
  'Feeling the burn on this verse! 💪',
  '這個發現讓我重新思考信仰',
  '原來神的心意是這樣的',
  '跟我以前理解的完全不同',
];

const MOCK_SCHOLARS_NOTES = [
  '根據 Google 搜尋，這段經文的歷史背景是...',
  'ChatGPT 說這段經文有三個重點...',
  '注釋書提到當時的文化背景...',
  '學者們對這段經文有不同的解讀...',
];

const MOCK_ACTION_PLANS = [
  '這週每天早起10分鐘禱告',
  '找一個朋友分享這段經文',
  '寫一封感謝信給神',
  '實踐一次服務他人的行動',
];

const MOCK_COOL_DOWN_NOTES = [
  '今天的查經讓我很感動，想為家人禱告',
  '下週想繼續深入研究這個主題',
  '感謝小組成員的分享！',
  '發現自己需要更多安靜的時間',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomCategory(): InsightCategory {
  return INSIGHT_CATEGORIES[Math.floor(Math.random() * INSIGHT_CATEGORIES.length)].value;
}

export const MockDataGenerator: React.FC<MockDataGeneratorProps> = ({ sessionId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  const generateMockResponses = async () => {
    setIsGenerating(true);
    setGeneratedCount(0);

    try {
      // Get participants for this session
      const { data: participants, error: pError } = await supabase
        .from('participants')
        .select('id, name')
        .eq('session_id', sessionId);

      if (pError) throw pError;

      if (!participants || participants.length === 0) {
        toast.error('沒有找到參與者 No participants found');
        return;
      }

      // Build all mock responses in memory first (fast)
      const mockResponses: Array<{
        session_id: string;
        user_id: string;
        title_phrase?: string;
        heartbeat_verse?: string;
        observation?: string;
        core_insight_category?: 'PROMISE' | 'COMMAND' | 'WARNING' | 'GOD_ATTRIBUTE';
        core_insight_note?: string;
        scholars_note?: string;
        action_plan?: string;
        cool_down_note?: string;
      }> = [];

      for (const participant of participants) {
        const progressLevel = Math.random();
        
        const mockResponse: typeof mockResponses[number] = {
          session_id: sessionId,
          user_id: participant.id,
        };

        // Phase 1 (Green) - 70% chance
        if (progressLevel > 0.3) {
          mockResponse.title_phrase = getRandomItem(MOCK_TITLE_PHRASES);
          mockResponse.heartbeat_verse = getRandomItem(MOCK_HEARTBEAT_VERSES);
          mockResponse.observation = getRandomItem(MOCK_OBSERVATIONS);
        }

        // Phase 2 (Yellow) - 50% chance
        if (progressLevel > 0.5) {
          mockResponse.core_insight_category = getRandomCategory();
          mockResponse.core_insight_note = getRandomItem(MOCK_CORE_NOTES);
          mockResponse.scholars_note = getRandomItem(MOCK_SCHOLARS_NOTES);
        }

        // Phase 3 (Blue) - 30% chance
        if (progressLevel > 0.7) {
          mockResponse.action_plan = getRandomItem(MOCK_ACTION_PLANS);
          mockResponse.cool_down_note = getRandomItem(MOCK_COOL_DOWN_NOTES);
        }

        // Only include if there's at least some content
        if (Object.keys(mockResponse).length > 2) {
          mockResponses.push(mockResponse);
        }
      }

      if (mockResponses.length === 0) {
        toast.info('沒有生成任何資料');
        return;
      }

      // Batch upsert all at once - much faster and atomic
      const { error } = await supabase
        .from('study_responses')
        .upsert(mockResponses, { onConflict: 'session_id,user_id' });

      if (error) throw error;

      setGeneratedCount(mockResponses.length);
      toast.success(`成功生成 ${mockResponses.length} 筆模擬資料！`);
    } catch (error) {
      console.error('Error generating mock data:', error);
      toast.error('生成失敗 Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="w-5 h-5" />
          模擬資料產生器 Mock Data Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          為所有參與者隨機生成健身筆記，用於測試進度監控功能。
        </p>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
            Phase 1: 70%
          </Badge>
          <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
            Phase 2: 50%
          </Badge>
          <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
            Phase 3: 30%
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={generateMockResponses}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中... ({generatedCount})
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                生成模擬資料
              </>
            )}
          </Button>
          {generatedCount > 0 && !isGenerating && (
            <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              已生成 {generatedCount} 筆
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
