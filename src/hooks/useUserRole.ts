import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  const fetchRole = async () => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      // Use RPC to get user's highest role
      const { data, error } = await supabase.rpc('get_user_role', {
        _user_id: user.id,
      });

      if (error) {
        console.error('[useUserRole] Error fetching role:', error);
        setRole('member'); // Default to member on error
      } else {
        setRole(data as AppRole || 'member');
      }
    } catch (err) {
      console.error('[useUserRole] Unexpected error:', err);
      setRole('member');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchRole();
    }
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
