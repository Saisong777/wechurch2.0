import { Header } from '@/components/layout/Header';
import { RandomGrouper } from '@/components/icebreaker/RandomGrouper';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeatureGate } from '@/components/ui/feature-gate';

export const GrouperPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <FeatureGate
      featureKey="we_play"
      title="功能維護中"
      description="只能說是神的安排 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header variant="compact" backTo="/play" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 pb-8 pt-4">
          <FeatureGate featureKeys={["we_play", "random_grouper"]} title="只能說是神的安排維護中" description="只能說是神的安排功能目前暫時關閉，請稍後再試">
            <RandomGrouper />
          </FeatureGate>
        </main>
      </div>
    </FeatureGate>
  );
};
