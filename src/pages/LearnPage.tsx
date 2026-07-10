import { Book, Calendar, BookOpen, BookMarked } from 'lucide-react';
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
    id: 'reading-plans',
    featureKey: 'reading_plans',
    title: '接續讀經',
    subtitle: '每天打開就能接著讀',
    icon: BookOpen,
    href: '/learn/reading-plans',
    tone: 'bg-emerald-500/15',
    iconTone: 'text-emerald-600',
    badge: '每日',
    testId: 'link-feature-reading-plans',
  },
  {
    id: 'jesus-timeline',
    featureKey: 'jesus_timeline',
    title: '看耶穌四季',
    subtitle: '用時間軸看耶穌生平事件',
    icon: Calendar,
    href: '/learn/jesus-timeline',
    tone: 'bg-amber-500/15',
    iconTone: 'text-amber-600',
    badge: '認識耶穌',
    testId: 'link-feature-jesus-timeline',
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
        eyebrow="Word and notes"
        description="把讀經、靈修、筆記和耶穌生平放在同一個入口，讓個人靈修與小組查經可以接在一起。"
        icon={BookOpen}
        iconTone="bg-sky-500/15 text-sky-600"
        actions={enabledFeatures}
        moments={[
          { label: '今天', value: '接續讀經與經文收藏' },
          { label: '查找', value: '快速打開聖經與耶穌時間軸' },
          { label: '沉澱', value: '筆記、心得、查經紀錄' },
        ]}
      />
    </FeatureGate>
  );
};

export default LearnPage;
