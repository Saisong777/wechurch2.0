import { Navigate } from 'react-router-dom';
import { FeatureGate } from '@/components/ui/feature-gate';

export default function SharePage() {
  return <FeatureGate featureKey="we_share" title="禱告功能維護中">
    <Navigate to="/grace-record" replace />
  </FeatureGate>;
}
