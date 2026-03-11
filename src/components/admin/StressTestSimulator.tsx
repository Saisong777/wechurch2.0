import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/contexts/SessionContext';
import { toast } from 'sonner';
import { FlaskConical, Trash2, Users, Loader2, Wand2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Name pools for generating realistic mock data
const FIRST_NAMES_MALE = [
  '俊傑', '家豪', '志明', '建華', '文傑', '偉強', '國強', '志偉', 
  '明輝', '俊宏', '子軒', '宇軒', '承恩', '彥廷', '柏翰', '冠宇'
];

const FIRST_NAMES_FEMALE = [
  '淑芬', '美玲', '雅婷', '怡君', '佳穎', '詩涵', '雨晴', '思穎',
  '欣怡', '雅琪', '婷婷', '小萱', '宜蓁', '雅雯', '佳慧', '芷晴'
];

const LAST_NAMES = [
  '陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊',
  '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'
];

const REMOTE_LOCATIONS = ['Taoyuan Church', 'Taichung Group', 'Online Taipei'];

// Mock study content for AI report testing
const MOCK_THEMES = [
  '神的信實與恩典',
  '信心的力量',
  '愛與饒恕的功課',
  '順服帶來祝福',
  '在患難中仍有盼望',
  '神的主權與計畫',
  '謙卑服事的榜樣',
  '生命的更新與改變',
];

const MOCK_MOVING_VERSES = [
  '第5節讓我感動，因為看到神的大能',
  '第8節提醒我神永不離棄我們',
  '第12節是我今年最需要的經文',
  '第3節讓我重新思考信仰的意義',
  '第15節給我極大的安慰',
  '第7節挑戰了我對順服的理解',
];

const MOCK_FACTS = [
  '觀察到主角面對困難時仍選擇相信神',
  '發現經文中有三個重複的關鍵詞',
  '注意到時間順序的安排很有意義',
  '看到人物之間的對話反映當時的文化背景',
  '經文結構呈現「問題-轉折-解決」的模式',
  '發現這段經文與前一章有呼應的關係',
];

const MOCK_EXEGESIS = [
  '根據希臘文原意，這個詞有「完全信靠」的含義',
  '當時的歷史背景是羅馬統治時期，這影響了經文的理解',
  '注釋書指出這段經文常被用於教導禱告的重要性',
  '學者認為這是一個交叉結構的典型範例',
  '希伯來文化中，這個動作代表立約的承諾',
  '這段經文在猶太傳統中有特殊的地位',
];

const MOCK_INSPIRATIONS = [
  '神在提醒我：祂的時間表與我的不同，但祂的計畫永遠是最好的',
  '感受到神在對我說：「不要害怕，我與你同在」',
  '這段經文光照了我最近面對的掙扎，讓我看見神的帶領',
  '聖靈感動我要更多饒恕那些傷害過我的人',
  '我感覺神在邀請我進入更深的禱告生活',
  '這是神對我長久禱告的回應，祂沒有忘記我！',
];

const MOCK_APPLICATIONS = [
  '這週要每天花15分鐘安靜等候神',
  '決定打電話給那位需要和好的朋友',
  '開始建立每日讀經的習慣',
  '要更主動關心身邊正在受苦的弟兄姊妹',
  '在工作上實踐誠實和正直的原則',
  '為教會的復興禱告30天',
];

const MOCK_OTHERS = [
  '感謝小組成員的分享，讓我收穫很多！',
  '下週想繼續研究相關的經文',
  '這次查經讓我對這卷書有全新的認識',
  '想要推薦這段經文給正在經歷困難的朋友',
  '',
  '',
];

// Generate a random email
const generateEmail = (name: string, index: number): string => {
  const domains = ['gmail.com', 'yahoo.com.tw', 'hotmail.com', 'outlook.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const sanitizedName = name.replace(/[^\w]/g, '').toLowerCase();
  return `${sanitizedName}${index}@${domain}`;
};

// Generate a random name
const generateName = (gender: 'male' | 'female'): string => {
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const firstNames = gender === 'male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  return `${lastName}${firstName}`;
};

const getRandomItem = <T,>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

interface StressTestSimulatorProps {
  onParticipantsGenerated?: () => void;
  onParticipantsCleared?: () => void;
}

export const StressTestSimulator: React.FC<StressTestSimulatorProps> = ({
  onParticipantsGenerated,
  onParticipantsCleared,
}) => {
  const { currentSession, users, setUsers } = useSession();
  const [userCount, setUserCount] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isGeneratingSubmissions, setIsGeneratingSubmissions] = useState(false);
  const [autoGenerateSubmissions, setAutoGenerateSubmissions] = useState(true);

  const INSIGHT_CATEGORIES = ['PROMISE', 'COMMAND', 'WARNING', 'GOD_ATTRIBUTE'] as const;

  const generateMockStudyResponses = async (participants: Array<{ id: string; name: string; email: string; groupNumber: number | null }>) => {
    const grouped = participants.filter(p => p.groupNumber !== null);

    if (grouped.length === 0) {
      return 0;
    }

    // Insert study responses via Express API (study_responses table, used by AI report)
    let insertedCount = 0;
    for (const p of grouped) {
      try {
        const response = await fetch(`/api/study-responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: currentSession!.id,
            userId: p.id,
            titlePhrase: getRandomItem(MOCK_THEMES),
            heartbeatVerse: getRandomItem(MOCK_MOVING_VERSES),
            observation: getRandomItem(MOCK_FACTS),
            coreInsightCategory: getRandomItem([...INSIGHT_CATEGORIES]),
            coreInsightNote: getRandomItem(MOCK_INSPIRATIONS),
            scholarsNote: getRandomItem(MOCK_EXEGESIS),
            actionPlan: getRandomItem(MOCK_APPLICATIONS),
            coolDownNote: getRandomItem(MOCK_OTHERS) || '感謝神的帶領',
          }),
        });
        if (response.ok) {
          insertedCount++;
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          console.error('Study response failed:', errorData);
        }
      } catch (error) {
        console.error('Study response insert error:', error);
      }
    }

    return insertedCount;
  };

  const handleGenerateSubmissionsOnly = async () => {
    if (!currentSession?.id) {
      toast.error('請先建立一個查經聚會！');
      return;
    }

    setIsGeneratingSubmissions(true);

    try {
      // Get current participants with group assignments via Express API
      const response = await fetch(`/api/sessions/${currentSession.id}/participants`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch participants');
      const participantsData = await response.json();

      const participants = participantsData.map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email || '',
        groupNumber: p.groupNumber,
      }));

      if (!participants || participants.length === 0) {
        toast.error('沒有參與者可以生成查經資料');
        return;
      }

      const withGroups = participants.filter((p: any) => p.groupNumber !== null);
      if (withGroups.length === 0) {
        toast.error('請先進行分組，才能生成查經資料');
        return;
      }

      const count = await generateMockStudyResponses(
        participants as Array<{ id: string; name: string; email: string; groupNumber: number | null }>
      );

      toast.success(`已生成 ${count} 筆模擬查經資料！`);
    } catch (error: any) {
      console.error('Error generating submissions:', error);
      toast.error(`生成查經資料失敗: ${error.message}`);
    } finally {
      setIsGeneratingSubmissions(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentSession?.id) {
      toast.error('請先建立一個查經聚會！');
      return;
    }

    setIsGenerating(true);

    try {
      let insertedCount = 0;
      
      for (let i = 0; i < userCount; i++) {
        // 50/50 gender split
        const gender: 'male' | 'female' = i % 2 === 0 ? 'male' : 'female';
        const name = generateName(gender);
        const email = generateEmail(name, i);

        // 70% On-site, 30% Remote
        const isRemote = Math.random() < 0.3;
        const location = isRemote
          ? REMOTE_LOCATIONS[Math.floor(Math.random() * REMOTE_LOCATIONS.length)]
          : 'On-site';

        // Insert via Express API
        const response = await fetch(`/api/sessions/${currentSession.id}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, gender, location }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Participant creation failed:', errorData);
          throw new Error(errorData.error || 'Failed to create participant');
        }

        insertedCount++;
      }

      // Refresh participants list via API
      const response = await fetch(`/api/sessions/${currentSession.id}/participants`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const updatedParticipants = await response.json();
        setUsers(
          updatedParticipants.map((p: any) => ({
            id: p.id,
            name: p.name,
            email: p.email || '',
            gender: p.gender as 'male' | 'female',
            groupNumber: p.groupNumber || undefined,
            joinedAt: p.joinedAt ? new Date(p.joinedAt) : undefined,
            location: p.location || 'On-site',
            readyConfirmed: p.readyConfirmed || false,
          }))
        );
      }

      toast.success(`已新增 ${insertedCount} 位模擬使用者進行壓力測試！`);
      onParticipantsGenerated?.();
    } catch (error: any) {
      console.error('Error generating mock participants:', error);
      toast.error(`產生模擬資料失敗: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearAll = async () => {
    if (!currentSession?.id) {
      toast.error('沒有進行中的聚會！');
      return;
    }

    setIsClearing(true);

    try {
      // Clear submissions via Express API
      await fetch(`/api/sessions/${currentSession.id}/submissions`, {
        method: 'DELETE',
        credentials: 'include',
      });

      // Clear participants via Express API
      const response = await fetch(`/api/sessions/${currentSession.id}/participants`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to clear participants');

      setUsers([]);
      toast.success('已清除所有參與者和查經資料！');
      onParticipantsCleared?.();
    } catch (error: any) {
      console.error('Error clearing participants:', error);
      toast.error(`清除失敗: ${error.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  const hasGroupedParticipants = users.some(u => u.groupNumber !== undefined);

  return (
    <Card className="border-dashed border-2 border-muted-foreground/30 bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="w-5 h-5 text-secondary" />
          壓力測試模擬器 Stress Test Simulator
        </CardTitle>
        <CardDescription>
          產生模擬使用者和查經資料以測試 AI 報告功能
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="userCount">使用者數量 User Count</Label>
            <Input
              id="userCount"
              type="number"
              min={10}
              max={200}
              value={userCount}
              onChange={(e) => setUserCount(Math.min(200, Math.max(10, parseInt(e.target.value) || 50)))}
              className="max-w-[120px]"
            />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 50% 男 / 50% 女</p>
            <p>• 70% 現場 / 30% 遠端</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={isGenerating || !currentSession?.id}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                產生中...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                產生模擬參與者
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={isClearing || users.length === 0}
              >
                {isClearing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>確定要清除所有參與者？</AlertDialogTitle>
                <AlertDialogDescription>
                  這將會刪除本次聚會的所有 {users.length} 位參與者及其查經資料。此操作無法復原。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>
                  確定清除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Generate Submissions Button */}
        {hasGroupedParticipants && (
          <div className="pt-3 border-t border-border">
            <Button
              variant="gold"
              onClick={handleGenerateSubmissionsOnly}
              disabled={isGeneratingSubmissions}
              className="w-full gap-2"
            >
              {isGeneratingSubmissions ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成查經資料中...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  生成模擬查經資料 (供 AI 報告測試)
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              為已分組的參與者生成假查經筆記，用於測試 AI 分析報告
            </p>
          </div>
        )}

        {users.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            目前共 {users.length} 位參與者
            {hasGroupedParticipants && ' (已分組)'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
