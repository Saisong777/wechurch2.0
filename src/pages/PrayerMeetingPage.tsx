import { useSearchParams } from 'react-router-dom';
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
        <PrayerMeetingManager initialCode={initialCode} />
      </div>
    </FeatureGate>
  );
}
