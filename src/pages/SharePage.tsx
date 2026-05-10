import React from 'react';
import { Heart, ImageIcon, Sparkles } from 'lucide-react';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { FeaturePortalPage, FeaturePortalAction } from '@/components/product/FeaturePortalPage';

const shareFeatures: Array<FeaturePortalAction & { featureKey: string }> = [
  {
    id: 'prayer',
    featureKey: 'prayer_wall',
    title: '寫代禱',
    subtitle: '分享代禱事項',
    icon: Heart,
    href: '/prayer-wall',
    tone: 'bg-rose-500/15',
    iconTone: 'text-rose-600',
    badge: '彼此代禱',
    testId: 'link-feature-prayer',
  },
  {
    id: 'prayer-meeting',
    featureKey: 'prayer_meeting',
    title: '進入禱告會',
    subtitle: '分組禱告，彼此扶持',
    icon: Sparkles,
    href: '/prayer-meeting',
    tone: 'bg-purple-500/15',
    iconTone: 'text-purple-600',
    badge: '同步聚集',
    testId: 'link-feature-prayer-meeting',
  },
  {
    id: 'card',
    featureKey: 'message_cards',
    title: '下載信息圖卡',
    subtitle: '本週信息摘要圖片',
    icon: ImageIcon,
    href: '/card',
    tone: 'bg-violet-500/15',
    iconTone: 'text-violet-600',
    badge: '分享素材',
    testId: 'link-feature-card',
  },
];

const SharePage: React.FC = () => {
  const { isFeatureEnabled } = useFeatureToggles();
  const enabledFeatures = shareFeatures.filter((feature) => isFeatureEnabled(feature.featureKey));

  return (
    <FeatureGate
      featureKey="we_share"
      title="分享功能維護中"
      description="來禱告功能目前暫時關閉，請稍後再試"
    >
      <FeaturePortalPage
        title="來禱告"
        subtitle="分享代禱"
        eyebrow="Prayer and care"
        description="讓代禱、禱告會和信息圖卡都集中在一個地方，聚會前後都能延續彼此關心。"
        icon={Heart}
        iconTone="bg-rose-500/15 text-rose-600"
        actions={enabledFeatures}
        moments={[
          { label: '個人', value: '寫下今天的代禱' },
          { label: '群體', value: '一起進入禱告會' },
          { label: '分享', value: '保存信息圖卡與內容' },
        ]}
      />
    </FeatureGate>
  );
};

export default SharePage;
