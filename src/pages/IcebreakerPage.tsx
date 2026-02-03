import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { IcebreakerGame } from '@/components/icebreaker/IcebreakerGame';
import { RandomGrouper } from '@/components/icebreaker/RandomGrouper';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dumbbell, Shuffle } from 'lucide-react';

export const IcebreakerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('icebreaker');

  return (
    <FeatureGate 
      featureKeys={["we_play", "icebreaker_game"]}
      title="破冰遊戲維護中"
      description="We Play 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header variant="compact" />
        <main className="container mx-auto pb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center px-4 pt-4">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="icebreaker" className="flex items-center gap-2" data-testid="tab-icebreaker">
                  <Dumbbell className="w-4 h-4" />
                  破冰遊戲
                </TabsTrigger>
                <TabsTrigger value="grouper" className="flex items-center gap-2" data-testid="tab-grouper">
                  <Shuffle className="w-4 h-4" />
                  神的安排
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="icebreaker" className="mt-0">
              <IcebreakerGame />
            </TabsContent>
            <TabsContent value="grouper" className="mt-0">
              <RandomGrouper />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </FeatureGate>
  );
};
