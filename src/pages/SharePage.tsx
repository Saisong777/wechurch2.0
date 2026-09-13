import React from 'react';
import { Heart, PanelsTopLeft } from 'lucide-react';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { FeaturePortalPage, FeaturePortalAction } from '@/components/product/FeaturePortalPage';

const shareFeatures: Array<FeaturePortalAction & { featureKey: string }> = [
  {
    id: 'grace-record',
    featureKey: 'prayer_wall',
    title: '我的禱告與恩典',
    subtitle: '個人保存神回應的痕跡，不放到公開禱告牆',
    icon: Heart,
    href: '/grace-record',
    tone: 'bg-emerald-500/15',
    iconTone: 'text-emerald-600',
    badge: '個人紀錄',
    testId: 'link-feature-grace-record',
  },
];

const SharePage: React.FC = () => {
  const { isFeatureEnabled } = useFeatureToggles();
  const enabledFeatures = shareFeatures.filter((feature) => isFeatureEnabled(feature.featureKey));
  if (isFeatureEnabled('we_learn') || isFeatureEnabled('prayer_wall')) {
    enabledFeatures.push({
      id: 'walls', featureKey: 'we_share', title: '分享牆', subtitle: '',
      icon: PanelsTopLeft, href: '/walls', tone: 'bg-teal-500/10',
      iconTone: 'text-teal-700', testId: 'link-feature-walls',
    });
  }

  return (
    <FeatureGate
      featureKey="we_share"
      title="分享功能維護中"
      description="來禱告功能目前暫時關閉，請稍後再試"
    >
      <FeaturePortalPage
        title="來禱告"
        subtitle="彼此守望"
        actions={enabledFeatures}
      />
    </FeatureGate>
  );
};

export default SharePage;
