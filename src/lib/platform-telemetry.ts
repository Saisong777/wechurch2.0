type TelemetryPayload = Record<string, unknown>;

function postTelemetry(endpoint: string, payload: TelemetryPayload) {
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Telemetry must never break the user experience.
  });
}

function trackPageView() {
  postTelemetry('/api/events', {
    eventName: 'page_view',
    path: window.location.pathname,
    metadata: {
      search: window.location.search,
      referrer: document.referrer || null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
  });
}

export function initPlatformTelemetry() {
  if (typeof window === 'undefined') return;
  if ((window as Window & { __wechurchTelemetryReady?: boolean }).__wechurchTelemetryReady) return;
  (window as Window & { __wechurchTelemetryReady?: boolean }).__wechurchTelemetryReady = true;

  window.addEventListener('error', (event) => {
    postTelemetry('/api/client-errors', {
      message: event.message || 'Client error',
      stack: event.error?.stack,
      path: window.location.pathname,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    postTelemetry('/api/client-errors', {
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack,
      path: window.location.pathname,
      metadata: { type: 'unhandledrejection' },
    });
  });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    queueMicrotask(trackPageView);
    return result;
  };

  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    queueMicrotask(trackPageView);
    return result;
  };

  window.addEventListener('popstate', trackPageView);
  window.addEventListener('load', trackPageView, { once: true });
}
