import { Navigate, useLocation } from 'react-router-dom';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';

const LearnPage = () => {
  const { search, hash } = useLocation();
  const { isFeatureEnabled } = useFeatureToggles();
  const destination = isFeatureEnabled('bible_reading') ? '/learn/bible' : '/learn/church-reading';

  return (
    <FeatureGate
      featureKey="we_learn"
      title="學習功能維護中"
      description="讀聖經功能目前暫時關閉，請稍後再試"
    >
      <Navigate to={`${destination}${search}${hash}`} replace />
    </FeatureGate>
  );
};

export default LearnPage;
