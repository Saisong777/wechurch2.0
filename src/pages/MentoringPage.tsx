import { Link,useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Button } from '@/components/ui/button';
import { MentoringPanel } from '@/components/support/MentoringPanel';
export default function MentoringPage(){
  const mentor=useLocation().pathname.startsWith('/work');
  return <FeatureGate featureKey="pastoral_beta" title="門訓陪伴尚未開放" description="待教會完成教材與試用確認後開放"><Header variant="compact" backTo={mentor?'/work':'/me/love-journey'}/><main className="mx-auto max-w-3xl space-y-5 px-4 py-6"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-xl font-semibold">門訓陪伴</h1><Button asChild variant="outline"><Link to={mentor?'/me/mentoring':'/work/mentoring'}>{mentor?'我的學習陪伴':'交給我的邀請'}</Link></Button></div><MentoringPanel key={String(mentor)} mode={mentor?'mentor':'learner'}/></main></FeatureGate>;
}
