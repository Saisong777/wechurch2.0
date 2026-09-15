import { Book, BookOpen, BookMarked } from 'lucide-react';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { FeaturePortalPage, FeaturePortalAction } from '@/components/product/FeaturePortalPage';

const features: Array<FeaturePortalAction & { featureKey: string }> = [
  {
    id: 'bible',
    featureKey: 'bible_reading',
    title: '打開聖經',
    subtitle: '搜尋經文、收藏經節、建立筆記',
    icon: Book,
    href: '/learn/bible',
    tone: 'bg-sky-500/15',
    iconTone: 'text-sky-600',
    badge: '讀經',
    testId: 'link-feature-bible',
  },
  {
    id: 'church-reading',
    featureKey: 'we_learn',
    title: '每日靈修',
    subtitle: '今日經文、愛神愛人、行動提醒',
    icon: BookOpen,
    href: '/learn/church-reading',
    tone: 'bg-primary/15',
    iconTone: 'text-primary',
    badge: '今天',
    testId: 'link-feature-church-reading',
  },
  {
    id: 'my-notes',
    featureKey: 'we_learn',
    title: '查看筆記',
    subtitle: '讀經筆記與查經紀錄',
    icon: BookMarked,
    href: '/learn/my-notes',
    tone: 'bg-rose-500/15',
    iconTone: 'text-rose-500',
    badge: '整理',
    testId: 'link-feature-my-notes',
  },
];

const LearnPage = () => {
  const { isFeatureEnabled } = useFeatureToggles();
  const enabledFeatures = features.filter((feature) => isFeatureEnabled(feature.featureKey));

  return (
    <FeatureGate
      featureKey="we_learn"
      title="學習功能維護中"
      description="讀聖經功能目前暫時關閉，請稍後再試"
    >
      <FeaturePortalPage
        title="讀聖經"
        subtitle="學習成長"
        actions={enabledFeatures}
      />
    </FeatureGate>
  );
};

export default LearnPage;
