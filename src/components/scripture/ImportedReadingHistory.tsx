import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

interface Day { id: string; date: string; reference: string; completed: boolean }

export function ImportedReadingHistory({ userId }: { userId: string }) {
  const { data, isError, refetch } = useQuery<Day[]>({
    queryKey: ['/api/im-reading-history', userId],
    queryFn: async () => {
      const response = await fetch('/api/im-reading-history', { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to load reading history');
      return response.json();
    },
  });
  if (isError) return <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
    舊讀經紀錄暫時無法載入<Button variant="outline" onClick={() => refetch()}>重試</Button>
  </div>;
  if (!data?.length) return null;
  return <details className="mb-5 border-b pb-3">
    <summary className="min-h-11 cursor-pointer py-3 font-medium">iM 舊讀經紀錄 · {data.length} 天</summary>
    <ul className="max-h-80 overflow-y-auto divide-y" aria-label="舊 App 讀經日期">
      {data.map(day => <li key={day.id} className="flex min-h-11 items-start gap-3 py-3 text-sm">
        {day.completed && <CheckCircle2 aria-label="已讀" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
        <time className="shrink-0 text-muted-foreground" dateTime={day.date}>{day.date}</time>
        <span className="min-w-0 break-words">{day.reference}</span>
      </li>)}
    </ul>
  </details>;
}
