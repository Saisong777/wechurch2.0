import { useCastleContentPresentation } from '@/contexts/CastleContentPresentationContext';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePageScroll } from '@/contexts/PageScrollContext';
import { ArrowRight, BookOpen, Gamepad2, ScrollText, Shuffle } from 'lucide-react';
import { FeaturePortalPage, FeaturePortalAction } from '@/components/product/FeaturePortalPage';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import './pavilion.css';

const actions: Array<FeaturePortalAction & { featureKeys: string[]; inPavilion?: boolean }> = [
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
    inPavilion: true,
    title: '十二門徒人格',
    subtitle: '發現你的同行組合',
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
  const castleContent = useCastleContentPresentation();
  const scroll = usePageScroll();
  const { isFeatureEnabled, loading, error } = useFeatureToggles();
  const enabledActions = actions.filter((action) => action.featureKeys.every(isFeatureEnabled));
  const hubReady = castleContent && !loading && !error && isFeatureEnabled('we_play');
  const pavilionActivities = hubReady ? enabledActions.filter(action => action.inPavilion) : [];
  const bindHeading = useCallback((node: HTMLHeadingElement | null) => {
    if (!node || !hubReady) return;
    scroll.to(0);
    node.focus({ preventScroll: true });
  }, [hubReady, scroll]);

  return (
    <FeatureGate
      featureKey="we_play"
      title={castleContent ? '相聚小亭暫未開放' : '小工具維護中'}
      description="互動活動目前暫時關閉，請稍後再試"
    >
      {castleContent ? (
        <main className="pavilion-hub">
          <div className="pavilion-content">
            <div className="pavilion-sign" aria-hidden="true"><Gamepad2 size={30} /></div>
            <p className="pavilion-eyebrow">城堡裡的相聚時光</p>
            <h1 ref={bindHeading} tabIndex={-1}>相聚小亭</h1>
            <p className="pavilion-lead">挑個小活動，一起玩吧。</p>
            <nav className="pavilion-activities" aria-label="相聚小亭活動">
              {pavilionActivities.map(activity => (
                <Link key={activity.id} to={activity.href} className="pavilion-activity" aria-labelledby={`pavilion-${activity.id}`}>
                  <span className="pavilion-activity-emblem" aria-hidden="true"><activity.icon size={30} /></span>
                  <div>
                    <p className="pavilion-eyebrow">認識自己 · 認識彼此</p>
                    <h2 id={`pavilion-${activity.id}`}>{activity.title}</h2>
                    <p>24 個生活情境，發現你的同行組合。</p>
                    <span className="pavilion-start">開始探索 <ArrowRight size={18} aria-hidden="true" /></span>
                  </div>
                </Link>
              ))}
            </nav>
            {!pavilionActivities.length && <p className="pavilion-empty" role="status">{loading ? '正在載入小亭活動…' : error ? '暫時無法載入活動，請稍後再試。' : !isFeatureEnabled('we_play') ? '相聚小亭暫未開放，請稍後再來。' : '小亭的活動準備中，晚點再來看看。'}</p>}
            <p className="pavilion-future">這裡還會陸續加入新的小遊戲與互動，讓每次相聚多一點驚喜。</p>
          </div>
        </main>
      ) : <FeaturePortalPage
        title="小工具"
        subtitle="現場互動"
        actions={enabledActions}
      />}
    </FeatureGate>
  );
};

export default WePlayPage;
