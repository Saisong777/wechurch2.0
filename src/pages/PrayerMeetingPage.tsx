import { useSearchParams } from 'react-router-dom';
import { PrayerMeetingManager } from '@/components/prayer-meeting/PrayerMeetingManager';

export default function PrayerMeetingPage() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || undefined;
  
  return <PrayerMeetingManager initialCode={initialCode} />;
}
