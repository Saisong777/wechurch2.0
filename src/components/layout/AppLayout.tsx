import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

const hiddenNavPaths = ['/login', '/reset-password', '/admin', '/admin/crm'];

export const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  
  const showNav = !hiddenNavPaths.some(path => 
    location.pathname === path || location.pathname.startsWith(path + '/')
  );

  return (
    <div className="min-h-screen flex flex-col">
      <div className={showNav ? "pb-14 sm:pb-16 md:pb-0" : ""}>
        {children}
      </div>
      {showNav && <BottomNav />}
    </div>
  );
};
