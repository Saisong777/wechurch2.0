import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { rememberLoginReturn } from '@/lib/loginReturn';

export function ReadingScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const previousPath = useRef(location.pathname + location.search + location.hash);

  useLayoutEffect(() => {
    const next = location.pathname + location.search + location.hash;
    if (location.pathname === '/login' && !previousPath.current.startsWith('/login')) rememberLoginReturn(previousPath.current);
    previousPath.current = next;
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const key = location.key;
    const savedPositions = positions.current;
    const target = navigationType === 'POP' ? savedPositions.get(key) ?? 0 : 0;
    let restoring = true;
    let frame = 0;
    let lastY = target;
    const remember = () => {
      if (!restoring) { lastY = Math.max(0, window.scrollY); savedPositions.set(key, lastY); }
    };
    const stop = () => {
      restoring = false;
      observer?.disconnect();
    };
    const restore = () => {
      frame = 0;
      if (!restoring) return;
      let anchor: HTMLElement | null = null;
      try { anchor = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* Malformed external fragment. */ }
      if (anchor) { anchor.scrollIntoView(); stop(); return; }
      window.scrollTo({ top: target, behavior: 'instant' });
      // Lazy routes/data may not have made the page tall enough yet.
      if (Math.abs(window.scrollY - target) <= 1) stop();
    };
    const schedule = () => { if (!frame && restoring) frame = requestAnimationFrame(restore); };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    observer?.observe(document.documentElement);
    schedule();
    const timeout = window.setTimeout(stop, 10000);
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return () => {
      savedPositions.set(key, lastY);
      stop();
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener('scroll', remember);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('keydown', stop);
      if (savedPositions.size > 100) savedPositions.delete(savedPositions.keys().next().value!);
    };
  }, [location.key, location.hash, navigationType]);
  return null;
}
