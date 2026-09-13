import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart, BookHeart } from 'lucide-react';
import { PrayerMeetingManager } from '@/components/prayer-meeting/PrayerMeetingManager';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Header } from '@/components/layout/Header';

export default function PrayerMeetingPage() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || undefined;

  return (
    <FeatureGate
      featureKeys={["we_share", "prayer_meeting"]}
      title="禱告會功能維護中"
      description="禱告會功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen">
        <Header variant="compact" title="禱告會" backTo="/share" />
        <nav aria-label="代禱入口" className="mx-auto flex max-w-5xl flex-wrap gap-3 px-4 py-4">
          <Button asChild variant="outline"><Link to="/prayer-wall"><Heart className="mr-2 h-4 w-4" />公共禱告牆</Link></Button>
          <Button asChild variant="outline"><Link to="/devotion-wall"><BookHeart className="mr-2 h-4 w-4" />今日靈修牆</Link></Button>
          <Button asChild variant="outline"><Link to="/grace-record"><BookHeart className="mr-2 h-4 w-4" />我的禱告與分享</Link></Button>
        </nav>
        <PrayerMeetingManager initialCode={initialCode} />
      </div>
    </FeatureGate>
  );
}
