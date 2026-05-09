import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export const NetworkStatusBanner = () => {
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    let restoreTimer: number | undefined;

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      restoreTimer = window.setTimeout(() => setShowRestored(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  const Icon = isOnline ? Wifi : WifiOff;

  return (
    <div
      className="fixed inset-x-3 top-3 z-[70] mx-auto max-w-md rounded-full border border-white/70 bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur md:top-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2">
        <Icon className={isOnline ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-destructive'} />
        <span>
          {isOnline ? '網路已恢復，可以繼續使用' : '目前網路不穩，已暫停新的操作'}
        </span>
      </div>
    </div>
  );
};
