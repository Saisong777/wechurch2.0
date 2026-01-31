import React from 'react';
import { Header } from '@/components/layout/Header';
import { IcebreakerGame } from '@/components/icebreaker/IcebreakerGame';
import { FeatureGate } from '@/components/ui/feature-gate';

export const IcebreakerPage: React.FC = () => {
  return (
    <FeatureGate 
      featureKeys={["we_play", "icebreaker_game"]}
      title="破冰遊戲維護中"
      description="We Play 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header variant="compact" />
        <main className="container mx-auto pb-8">
          <IcebreakerGame />
        </main>
      </div>
    </FeatureGate>
  );
};
