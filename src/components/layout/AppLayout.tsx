import { ChurchPageBoundary } from '@/contexts/ChurchContext';
import { ChurchControl } from './ChurchControl';
import { ReactNode, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MobileHeaderContext } from './MobileHeaderContext';
import { NetworkStatusBanner } from './NetworkStatusBanner';
import { MobileNavigation } from './MobileNavigation';
import { ReadingScrollRestoration } from './ReadingScrollRestoration';
import { ErrorBoundary } from '@/components/ui/error-boundary';

import { IntroductionTour } from '@/components/onboarding/IntroductionTour';
import { FirstChurchChoice } from '@/components/onboarding/FirstChurchChoice';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchOnboarding } from '@/hooks/useChurchOnboarding';

interface AppLayoutProps {
  children: ReactNode;
}

const hiddenNavPaths = ['/login', '/reset-password', '/admin', '/admin/crm', '/user/study'];

export const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const onboarding = useChurchOnboarding();
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  const mobileHeader = useMemo(() => ({ actionsTarget, setActionsTarget }), [actionsTarget]);

  const showNav = !hiddenNavPaths.some(path =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  );

  const tenantPage = /^\/(?:admin|groups|prayer-wall|walls|devotion-wall|support|work|prayer-meeting)(?:\/|$)/.test(location.pathname) || location.pathname === '/learn/church-reading';
  return (
    <MobileHeaderContext.Provider value={showNav ? mobileHeader : null}>
    <div className="app-shell flex flex-col bg-brand-warm">
      <ReadingScrollRestoration />
      <NetworkStatusBanner />
      <div className="border-b border-border px-4 py-2"><div className="mx-auto max-w-6xl"><ChurchControl /></div></div>
      <FirstChurchChoice key={user?.id || 'anonymous'} />
      <IntroductionTour paused={!!user && (onboarding.isPending || onboarding.isError || !!onboarding.data?.canChoose)} />
      {showNav && <MobileNavigation key={location.key} />}
      <div className={showNav ? "mobile-page-content flex-1" : "flex-1"}>
        <ChurchPageBoundary personal={!tenantPage} allowPendingOwner={/^\/(support|work)(?:\/|$)/.test(location.pathname)}><ErrorBoundary key={location.pathname} fallbackTitle="這個頁面暫時無法載入">{children}</ErrorBoundary></ChurchPageBoundary>
      </div>
      {showNav && <footer className="flex flex-wrap justify-center gap-6 border-t border-border bg-background px-4 py-5 text-sm"><Link to="/help" className="min-h-11 inline-flex items-center underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">使用說明</Link><Link to="/feedback" state={{from:location.pathname}} className="min-h-11 inline-flex items-center underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">意見反饋</Link></footer>}
    </div>
    </MobileHeaderContext.Provider>
  );
};
