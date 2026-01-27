import React from 'react';
import { Header } from '@/components/layout/Header';
import { IcebreakerGame } from '@/components/icebreaker/IcebreakerGame';

export const IcebreakerPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header variant="compact" />
      <main className="container mx-auto pb-8">
        <IcebreakerGame />
      </main>
    </div>
  );
};
