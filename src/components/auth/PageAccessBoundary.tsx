import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageLoader } from '@/components/PageLoader';
import { loginForPage, pageRequiresAuthentication } from '@shared/pageAccessPolicy';

export function PageAccessBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (pageRequiresAuthentication(location.pathname)) {
    if (loading) return <PageLoader />;
    if (!user) return <Navigate replace to={loginForPage(location.pathname + location.search + location.hash)} />;
  }
  return <>{children}</>;
}
