import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseDocumentVisibilityOptions {
  /** Query keys to invalidate when document becomes visible */
  queryKeys?: string[][];
  /** Whether to enable the visibility listener */
  enabled?: boolean;
  /** Minimum time (ms) the tab must be hidden before triggering refresh on return */
  minHiddenTime?: number;
  /** Callback when document becomes visible */
  onVisible?: () => void;
  /** Callback when document becomes hidden */
  onHidden?: () => void;
}

/**
 * Hook to detect document visibility changes and trigger query invalidation
 * Optimized for mobile devices where tabs may be backgrounded frequently
 */
export const useDocumentVisibility = ({
  queryKeys = [],
  enabled = true,
  minHiddenTime = 2000, // 2 seconds minimum hidden time before refresh
  onVisible,
  onHidden,
}: UseDocumentVisibilityOptions = {}) => {
  const queryClient = useQueryClient();
  const hiddenAtRef = useRef<number | null>(null);
  const isVisibleRef = useRef(true);

  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    
    if (!isVisible) {
      // Document became hidden
      hiddenAtRef.current = Date.now();
      isVisibleRef.current = false;
      onHidden?.();
      return;
    }

    // Document became visible
    const wasHiddenFor = hiddenAtRef.current 
      ? Date.now() - hiddenAtRef.current 
      : 0;

    isVisibleRef.current = true;
    hiddenAtRef.current = null;

    // Only invalidate if hidden for minimum time
    if (wasHiddenFor >= minHiddenTime) {
      console.log(`[useDocumentVisibility] Tab visible after ${wasHiddenFor}ms, invalidating queries`);
      
      // Invalidate specified query keys
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    }

    onVisible?.();
  }, [queryClient, queryKeys, minHiddenTime, onVisible, onHidden]);

  // Handle page focus (for browsers that don't fire visibilitychange on focus)
  const handleFocus = useCallback(() => {
    if (!isVisibleRef.current && document.visibilityState === 'visible') {
      handleVisibilityChange();
    }
  }, [handleVisibilityChange]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, handleVisibilityChange, handleFocus]);

  return {
    isVisible: isVisibleRef.current,
    invalidateQueries: useCallback(() => {
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    }, [queryClient, queryKeys]),
  };
};
