import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface MockParticipantGeneratorProps {
  sessionId: string;
}

// Mock data generators
const FIRST_NAMES_MALE = ['志明', '建宏', '家豪', '俊傑', '文華', '國榮', '偉強', '永康', '明德', '子軒'];
const FIRST_NAMES_FEMALE = ['淑芬', '美玲', '雅婷', '怡君', '佳蓉', '欣怡', '惠如', '靜怡', '佩君', '詩涵'];
const LAST_NAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪'];
const LOCATIONS = ['On-site', 'Online - 台北', 'Online - 新竹', 'Online - 台中', 'Online - 高雄', 'Online - 海外'];

function generateMockParticipant(index: number) {
  const gender = Math.random() > 0.5 ? 'male' : 'female';
  const firstNames = gender === 'male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const name = `${lastName}${firstName}`;
  
  // 70% on-site, 30% remote
  const location = Math.random() > 0.3 
    ? 'On-site' 
    : LOCATIONS[Math.floor(Math.random() * (LOCATIONS.length - 1)) + 1];
  
  // Generate unique email
  const timestamp = Date.now();
  const email = `mock_${index}_${timestamp}@test.local`;
  
  return { name, email, gender, location };
}

/**
 * Utility function to generate mock participants for stress testing
 */
export async function generateMockParticipants(
  count: number, 
  sessionId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const BATCH_SIZE = 20; // Insert in batches for better performance
  let success = 0;
  let failed = 0;

  const participants = Array.from({ length: count }, (_, i) => ({
    ...generateMockParticipant(i),
    session_id: sessionId,
    ready_confirmed: Math.random() > 0.3, // 70% ready
  }));

  // Insert in batches
  for (let i = 0; i < participants.length; i += BATCH_SIZE) {
    const batch = participants.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from('participants')
      .insert(batch);

    if (error) {
      console.error(`[MockParticipantGenerator] Batch ${i / BATCH_SIZE} error:`, error);
      failed += batch.length;
    } else {
      success += batch.length;
    }

    onProgress?.(Math.min(i + BATCH_SIZE, count), count);
    
    // Small delay between batches to prevent overload
    if (i + BATCH_SIZE < participants.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { success, failed };
}

export const MockParticipantGenerator: React.FC<MockParticipantGeneratorProps> = ({ sessionId }) => {
  const [count, setCount] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setResult(null);

    try {
      const res = await generateMockParticipants(
        count,
        sessionId,
        (current, total) => setProgress(Math.round((current / total) * 100))
      );
      
      setResult(res);
      
      if (res.failed === 0) {
        toast.success(`成功生成 ${res.success} 位模擬參與者！`);
      } else {
        toast.warning(`生成 ${res.success} 位，${res.failed} 位失敗`);
      }
    } catch (error) {
      console.error('[MockParticipantGenerator] Error:', error);
      toast.error('生成失敗');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-5 h-5" />
          模擬參與者生成器
          <Badge variant="outline" className="ml-2">壓力測試</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          批量生成模擬參與者，用於測試高並發（60+ 人）場景下的系統穩定性。
        </p>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-blue-500 text-blue-600">
            50/50 性別分布
          </Badge>
          <Badge variant="outline" className="border-green-500 text-green-600">
            70% 現場 / 30% 線上
          </Badge>
          <Badge variant="outline" className="border-purple-500 text-purple-600">
            70% 已確認
          </Badge>
        </div>

        <div className="space-y-2">
          <Label htmlFor="count">生成人數</Label>
          <div className="flex gap-2">
            <Input
              id="count"
              type="number"
              min={10}
              max={200}
              value={count}
              onChange={(e) => setCount(Math.min(200, Math.max(10, parseInt(e.target.value) || 10)))}
              className="w-24"
              disabled={isGenerating}
            />
            <div className="flex gap-1">
              {[50, 100, 150, 200].map(n => (
                <Button
                  key={n}
                  variant="outline"
                  size="sm"
                  onClick={() => setCount(n)}
                  disabled={isGenerating}
                  className={count === n ? 'border-primary' : ''}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              生成中... {progress}%
            </p>
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 text-sm">
            {result.failed === 0 ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">成功生成 {result.success} 位</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-600 dark:text-amber-400">
                  成功 {result.success} / 失敗 {result.failed}
                </span>
              </>
            )}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Users className="w-4 h-4 mr-2" />
              生成 {count} 位模擬參與者
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          ⚠️ 生成的參與者使用 @test.local 郵箱，可在測試後批量刪除
        </p>
      </CardContent>
    </Card>
  );
};
