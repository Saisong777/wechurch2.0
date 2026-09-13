import { Link, Navigate } from 'react-router-dom';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';

export default function PublicWallsPage() {
  const { isFeatureEnabled, loading, error } = useFeatureToggles();
  if (loading) return <p role="status" className="p-6">正在載入分享牆…</p>;
  if (error) return <div role="alert" className="p-6">暫時無法載入分享牆。<Link to="/share" className="ml-2 underline">返回禱告</Link></div>;
  return <FeatureGate featureKeys={['we_share', isFeatureEnabled('we_learn') ? 'we_learn' : 'prayer_wall']} title="分享牆暫未開放">
    <Navigate to={isFeatureEnabled('we_learn') ? '/devotion-wall' : '/prayer-wall'} replace />
  </FeatureGate>;
}
