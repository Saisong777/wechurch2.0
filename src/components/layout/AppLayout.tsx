import { ReactNode, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MobileHeaderContext } from './MobileHeaderContext';
import { NetworkStatusBanner } from './NetworkStatusBanner';
import { MobileNavigation } from './MobileNavigation';
import { ReadingScrollRestoration } from './ReadingScrollRestoration';
import { ErrorBoundary } from '@/components/ui/error-boundary';

interface AppLayoutProps {
  children: ReactNode;
}

const hiddenNavPaths = ['/login', '/reset-password', '/admin', '/admin/crm', '/user/study'];

export const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  const mobileHeader = useMemo(() => ({ actionsTarget, setActionsTarget }), [actionsTarget]);

  const showNav = !hiddenNavPaths.some(path =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  );

  return (
    <MobileHeaderContext.Provider value={showNav ? mobileHeader : null}>
    <div className="app-shell flex flex-col bg-brand-warm">
      <ReadingScrollRestoration />
      <NetworkStatusBanner />
      {showNav && <MobileNavigation key={location.key} />}
      <div className={showNav ? "mobile-page-content flex-1" : "flex-1"}>
        <ErrorBoundary key={location.pathname} fallbackTitle="這個頁面暫時無法載入">{children}</ErrorBoundary>
      </div>
    </div>
    </MobileHeaderContext.Provider>
  );
};
