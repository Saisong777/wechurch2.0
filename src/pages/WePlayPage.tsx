import { BookOpen, Gamepad2, ScrollText, Shuffle } from 'lucide-react';
import { FeaturePortalPage, FeaturePortalAction } from '@/components/product/FeaturePortalPage';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';

const actions: Array<FeaturePortalAction & { featureKeys: string[] }> = [
  {
    id: 'icebreaker',
    title: '抽破冰題',
    subtitle: '真心話不用冒險',
    icon: Gamepad2,
    href: '/icebreaker',
    tone: 'bg-emerald-500/15',
    iconTone: 'text-emerald-600',
    badge: '暖場',
    testId: 'link-feature-icebreaker',
    featureKeys: ['we_play', 'icebreaker_game'],
  },
  {
    id: 'grouper',
    title: '立即分組',
    subtitle: '人到齊就可以快速分組',
    icon: Shuffle,
    href: '/grouper',
    tone: 'bg-amber-500/15',
    iconTone: 'text-amber-600',
    badge: '現場',
    testId: 'link-feature-grouper',
    featureKeys: ['we_play', 'random_grouper'],
  },
  {
    id: 'bible-quiz',
    title: '玩聖經問答',
    subtitle: '208 題 Quiz',
    icon: BookOpen,
    href: '/play/bible-quiz',
    tone: 'bg-yellow-500/15',
    iconTone: 'text-yellow-600',
    badge: '挑戰',
    testId: 'link-feature-bible-quiz',
    featureKeys: ['we_play', 'bible_quiz'],
  },
  {
    id: 'disciple-quiz',
    title: '測門徒人格',
    subtitle: '你像哪個門徒？',
    icon: ScrollText,
    href: '/play/disciple-quiz',
    tone: 'bg-orange-500/15',
    iconTone: 'text-orange-600',
    badge: '分享',
    testId: 'link-feature-disciple-quiz',
    featureKeys: ['we_play', 'disciple_quiz'],
  },
];

export const WePlayPage = () => {
  const { isFeatureEnabled } = useFeatureToggles();
  const enabledActions = actions.filter((action) => action.featureKeys.every(isFeatureEnabled));

  return (
    <FeatureGate
      featureKey="we_play"
      title="小工具維護中"
      description="現場互動工具目前暫時關閉，請稍後再試"
    >
      <FeaturePortalPage
        title="小工具"
        subtitle="現場互動"
        eyebrow="Tools for groups"
        description="把聚會現場常用的小工具放在同一個入口，分組、破冰、問答和分享都能更快開始。"
        icon={Gamepad2}
        iconTone="bg-emerald-500/15 text-emerald-600"
        actions={enabledActions}
        moments={[
          { label: '暖場', value: '抽題、問答、門徒人格' },
          { label: '分組', value: '快速產生小組名單' },
          { label: '延伸', value: '可接到 SoulGym 查經流程' },
        ]}
      />
    </FeatureGate>
  );
};

export default WePlayPage;
