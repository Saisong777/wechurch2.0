import { churchFetch as fetch } from '@/lib/churchFetch';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

type PlatformSummary = {
  since: string;
  until: string;
  totalEvents: number;
  totalErrors: number;
  events: Array<{ event_name: string; count: number }>;
  errors: Array<{ source: string; status_code: number; path: string | null; count: number; last_seen: string }>;
};
const number = (value: number) => value.toLocaleString('zh-TW');
const time = (value: string) => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const PlatformMaturityPanel = () => {
  const { data, isPending, isError, isFetching, refetch } = useQuery<PlatformSummary>({
    queryKey: ['/api/admin/platform-summary'],
    queryFn: async () => (await apiRequest('GET', '/api/admin/platform-summary')).json(),
    refetchInterval: 120000,
  });
  return <section aria-label="使用與錯誤紀錄" className="min-w-0 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-lg font-semibold">使用與錯誤紀錄</h3><p className="text-sm text-muted-foreground">最近 7 天{data && ` · 更新於 ${time(data.until)}`}</p></div>
      <Button variant="outline" size="icon" aria-label="更新使用與錯誤紀錄" title="更新" disabled={isFetching} onClick={() => refetch()} data-testid="button-refresh-platform-summary"><RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /></Button>
    </div>
    {isError && <p role="alert" className="text-sm text-destructive">無法取得最新紀錄，請重新整理。{data ? '下方仍為上次取得的資料。' : ''}</p>}
    {isPending && <p role="status">載入紀錄中...</p>}
    {data && <>
      <dl className="grid grid-cols-2 gap-4 border-y py-4">
        <div><dt className="text-sm text-muted-foreground">已記錄的操作次數</dt><dd className="mt-1 text-2xl font-semibold">{number(data.totalEvents)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">已記錄的錯誤</dt><dd className="mt-1 text-2xl font-semibold">{number(data.totalErrors)}</dd></div>
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0"><h4 className="font-medium">近期錯誤</h4>
          {!data.errors.length ? <p className="mt-3 text-sm text-muted-foreground">期間內未記錄錯誤。</p> : <ul className="mt-2 divide-y">{data.errors.map(row => <li key={`${row.source}:${row.status_code}:${row.path}`} className="space-y-1 py-3 text-sm">
            <div className="flex justify-between gap-3"><span className="min-w-0 break-words">{row.source === 'client' ? '前端' : row.source === 'server' ? '伺服器' : row.source}{row.status_code ? ` · HTTP ${row.status_code}` : ''}</span><span className="shrink-0">{number(row.count)} 次</span></div>
            {row.path && <p className="break-all text-muted-foreground">{row.path}</p>}<p className="text-xs text-muted-foreground">最近發生：{time(row.last_seen)}</p>
          </li>)}</ul>}
        </section>
        <details className="min-w-0"><summary className="cursor-pointer font-medium">操作分佈</summary>
          {!data.events.length ? <p className="mt-3 text-sm text-muted-foreground">期間內未記錄操作。</p> : <ul className="mt-2 divide-y">{data.events.map(row => <li key={row.event_name} className="flex justify-between gap-3 py-3 text-sm"><span className="min-w-0 break-all">{row.event_name === 'page_view' ? '頁面瀏覽' : row.event_name}</span><span className="shrink-0">{number(row.count)}</span></li>)}</ul>}
        </details>
      </div>
    </>}
  </section>;
};
