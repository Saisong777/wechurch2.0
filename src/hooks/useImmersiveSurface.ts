import { useLayoutEffect } from 'react';

/** The class owns only castle CSS. Inline scroll styles remain owned by dialogs and the host. */
export function useImmersiveSurface() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const hadClass = html.classList.contains('castle-immersive-active');
    html.classList.add('castle-immersive-active');
    return () => { if (!hadClass) html.classList.remove('castle-immersive-active'); };
  }, []);
}
