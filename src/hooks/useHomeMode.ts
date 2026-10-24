import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type HomeMode = 'traditional' | 'castle';
const STORAGE_KEY = 'wechurch_home_mode_v1';

function storedMode(): HomeMode {
  try { return localStorage.getItem(STORAGE_KEY) === 'castle' ? 'castle' : 'traditional'; }
  catch { return 'traditional'; }
}

export function useHomeMode() {
  const [params, setParams] = useSearchParams();
  // Keep the entry's fallback stable so Back restores a URL without mode correctly.
  const [preference] = useState<HomeMode>(storedMode);
  const requested = params.get('mode');
  const mode = requested === 'castle' || requested === 'traditional' ? requested : preference;
  const changeMode = (next: HomeMode) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* UI works without storage. */ }
    setParams(current => { const nextParams = new URLSearchParams(current); nextParams.set('mode', next); return nextParams; });
  };
  return { mode, changeMode };
}
