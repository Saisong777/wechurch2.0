import React from 'react';
import { Header } from '@/components/layout/Header';
import { PrayerWall } from '@/components/prayer/PrayerWall';
import { FeatureGate } from '@/components/ui/feature-gate';

export const PrayerWallPage: React.FC = () => {
  return (
    <FeatureGate 
      featureKeys={["we_share", "prayer_wall"]}
      title="禱告牆維護中"
      description="禱告牆功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <PrayerWall />
        </main>
      </div>
    </FeatureGate>
  );
};

export default PrayerWallPage;
