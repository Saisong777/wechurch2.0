import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChurchReadingSummary } from '@/lib/churchReading';
import { formatScriptureText } from '@/lib/scriptureDisplay';

export function ScriptureSection({ reading, retry }: { reading: ChurchReadingSummary; retry: () => void }) {
  const location = useLocation();
  const expansionKey = `wechurch:reading-expanded:${location.key}:${reading.date}:${reading.scriptureReference}`;
  const [expanded, setExpanded] = useState(() => {
    try { return sessionStorage.getItem(expansionKey) === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(expansionKey, String(expanded)); } catch { /* Storage may be disabled. */ }
  }, [expanded, expansionKey]);
  const contentId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const canCollapse = reading.previewVerses.length > 2 || Boolean(reading.scriptureText);
  const verses = expanded ? reading.previewVerses : reading.previewVerses.slice(0, 2);
  const collapseFromEnd = () => {
    setExpanded(false);
    toggleRef.current?.focus({ preventScroll: true });
    toggleRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  };

  return (
    <section aria-label="今日經文" className="space-y-3 border-y border-border py-5" data-testid="daily-scripture-full">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="min-w-0 break-words text-base font-semibold">{reading.scriptureReference}</h2>
        {canCollapse && <Button ref={toggleRef} variant="ghost" size="sm" className="min-h-11 shrink-0" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="mr-1 h-4 w-4" aria-hidden="true" /> : <ChevronDown className="mr-1 h-4 w-4" aria-hidden="true" />}
          {expanded ? '收起經文' : '展開經文'}
        </Button>}
      </div>
      {reading.scriptureStatus === 'unavailable' && <div role="status" className="flex flex-wrap items-center gap-2 text-sm"><p>經文暫時無法載入。</p><Button variant="outline" size="sm" onClick={retry}>重新載入經文</Button></div>}
      <div id={contentId} className="space-y-2">
        {reading.scriptureText && <p className={`whitespace-pre-wrap text-lg leading-8 text-foreground ${expanded ? '' : 'line-clamp-4'}`}>{formatScriptureText(reading.scriptureText)}</p>}
        {!reading.scriptureText && !reading.previewVerses.length && <Link to="/learn/bible" className="text-sm font-medium text-primary">在聖經中閱讀：{reading.scriptureReference}</Link>}
        {verses.map((verse) => (
          <p key={verse.verse} className="text-lg leading-8 text-foreground" data-testid={`daily-verse-${verse.verse}`}>
            <sup className="mr-2 text-xs text-muted-foreground">{verse.verse}</sup>{formatScriptureText(verse.text)}
          </p>
        ))}
      </div>
      {expanded && canCollapse && <Button variant="ghost" size="sm" className="min-h-11" aria-expanded={expanded} aria-controls={contentId} onClick={collapseFromEnd}>
        <ChevronUp className="mr-1 h-4 w-4" aria-hidden="true" />收起經文
      </Button>}
    </section>
  );
}
