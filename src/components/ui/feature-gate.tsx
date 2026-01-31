import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Construction, ArrowLeft } from 'lucide-react';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { Skeleton } from '@/components/ui/skeleton';

interface FeatureGateProps {
  /**
   * Single feature key (backward compatible).
   * Prefer `featureKeys` when you need layered gating (e.g. parent + child).
   */
  featureKey?: string;
  /**
   * Multiple feature keys that must ALL be enabled.
   * Useful for parent+child feature toggles.
   */
  featureKeys?: string[];
  children: React.ReactNode;
  /** Optional custom title for the maintenance screen */
  title?: string;
  /** Optional custom description for the maintenance screen */
  description?: string;
}

/**
 * A gate component that checks if a feature is enabled.
 * If the feature is disabled, it shows a maintenance/coming soon screen.
 * If enabled, it renders the children.
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  featureKey,
  featureKeys,
  children,
  title,
  description,
}) => {
  const { isFeatureEnabled, getDisabledMessage, loading, error } = useFeatureToggles();

  const keysToCheck = (featureKeys && featureKeys.length > 0)
    ? featureKeys
    : (featureKey ? [featureKey] : []);

  if (keysToCheck.length === 0) {
    console.error('[FeatureGate] Missing featureKey/featureKeys');
    return <>{children}</>;
  }

  // Show loading skeleton while fetching feature toggles
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Skeleton className="h-10 w-32 mb-6" />
            <Card className="border-2 border-dashed">
              <CardContent className="py-16">
                <div className="flex flex-col items-center">
                  <Skeleton className="w-20 h-20 rounded-full mb-6" />
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Fail closed for gated screens if we couldn't load feature toggles.
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" size="sm" asChild className="mb-6">
              <Link to="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回首頁
              </Link>
            </Button>

            <Card className="border-2 border-dashed border-muted">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                  <Construction className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {title || '功能維護中'}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  {description || '目前無法確認功能狀態，請稍後再試'}
                </p>
                <Button variant="outline" asChild>
                  <Link to="/">返回首頁</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const firstDisabledKey = keysToCheck.find((k) => !isFeatureEnabled(k));

  // If all required features are enabled, render children
  if (!firstDisabledKey) {
    return <>{children}</>;
  }

  // Feature is disabled - show maintenance screen
  const disabledMessage = getDisabledMessage(firstDisabledKey);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link to="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回首頁
            </Link>
          </Button>

          {/* Maintenance Card */}
          <Card className="border-2 border-dashed border-muted">
            <CardContent className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                <Construction className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {title || disabledMessage || '功能維護中'}
              </h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {description || '此功能目前暫時無法使用，請稍後再試'}
              </p>
              <Button variant="outline" asChild>
                <Link to="/">返回首頁</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
