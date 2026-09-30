import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole =
  | 'member'
  | 'leader'
  | 'future_leader'
  | 'admin'
  | 'senior_pastor'
  | 'pastor'
  | 'minister'
  | 'group_leader';

interface UserRoleResult {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  isSeniorPastor: boolean;
  isLeader: boolean;
  canAssignCrmScopes: boolean;
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

  const isSystemAdmin = role === 'admin';
  const isSeniorPastor = role === 'senior_pastor';
  const isAdmin = isSystemAdmin || isSeniorPastor;
  const isLeader = ['admin', 'senior_pastor', 'pastor', 'minister', 'group_leader', 'leader', 'future_leader'].includes(role || '');
  const canAssignCrmScopes = isAdmin;
  const canCreateSession = isLeader;

  return {
    role,
    loading: loading || authLoading,
    isAdmin,
    isSystemAdmin,
    isSeniorPastor,
    isLeader,
    canAssignCrmScopes,
    canCreateSession,
    refetch,
  };
};
