import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    // Get role from user object (set by AuthContext from backend)
    const userRole = (user as any).role as AppRole | undefined;
    setRole(userRole || 'member');
    setLoading(false);
  }, [user, authLoading]);

  const refetch = async () => {
    // Re-fetch user data by reloading
    window.location.reload();
  };

  const isAdmin = role === 'admin';
  const isLeader = role === 'admin' || role === 'leader';
  const canCreateSession = role === 'admin' || role === 'leader' || role === 'future_leader';

  return {
    role,
    loading: loading || authLoading,
    isAdmin,
    isLeader,
    canCreateSession,
    refetch,
  };
};
