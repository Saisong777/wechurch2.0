import React from 'react';
import { Header } from '@/components/layout/Header';
import { PrayerWall } from '@/components/prayer/PrayerWall';
import { FeatureGate } from '@/components/ui/feature-gate';
import { PublicWallTabs } from '@/components/prayer/PublicWallTabs';

export const PrayerWallPage: React.FC = () => {
  return (
    <FeatureGate
      featureKeys={["we_share", "prayer_wall"]}
      title="禱告牆維護中"
      description="禱告牆功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header title="分享牆" backTo="/" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
          <PublicWallTabs />
          <PrayerWall />
        </main>
      </div>
    </FeatureGate>
  );
};

export default PrayerWallPage;
