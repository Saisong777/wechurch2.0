import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PrayerMeetingManager } from '@/components/prayer-meeting/PrayerMeetingManager';

export default function PrayerMeetingPage() {
  return <PrayerMeetingManager />;
}
