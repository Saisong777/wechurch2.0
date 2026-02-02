import { useState, useEffect } from 'react';

export interface FeatureToggle {
  id: string;
  featureKey: string;
  featureName: string;
  description: string | null;
  isEnabled: boolean;
  disabledMessage: string | null;
  updatedAt: string;
}

export function useFeatureToggles() {
  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = async () => {
    try {
      const response = await fetch('/api/feature-toggles');
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      setFeatures(data || []);
    } catch (err) {
      console.error('Error fetching feature toggles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch features');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const isFeatureEnabled = (featureKey: string): boolean => {
    const feature = features.find(f => f.featureKey === featureKey);
    return feature?.isEnabled ?? true;
  };

  const getDisabledMessage = (featureKey: string): string => {
    const feature = features.find(f => f.featureKey === featureKey);
    return feature?.disabledMessage || '即將推出';
  };

  const getFeature = (featureKey: string): FeatureToggle | undefined => {
    return features.find(f => f.featureKey === featureKey);
  };

  const updateFeature = async (featureKey: string, isEnabled: boolean, disabledMessage?: string) => {
    try {
      const feature = features.find(f => f.featureKey === featureKey);
      if (!feature) return false;

      const response = await fetch(`/api/feature-toggles/${feature.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled,
          ...(disabledMessage !== undefined && { disabledMessage }),
        }),
      });

      if (!response.ok) throw new Error('Failed to update feature');
      await fetchFeatures();
      return true;
    } catch (err) {
      console.error('Error updating feature toggle:', err);
      return false;
    }
  };

  return {
    features,
    loading,
    error,
    isFeatureEnabled,
    getDisabledMessage,
    getFeature,
    updateFeature,
    refetch: fetchFeatures,
  };
}
