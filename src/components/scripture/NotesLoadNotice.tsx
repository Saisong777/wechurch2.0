import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotesLoadNotice({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  return <div role="alert" aria-label="筆記載入狀態" className="my-3 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 text-sm">
    <p className="min-w-0 flex-1">暫時無法取得最新筆記，目前僅顯示已載入的內容與此裝置草稿。</p>
    <Button variant="outline" disabled={busy} onClick={onRetry} className="min-h-11">
      <RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />重新載入筆記
    </Button>
  </div>;
}
