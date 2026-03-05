import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="min-h-screen flex flex-col bg-brand-warm">
      <div className={showNav ? "md:pb-0" : ""} style={showNav ? { paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' } : undefined}>
        <AnimatePresence mode="sync">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ willChange: 'opacity' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
      {showNav && <BottomNav />}
    </div>
  );
};
