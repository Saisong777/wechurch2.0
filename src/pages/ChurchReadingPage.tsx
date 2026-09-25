import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { DevotionalReader } from '@/components/scripture/DevotionalReader';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { fetchChurchReadingForToday, getChurchReadingForToday } from '@/lib/churchReading';

const ChurchReadingPage = () => {
  const fallbackReading = useMemo(() => getChurchReadingForToday(), []);
  const { data: syncedReading, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/church-reading/today'],
    queryFn: () => fetchChurchReadingForToday(),
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    retry: 1,
    staleTime: 30000,
  });
  const reading = syncedReading || fallbackReading;
  const [noteOpen, setNoteOpen] = useState(false);
  const verseText = reading.scriptureText || reading.previewVerses.map((verse) => `${verse.verse} ${verse.text}`).join('\n');
  const displayedDate = reading.date
    ? new Date(`${reading.date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })
    : '今天';

  return (
    <div className="min-h-screen bg-brand-warm">
      <Header variant="compact" title="每日靈修" backTo="/" />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {isLoading ? <p role="status" className="py-8">正在載入教會靈修課表…</p> : isError ? (
          <div role="alert" className="space-y-3 py-8"><p>暫時無法取得教會靈修課表。</p><Button variant="outline" onClick={() => refetch()}>重新載入</Button></div>
        ) : reading.sourceStatus === 'unpublished' ? (
          <div className="space-y-3 py-8"><h1 className="text-xl font-semibold">{reading.devotionalTitle}</h1><p className="text-sm text-muted-foreground">{displayedDate}</p><Button asChild variant="outline"><Link to="/learn/bible">閱讀聖經</Link></Button></div>
        ) : <>
          {reading.sourceStatus === 'fallback' && <p role="status" className="mb-4 text-sm text-muted-foreground">目前顯示備用內容，非已發佈的教會課表。</p>}
          <DevotionalReader key={`${reading.date}:${reading.scriptureReference}`} reading={reading} retry={() => refetch()} onNote={() => setNoteOpen(true)} />
        </>}
      </main>
      <DevotionalNoteDialog
        open={noteOpen && !isError && reading.sourceStatus !== 'unpublished'}
        onOpenChange={setNoteOpen}
        verseReference={reading.scriptureReference}
        verseText={verseText}
      />
    </div>
  );
};

export default ChurchReadingPage;
