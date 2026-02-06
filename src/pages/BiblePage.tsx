import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Book, ChevronRight, X, AlertCircle, Copy, Share2, Bookmark, BookmarkCheck, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { FloatingToolbar } from '@/components/scripture/FloatingToolbar';
import { ScriptureCardCreator } from '@/components/scripture/ScriptureCardCreator';
import { FeatureGate } from '@/components/ui/feature-gate';

interface BibleBook {
  bookName: string;
  bookNumber: number;
  chapterCount: number;
}

interface BibleChapter {
  chapter: number;
  verseCount: number;
}

interface BibleVerse {
  id: number;
  bookName: string;
  bookNumber: number;
  chapter: number;
  verse: number;
  text: string;
}

interface SavedVerse {
  id: string;
  bookName: string;
  chapter: number;
  verseStart: number;
}

const BiblePage = () => {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVerseNums, setSelectedVerseNums] = useState<Set<number>>(new Set());
  const [showCardModal, setShowCardModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const verseRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: books = [], isError: booksError } = useQuery<BibleBook[]>({
    queryKey: ['/api/bible/books'],
  });

  const { data: chapters = [], isError: chaptersError } = useQuery<BibleChapter[]>({
    queryKey: ['/api/bible/chapters', selectedBook],
    queryFn: async () => {
      const res = await fetch(`/api/bible/chapters/${encodeURIComponent(selectedBook!)}`);
      if (!res.ok) throw new Error('Failed to fetch chapters');
      return res.json();
    },
    enabled: !!selectedBook,
  });

  const { data: verses = [], isLoading: versesLoading, isError: versesError } = useQuery<BibleVerse[]>({
    queryKey: ['/api/bible/verses', selectedBook, selectedChapter],
    queryFn: async () => {
      const res = await fetch(`/api/bible/verses/${encodeURIComponent(selectedBook!)}/${selectedChapter}`);
      if (!res.ok) throw new Error('Failed to fetch verses');
      return res.json();
    },
    enabled: !!selectedBook && !!selectedChapter,
  });

  const { data: searchResults = [], isLoading: searchLoading, isError: searchError } = useQuery<BibleVerse[]>({
    queryKey: ['/api/bible/search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/bible/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Failed to search');
      return res.json();
    },
    enabled: isSearching && searchQuery.length >= 2,
  });

  const { data: savedVerses = [] } = useQuery<SavedVerse[]>({
    queryKey: ['/api/saved-verses'],
  });

  const saveVerseMutation = useMutation({
    mutationFn: async (verse: BibleVerse) => {
      return apiRequest('POST', '/api/saved-verses', {
        verseReference: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
        verseText: verse.text,
        bookName: verse.bookName,
        chapter: verse.chapter,
        verseStart: verse.verse,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-verses'] });
      toast({
        title: "已收藏",
        description: "經文已加入收藏",
      });
    },
    onError: () => {
      toast({
        title: "收藏失敗",
        description: "請先登入以使用收藏功能",
        variant: "destructive",
      });
    },
  });

  const deleteVerseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/saved-verses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-verses'] });
      toast({
        title: "已取消收藏",
      });
    },
  });

  const oldTestamentBooks = books.filter(b => b.bookNumber <= 39);
  const newTestamentBooks = books.filter(b => b.bookNumber > 39);

  const isVerseSaved = (verse: BibleVerse) => {
    return savedVerses.some(sv => 
      sv.bookName === verse.bookName && 
      sv.chapter === verse.chapter && 
      sv.verseStart === verse.verse
    );
  };

  const getSavedVerseId = (verse: BibleVerse) => {
    const saved = savedVerses.find(sv => 
      sv.bookName === verse.bookName && 
      sv.chapter === verse.chapter && 
      sv.verseStart === verse.verse
    );
    return saved?.id;
  };

  const handleSearch = () => {
    if (searchQuery.length >= 2) {
      setIsSearching(true);
      setSelectedBook(null);
      setSelectedChapter(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  const toggleVerseSelection = (verseNum: number) => {
    setSelectedVerseNums(prev => {
      const newSet = new Set(prev);
      if (newSet.has(verseNum)) {
        newSet.delete(verseNum);
      } else {
        newSet.add(verseNum);
      }
      return newSet;
    });
  };

  const getSelectedVerses = () => {
    return verses.filter(v => selectedVerseNums.has(v.verse)).sort((a, b) => a.verse - b.verse);
  };

  const copyVerse = async (verse: BibleVerse) => {
    const text = `${verse.bookName} ${verse.chapter}:${verse.verse}\n${verse.text}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "已複製",
        description: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
      });
    } catch (err) {
      toast({
        title: "複製失敗",
        description: "請手動選取複製",
        variant: "destructive",
      });
    }
  };

  const copySelectedVerses = async () => {
    const selectedVersesList = getSelectedVerses();
    if (selectedVersesList.length === 0) return;
    
    const verseNums = selectedVersesList.map(v => v.verse);
    const rangeText = formatVerseRange(verseNums);
    const header = `${selectedBook} ${selectedChapter}:${rangeText}`;
    const text = selectedVersesList.map(v => `${v.verse} ${v.text}`).join('\n');
    
    try {
      await navigator.clipboard.writeText(`${header}\n${text}`);
      toast({
        title: "已複製",
        description: `${selectedVersesList.length} 節經文`,
      });
    } catch (err) {
      toast({
        title: "複製失敗",
        variant: "destructive",
      });
    }
  };

  const formatVerseRange = (nums: number[]) => {
    if (nums.length === 0) return '';
    if (nums.length === 1) return nums[0].toString();
    
    const sorted = [...nums].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(',');
  };

  const shareVerse = async (verse: BibleVerse) => {
    const text = `${verse.bookName} ${verse.chapter}:${verse.verse}\n${verse.text}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
          text: text,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await copyVerse(verse);
        }
      }
    } else {
      await copyVerse(verse);
    }
  };

  const shareSelectedVerses = async () => {
    const selectedVersesList = getSelectedVerses();
    if (selectedVersesList.length === 0) return;
    
    const verseNums = selectedVersesList.map(v => v.verse);
    const rangeText = formatVerseRange(verseNums);
    const header = `${selectedBook} ${selectedChapter}:${rangeText}`;
    const text = selectedVersesList.map(v => `${v.verse} ${v.text}`).join('\n');
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: header,
          text: `${header}\n${text}`,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await copySelectedVerses();
        }
      }
    } else {
      await copySelectedVerses();
    }
  };

  const toggleSaveVerse = (verse: BibleVerse) => {
    if (isVerseSaved(verse)) {
      const id = getSavedVerseId(verse);
      if (id) {
        deleteVerseMutation.mutate(id);
      }
    } else {
      saveVerseMutation.mutate(verse);
    }
  };

  const openCardCreator = () => {
    if (selectedVerseNums.size === 0) {
      toast({
        title: "請先選擇經文",
        description: "點擊經文即可選取",
        variant: "destructive",
      });
      return;
    }
    setShowCardModal(true);
  };

  const getAnchorRect = useCallback((): DOMRect | null => {
    if (selectedVerseNums.size === 0) return null;
    
    const sortedNums = Array.from(selectedVerseNums).sort((a, b) => a - b);
    const firstNum = sortedNums[0];
    const lastNum = sortedNums[sortedNums.length - 1];
    
    const firstEl = verseRefs.current.get(firstNum);
    const lastEl = verseRefs.current.get(lastNum);
    
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
  }, [selectedVerseNums]);

  const getCardVerseData = () => {
    const selectedVersesList = getSelectedVerses();
    if (selectedVersesList.length === 0) return { text: '', reference: '' };
    
    const verseNums = selectedVersesList.map(v => v.verse);
    const rangeText = formatVerseRange(verseNums);
    const reference = `${selectedBook} ${selectedChapter}:${rangeText}`;
    const text = selectedVersesList.map(v => v.text).join(' ');
    return { text, reference };
  };

  const VerseActions = ({ verse }: { verse: BibleVerse }) => {
    const isSaved = isVerseSaved(verse);
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); copyVerse(verse); }}
          data-testid={`button-copy-${verse.id}`}
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); shareVerse(verse); }}
          data-testid={`button-share-${verse.id}`}
        >
          <Share2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${isSaved ? 'text-primary' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleSaveVerse(verse); }}
          data-testid={`button-save-${verse.id}`}
        >
          {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </Button>
      </div>
    );
  };


  return (
    <FeatureGate
      featureKeys={["we_learn", "bible_reading"]}
      title="聖經閱讀功能維護中"
      description="聖經閱讀功能目前暫時關閉，請稍後再試"
    >
    <div className="min-h-screen bg-background flex flex-col">
      <Header title="聖經閱讀" subtitle="和合本" variant="compact" />
      
      <main className="flex-1 container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col">
        <div className="max-w-4xl lg:max-w-5xl mx-auto w-full flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-2 sm:mb-4">
            <div className="flex gap-1 sm:gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋經文..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm"
                  data-testid="input-bible-search"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={clearSearch}
                    data-testid="button-clear-search"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Button onClick={handleSearch} size="sm" className="h-9 px-2 sm:px-3" data-testid="button-search">
                <Search className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">搜尋</span>
              </Button>
            </div>
          </div>

          {isSearching ? (
            <Card className="flex-1 flex flex-col">
              <CardContent className="py-3 sm:py-6 flex-1 flex flex-col">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3 sm:mb-6">
                  <h3 className="font-semibold text-sm sm:text-lg">搜尋: "{searchQuery}"</h3>
                  <Button variant="ghost" size="sm" onClick={clearSearch} className="h-7 sm:h-8 text-xs sm:text-sm">
                    返回書卷
                  </Button>
                </div>
                {searchLoading ? (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">搜尋中...</div>
                ) : searchError ? (
                  <div className="text-center py-8 sm:py-12 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-sm">搜尋時發生錯誤</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">找不到相關經文</div>
                ) : (
                  <ScrollArea className="flex-1 h-[calc(100vh-220px)] sm:h-[calc(100vh-280px)]">
                    <div className="space-y-2 sm:space-y-4 pr-2 sm:pr-4">
                      {searchResults.map((v) => (
                        <div key={v.id} className="p-2 sm:p-4 rounded-lg bg-muted/50 group">
                          <div className="flex justify-between items-start mb-1 sm:mb-2">
                            <p className="text-sm sm:text-base text-primary font-medium">
                              {v.bookName} {v.chapter}:{v.verse}
                            </p>
                            <VerseActions verse={v} />
                          </div>
                          <p className="text-base sm:text-lg md:text-lg leading-relaxed">{v.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ) : selectedBook && selectedChapter ? (
            <Card className="flex-1 flex flex-col">
              <CardContent className="py-2 sm:py-4 flex-1 flex flex-col">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-2 sm:mb-4">
                  <h3 className="font-semibold text-base sm:text-xl">{selectedBook} {selectedChapter}章</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedChapter(null); setSelectedVerseNums(new Set()); }} className="h-7 sm:h-8 px-2 text-xs sm:text-sm">
                    返回
                  </Button>
                </div>
                
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
                  點擊經文可選取，已選 {selectedVerseNums.size} 節
                </p>
                
                {versesLoading ? (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">載入中...</div>
                ) : versesError ? (
                  <div className="text-center py-8 sm:py-12 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-sm">載入經文時發生錯誤</span>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 h-[calc(100vh-240px)] sm:h-[calc(100vh-300px)]">
                    <div className="space-y-1 sm:space-y-2 pr-2 sm:pr-4">
                      {verses.map((v) => (
                        <div 
                          key={v.verse} 
                          ref={(el) => {
                            if (el) verseRefs.current.set(v.verse, el);
                            else verseRefs.current.delete(v.verse);
                          }}
                          className={`flex gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg cursor-pointer group transition-colors ${
                            selectedVerseNums.has(v.verse) 
                              ? 'bg-primary/10 ring-1 sm:ring-2 ring-primary/30' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleVerseSelection(v.verse)}
                          data-testid={`verse-${v.chapter}-${v.verse}`}
                        >
                          <div className="flex items-start gap-1 sm:gap-2">
                            {selectedVerseNums.has(v.verse) && (
                              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary mt-0.5 sm:mt-1 flex-shrink-0" />
                            )}
                            <span className="text-primary font-bold text-sm sm:text-lg min-w-[1.5rem] sm:min-w-[2rem] text-right">{v.verse}</span>
                          </div>
                          <span className="text-base sm:text-lg md:text-lg leading-relaxed flex-1">{v.text}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ) : selectedBook ? (
            <Card>
              <CardContent className="py-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-xl">{selectedBook}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBook(null)}>
                    返回書卷
                  </Button>
                </div>
                {chaptersError ? (
                  <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>載入章節時發生錯誤</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                    {chapters.map((c) => (
                      <Button
                        key={c.chapter}
                        variant="outline"
                        className="h-12 text-lg"
                        onClick={() => setSelectedChapter(c.chapter)}
                        data-testid={`button-chapter-${c.chapter}`}
                      >
                        {c.chapter}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {booksError ? (
                <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  <span>載入書卷時發生錯誤</span>
                </div>
              ) : (
                <>
                  <Card>
                    <CardContent className="py-6">
                      <h3 className="font-semibold text-xl mb-4 flex items-center gap-2">
                        <Book className="w-5 h-5 text-amber-600" />
                        舊約聖經
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {oldTestamentBooks.map((book) => (
                          <Button
                            key={book.bookNumber}
                            variant="ghost"
                            className="justify-between h-auto py-3 text-base"
                            onClick={() => setSelectedBook(book.bookName)}
                            data-testid={`button-book-${book.bookNumber}`}
                          >
                            <span>{book.bookName}</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-6">
                      <h3 className="font-semibold text-xl mb-4 flex items-center gap-2">
                        <Book className="w-5 h-5 text-sky-600" />
                        新約聖經
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {newTestamentBooks.map((book) => (
                          <Button
                            key={book.bookNumber}
                            variant="ghost"
                            className="justify-between h-auto py-3 text-base"
                            onClick={() => setSelectedBook(book.bookName)}
                            data-testid={`button-book-${book.bookNumber}`}
                          >
                            <span>{book.bookName}</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {selectedBook && selectedChapter && (
        <FloatingToolbar
          visible={selectedVerseNums.size > 0}
          getAnchorRect={getAnchorRect}
          selectedCount={selectedVerseNums.size}
          onCopy={async () => {
            await copySelectedVerses();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          onShare={shareSelectedVerses}
          onCreateCard={openCardCreator}
          onClear={() => setSelectedVerseNums(new Set())}
          copied={copied}
        />
      )}

      <ScriptureCardCreator
        open={showCardModal}
        onOpenChange={setShowCardModal}
        verse={getCardVerseData()}
      />
    </div>
    </FeatureGate>
  );
};

export default BiblePage;
