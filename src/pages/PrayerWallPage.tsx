import React from 'react';
import { Header } from '@/components/layout/Header';
import { PrayerWall } from '@/components/prayer/PrayerWall';

export const PrayerWallPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <PrayerWall />
      </main>
    </div>
  );
};

export default PrayerWallPage;
