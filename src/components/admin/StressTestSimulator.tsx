import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FlaskConical, Trash2, Users, Loader2 } from 'lucide-react';
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

  const handleGenerate = async () => {
    if (!currentSession?.id) {
      toast.error('請先建立一個查經聚會！');
      return;
    }

    setIsGenerating(true);

    try {
      const mockParticipants: Array<{
        session_id: string;
        name: string;
        email: string;
        gender: string;
        location: string;
      }> = [];

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

        mockParticipants.push({
          session_id: currentSession.id,
          name,
          email,
          gender,
          location,
        });
      }

      // Batch insert in chunks of 50 to avoid timeout
      const chunkSize = 50;
      for (let i = 0; i < mockParticipants.length; i += chunkSize) {
        const chunk = mockParticipants.slice(i, i + chunkSize);
        const { error } = await supabase.from('participants').insert(chunk);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      // Refresh participants list
      const { data: updatedParticipants } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', currentSession.id)
        .order('joined_at', { ascending: true });

      if (updatedParticipants) {
        setUsers(
          updatedParticipants.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            gender: p.gender as 'male' | 'female',
            groupNumber: p.group_number || undefined,
            joinedAt: new Date(p.joined_at),
            location: p.location,
            readyConfirmed: p.ready_confirmed,
          }))
        );
      }

      toast.success(`已新增 ${userCount} 位模擬使用者進行壓力測試！`);
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
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('session_id', currentSession.id);

      if (error) throw error;

      setUsers([]);
      toast.success('已清除所有參與者！');
      onParticipantsCleared?.();
    } catch (error: any) {
      console.error('Error clearing participants:', error);
      toast.error(`清除失敗: ${error.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Card className="border-dashed border-2 border-muted-foreground/30 bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="w-5 h-5 text-secondary" />
          壓力測試模擬器 Stress Test Simulator
        </CardTitle>
        <CardDescription>
          產生模擬使用者以測試分組演算法效能
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
                  這將會刪除本次聚會的所有 {users.length} 位參與者。此操作無法復原。
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

        {users.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            目前共 {users.length} 位參與者
          </p>
        )}
      </CardContent>
    </Card>
  );
};
