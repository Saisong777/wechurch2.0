import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withRetry } from '@/lib/retry-utils';

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      lastFetchedUserIdRef.current = null;
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await withRetry(
          async () => {
            const res = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('user_id', user.id)
              .maybeSingle();

            // Retry only on network-ish errors
            if (res.error) throw res.error;
            return res.data;
          },
          { maxRetries: 2, baseDelayMs: 600, maxDelayMs: 4000, jitterFactor: 0.4 }
        );

        if (data) {
          setProfile(data);
        } else {
          // Fallback to user metadata
          setProfile({
            display_name: user.user_metadata?.display_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
          });
        }
        lastFetchedUserIdRef.current = user.id;
        hasFetchedRef.current = true;
      } catch {
        // Fallback to user metadata on any failure
        setProfile({
          display_name: user.user_metadata?.display_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        });
      } finally {
        setLoading(false);
      }
    };

    // Avoid double-fetch on quick auth transitions.
    // (We still refetch if user changes, or if profile hasn't been fetched yet.)
    if (lastFetchedUserIdRef.current === user.id && hasFetchedRef.current) {
      setLoading(false);
      return;
    }

    // HIGH CONCURRENCY: Additional stagger AFTER auth completes
    // Combined with AuthContext stagger, total spread is up to 3.5s
    let cancelled = false;
    const delay = Math.random() * 1500; // 0-1.5s additional delay
    const timeoutId = setTimeout(() => {
      if (!cancelled) fetchProfile();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user]);

  return { profile, loading };
};
