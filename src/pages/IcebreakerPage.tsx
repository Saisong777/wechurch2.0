import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { IcebreakerGame } from '@/components/icebreaker/IcebreakerGame';
import { RandomGrouper } from '@/components/icebreaker/RandomGrouper';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dumbbell, Shuffle } from 'lucide-react';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';

export const IcebreakerPage: React.FC = () => {
  const { isFeatureEnabled } = useFeatureToggles();
  const icebreakerEnabled = isFeatureEnabled('icebreaker_game');
  const grouperEnabled = isFeatureEnabled('random_grouper');
  const [activeTab, setActiveTab] = useState(icebreakerEnabled ? 'icebreaker' : 'grouper');

  return (
    <FeatureGate 
      featureKey="we_play"
      title="遊戲功能維護中"
      description="We Play 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header variant="compact" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 pb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
              <TabsList className="grid w-full max-w-md md:max-w-lg grid-cols-2">
                <TabsTrigger value="icebreaker" className="flex items-center gap-2" data-testid="tab-icebreaker" disabled={!icebreakerEnabled}>
                  <Dumbbell className="w-4 h-4" />
                  破冰遊戲
                </TabsTrigger>
                <TabsTrigger value="grouper" className="flex items-center gap-2" data-testid="tab-grouper" disabled={!grouperEnabled}>
                  <Shuffle className="w-4 h-4" />
                  神的安排
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="icebreaker" className="mt-0">
              <FeatureGate featureKeys={["we_play", "icebreaker_game"]} title="破冰遊戲維護中" description="破冰遊戲功能目前暫時關閉，請稍後再試">
                <IcebreakerGame />
              </FeatureGate>
            </TabsContent>
            <TabsContent value="grouper" className="mt-0">
              <FeatureGate featureKeys={["we_play", "random_grouper"]} title="神的安排維護中" description="隨機分組功能目前暫時關閉，請稍後再試">
                <RandomGrouper />
              </FeatureGate>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </FeatureGate>
  );
};
