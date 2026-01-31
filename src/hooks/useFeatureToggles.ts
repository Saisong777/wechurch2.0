import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeatureToggle {
  id: string;
  feature_key: string;
  feature_name: string;
  description: string | null;
  is_enabled: boolean;
  disabled_message: string | null;
  updated_at: string;
}

export function useFeatureToggles() {
  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_toggles')
        .select('*')
        .order('feature_key');

      if (error) throw error;
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

    // Subscribe to realtime updates
    const channel = supabase
      .channel('feature-toggles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_toggles',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setFeatures(prev => 
              prev.map(f => f.id === (payload.new as FeatureToggle).id 
                ? payload.new as FeatureToggle 
                : f
              )
            );
          } else if (payload.eventType === 'INSERT') {
            setFeatures(prev => [...prev, payload.new as FeatureToggle]);
          } else if (payload.eventType === 'DELETE') {
            setFeatures(prev => prev.filter(f => f.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isFeatureEnabled = (featureKey: string): boolean => {
    const feature = features.find(f => f.feature_key === featureKey);
    return feature?.is_enabled ?? true; // Default to enabled if not found
  };

  const getDisabledMessage = (featureKey: string): string => {
    const feature = features.find(f => f.feature_key === featureKey);
    return feature?.disabled_message || '即將推出';
  };

  const getFeature = (featureKey: string): FeatureToggle | undefined => {
    return features.find(f => f.feature_key === featureKey);
  };

  const updateFeature = async (featureKey: string, isEnabled: boolean, disabledMessage?: string) => {
    try {
      const updateData: { is_enabled: boolean; updated_at: string; disabled_message?: string } = {
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      };
      
      if (disabledMessage !== undefined) {
        updateData.disabled_message = disabledMessage;
      }

      const { error } = await supabase
        .from('feature_toggles')
        .update(updateData)
        .eq('feature_key', featureKey);

      if (error) throw error;
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
