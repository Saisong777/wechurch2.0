import React from 'react';
import { Heart, ImageIcon, PartyPopper, Sparkles } from 'lucide-react';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { FeaturePortalPage, FeaturePortalAction } from '@/components/product/FeaturePortalPage';

const shareFeatures: Array<FeaturePortalAction & { featureKey: string }> = [
  {
    id: 'prayer',
    featureKey: 'prayer_wall',
    title: '分享代禱',
    subtitle: '寫下需要守望的事，也一起為別人說阿門',
    icon: Heart,
    href: '/prayer-wall',
    tone: 'bg-rose-500/10',
    iconTone: 'text-rose-600',
    badge: '禱告牆',
    testId: 'link-feature-prayer',
  },
  {
    id: 'prayer-meeting',
    featureKey: 'prayer_meeting',
    title: '禱告會與緊急代禱',
    subtitle: '聚會中整理緊急禱告、分組代禱，讓關心不散場',
    icon: Sparkles,
    href: '/prayer-meeting',
    tone: 'bg-sky-500/10',
    iconTone: 'text-sky-600',
    badge: '教會禱告',
    testId: 'link-feature-prayer-meeting',
  },
  {
    id: 'grace-record',
    featureKey: 'prayer_wall',
    title: '恩典紀錄簿',
    subtitle: '個人保存神回應的痕跡，不放到公開禱告牆',
    icon: PartyPopper,
    href: '/grace-record',
    tone: 'bg-emerald-500/15',
    iconTone: 'text-emerald-600',
    badge: '個人紀錄',
    testId: 'link-feature-grace-record',
  },
  {
    id: 'card',
    featureKey: 'message_cards',
    title: '下載信息圖卡',
    subtitle: '保存本週信息重點，方便轉傳與默想',
    icon: ImageIcon,
    href: '/card',
    tone: 'bg-amber-500/15',
    iconTone: 'text-amber-700',
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
        subtitle="彼此守望"
        eyebrow="Prayer and care"
        description="把需要被記念的事放在一起：可以匿名分享、回應阿門、留下鼓勵，也能在蒙應允時一起感謝。"
        icon={Heart}
        iconTone="bg-rose-500/15 text-rose-600"
        actions={enabledFeatures}
        moments={[
          { label: '個人', value: '寫下今天需要代禱的事' },
          { label: '教會', value: '為緊急與小組需要守望' },
          { label: '恩典', value: '私下記錄神如何回應' },
        ]}
      />
    </FeatureGate>
  );
};

export default SharePage;
