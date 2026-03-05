import { Header } from '@/components/layout/Header';
import { IcebreakerGame } from '@/components/icebreaker/IcebreakerGame';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeatureGate } from '@/components/ui/feature-gate';

export const IcebreakerPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <FeatureGate
      featureKey="we_play"
      title="功能維護中"
      description="真心話不用冒險 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header variant="compact" backTo="/play" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 pb-8 pt-4">
          <FeatureGate featureKeys={["we_play", "icebreaker_game"]} title="真心話不用冒險維護中" description="真心話不用冒險功能目前暫時關閉，請稍後再試">
            <IcebreakerGame />
          </FeatureGate>
        </main>
      </div>
    </FeatureGate>
  );
};
