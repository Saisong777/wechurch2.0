import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withRetry } from '@/lib/retry-utils';

export type AppRole = 'member' | 'leader' | 'future_leader' | 'admin';

interface UserRoleResult {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isLeader: boolean;
  canCreateSession: boolean;
  refetch: () => Promise<void>;
}

export const useUserRole = (): UserRoleResult => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchRole = async () => {
    if (!user) {
      setRole(null);
      setLoading(false);
      lastFetchedUserIdRef.current = null;
      return;
    }

    try {
      setLoading(true);

      // Use RPC to get user's highest role (retried with jitter to avoid login thundering herd)
      const roleData = await withRetry(
        async () => {
          const res = await supabase.rpc('get_user_role', { _user_id: user.id });
          if (res.error) throw res.error;
          return (res.data as AppRole | null) ?? 'member';
        },
        // Keep retries small; this runs for every user after login
        { maxRetries: 2, baseDelayMs: 600, maxDelayMs: 4000, jitterFactor: 0.4 }
      );

      setRole(roleData);
    } catch (err) {
      console.error('[useUserRole] Unexpected error:', err);
      setRole('member');
    } finally {
      setLoading(false);
      lastFetchedUserIdRef.current = user.id;
    }
  };

  useEffect(() => {
    if (authLoading) return;

    // Avoid double-fetch from rapid auth state transitions
    if (!user) {
      setRole(null);
      setLoading(false);
      lastFetchedUserIdRef.current = null;
      return;
    }

    if (lastFetchedUserIdRef.current === user.id) {
      setLoading(false);
      return;
    }

    // HIGH CONCURRENCY: Additional stagger AFTER auth completes
    // This ensures role fetches are spread out even if auth resolves simultaneously
    // Combined with AuthContext stagger, total spread is up to 3.5s
    let cancelled = false;
    const delay = Math.random() * 1500; // 0-1.5s additional delay
    const timeoutId = setTimeout(() => {
      if (!cancelled) fetchRole();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user, authLoading]);

  const isAdmin = role === 'admin';
  const isLeader = role === 'admin' || role === 'leader';
  const canCreateSession = role === 'admin' || role === 'leader' || role === 'future_leader';

  return {
    role,
    loading: loading || authLoading,
    isAdmin,
    isLeader,
    canCreateSession,
    refetch: fetchRole,
  };
};
