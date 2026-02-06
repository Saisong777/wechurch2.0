import { useState, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FloatingToolbar } from './FloatingToolbar';
import { ScriptureCardCreator } from './ScriptureCardCreator';

interface Verse {
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ScriptureViewerProps {
  verses: Verse[];
  className?: string;
  paragraphMode?: boolean;
  fontSizeClass?: string;
}

export const ScriptureViewer = ({ verses, className = '', paragraphMode = false, fontSizeClass }: ScriptureViewerProps) => {
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [showCardModal, setShowCardModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const verseRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { toast } = useToast();

  const getVerseKey = (v: Verse) => `${v.bookName}-${v.chapter}-${v.verse}`;

  const getAnchorRect = useCallback((): DOMRect | null => {
    if (selectedVerses.size === 0) return null;

    const selectedKeys = verses
      .filter(v => selectedVerses.has(getVerseKey(v)))
      .map(v => getVerseKey(v));
    
    if (selectedKeys.length === 0) return null;

    const firstKey = selectedKeys[0];
    const lastKey = selectedKeys[selectedKeys.length - 1];
    
    const firstEl = verseRefs.current.get(firstKey);
    const lastEl = verseRefs.current.get(lastKey);
    
    if (!firstEl || !lastEl) return null;

    const firstRect = firstEl.getBoundingClientRect();
    const lastRect = lastEl.getBoundingClientRect();
    
    return {
      top: firstRect.top,
      left: Math.min(firstRect.left, lastRect.left),
      right: Math.max(firstRect.right, lastRect.right),
      bottom: lastRect.bottom,
      width: Math.max(firstRect.width, lastRect.width),
      height: lastRect.bottom - firstRect.top,
      x: Math.min(firstRect.left, lastRect.left),
      y: firstRect.top,
      toJSON: () => ({}),
    } as DOMRect;
  }, [selectedVerses, verses]);

  const toggleVerseSelection = (v: Verse) => {
    const key = getVerseKey(v);
    setSelectedVerses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedVerses(new Set());
  };

  const getSelectedVersesList = () => {
    return verses.filter(v => selectedVerses.has(getVerseKey(v)));
  };

  const formatVerseReference = (versesList: Verse[]) => {
    if (versesList.length === 0) return '';
    const first = versesList[0];
    const last = versesList[versesList.length - 1];
    if (versesList.length === 1) {
      return `${first.bookName} ${first.chapter}:${first.verse}`;
    }
    return `${first.bookName} ${first.chapter}:${first.verse}-${last.verse}`;
  };

  const formatVersesText = (versesList: Verse[]) => {
    const text = versesList.map(v => v.text).join(' ');
    const ref = formatVerseReference(versesList);
    return `${text}\n— ${ref}`;
  };

  const handleCopySelected = async () => {
    const selected = getSelectedVersesList();
    if (selected.length === 0) {
      toast({ title: '請先選擇經文', variant: 'destructive' });
      return;
    }
    try {
      await navigator.clipboard.writeText(formatVersesText(selected));
      setCopied(true);
      toast({ title: '已複製', description: `已複製 ${selected.length} 節經文` });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: '複製失敗', variant: 'destructive' });
    }
  };

  const handleShareSelected = async () => {
    const selected = getSelectedVersesList();
    if (selected.length === 0) {
      toast({ title: '請先選擇經文', variant: 'destructive' });
      return;
    }
    const text = formatVersesText(selected);
    if (navigator.share) {
      try {
        await navigator.share({ title: formatVerseReference(selected), text });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(text);
          toast({ title: '已複製到剪貼簿' });
        }
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: '已複製到剪貼簿' });
    }
  };

  const handleOpenCardCreator = () => {
    const selected = getSelectedVersesList();
    if (selected.length === 0) {
      toast({ title: '請先選擇經文', variant: 'destructive' });
      return;
    }
    setShowCardModal(true);
  };

  const selectedList = getSelectedVersesList();
  const hasSelection = selectedList.length > 0;

  const cardVerse = hasSelection ? {
    text: selectedList.map(v => v.text).join(' '),
    reference: formatVerseReference(selectedList),
  } : { text: '', reference: '' };

  return (
    <div className={className}>
      <FloatingToolbar
        visible={hasSelection && !showCardModal}
        getAnchorRect={getAnchorRect}
        onCopy={handleCopySelected}
        onShare={handleShareSelected}
        onCreateCard={handleOpenCardCreator}
        onClear={clearSelection}
        selectedCount={selectedList.length}
        copied={copied}
      />

      {paragraphMode ? (
        <div className={`${fontSizeClass || 'text-base sm:text-lg'} leading-relaxed`}>
          {verses.map((v) => {
            const key = getVerseKey(v);
            const isSelected = selectedVerses.has(key);
            return (
              <span key={key}>
                <span
                  ref={(el) => {
                    if (el) verseRefs.current.set(key, el as unknown as HTMLDivElement);
                    else verseRefs.current.delete(key);
                  }}
                  className={`cursor-pointer transition-colors select-none rounded-sm ${
                    isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleVerseSelection(v);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                  }}
                  role="button"
                  tabIndex={0}
                  data-testid={`verse-${v.chapter}-${v.verse}`}
                >
                  <sup className="text-primary/60 font-medium text-[10px] mr-0.5">{v.verse}</sup>
                  {v.text}
                </span>
                {' '}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {verses.map((v) => {
            const key = getVerseKey(v);
            const isSelected = selectedVerses.has(key);
            return (
              <div
                key={key}
                ref={(el) => {
                  if (el) verseRefs.current.set(key, el);
                  else verseRefs.current.delete(key);
                }}
                className={`flex gap-2 p-2 rounded cursor-pointer transition-colors select-none ${
                  isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50 active:bg-muted'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleVerseSelection(v);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                }}
                role="button"
                tabIndex={0}
                data-testid={`verse-${v.chapter}-${v.verse}`}
              >
                {isSelected && <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />}
                <span className="text-primary font-medium min-w-[1.5rem]">{v.verse}</span>
                <span className="text-sm leading-relaxed">{v.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <ScriptureCardCreator
        open={showCardModal}
        onOpenChange={setShowCardModal}
        verse={cardVerse}
      />
    </div>
  );
};

export default ScriptureViewer;
