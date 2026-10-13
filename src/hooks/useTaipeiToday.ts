import { useEffect, useState } from 'react';
import { taipeiToday } from '@shared/churchDevotion';

// Refresh calendar bounds without changing the selected day or an open draft.
export function useTaipeiToday() {
  const [today, setToday] = useState(taipeiToday);
  useEffect(() => {
    const sync = () => setToday(taipeiToday());
    const timer = window.setInterval(sync, 30000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return today;
}
