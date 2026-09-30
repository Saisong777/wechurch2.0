import { useEffect, useState } from 'react';
import { RefreshCw, Home } from 'lucide-react';

export function freshPageUrl(href: string) {
  const url = new URL(href);
  url.searchParams.set('_reload', Date.now().toString());
  return url.href;
}

export function PageLoadRecovery() {
  return (
    <div className="space-y-4 text-center" role="alert">
      <p className="text-lg font-semibold">頁面暫時無法載入</p>
      <p className="text-sm text-muted-foreground">可能是連線中斷或網站剛完成更新，請重新載入。</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => window.location.replace(freshPageUrl(window.location.href))}
          className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground">
          <RefreshCw className="h-5 w-5" aria-hidden="true" />重新載入
        </button>
        <a href="/" className="inline-flex min-h-12 items-center gap-2 rounded-md border px-4 py-2">
          <Home className="h-5 w-5" aria-hidden="true" />回首頁
        </a>
      </div>
    </div>
  );
}

export function PageLoader() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-8">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border/70 bg-card p-5 text-center">
        {slow ? <PageLoadRecovery /> : <div role="status" className="space-y-4">
          <div aria-hidden="true" className="mx-auto h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="font-semibold">正在載入 WeChurch</p>
        </div>}
      </div>
    </div>
  );
}
