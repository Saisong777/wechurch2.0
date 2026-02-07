import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Book, ChevronRight, ChevronDown, X, AlertCircle, Copy, Share2, Bookmark, BookmarkCheck, Check, BookMarked, Volume2, Image, BookOpen, PenLine, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { FloatingToolbar } from '@/components/scripture/FloatingToolbar';
import { ScriptureCardCreator } from '@/components/scripture/ScriptureCardCreator';
import { DevotionalNoteDialog } from '@/components/scripture/DevotionalNoteDialog';
import { ScriptureTTS } from '@/components/scripture/ScriptureTTS';
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

interface BookCategory {
  name: string;
  books: number[];
}

const OLD_TESTAMENT_CATEGORIES: BookCategory[] = [
  { name: '摩西五經', books: [1, 2, 3, 4, 5] },
  { name: '舊約歷史', books: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { name: '智慧詩體', books: [18, 19, 20, 21, 22] },
  { name: '舊約先知書', books: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39] },
];

const NEW_TESTAMENT_CATEGORIES: BookCategory[] = [
  { name: '四福音', books: [40, 41, 42, 43] },
  { name: '教會歷史', books: [44] },
  { name: '新約書信', books: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65] },
  { name: '新約先知書', books: [66] },
];

const BiblePage = () => {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVerseNums, setSelectedVerseNums] = useState<Set<number>>(new Set());
  const [showCardModal, setShowCardModal] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedOT, setExpandedOT] = useState(true);
  const [expandedNT, setExpandedNT] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['摩西五經', '四福音']));
  const [searchCardVerse, setSearchCardVerse] = useState<{ text: string; reference: string } | null>(null);
  const [searchNoteVerse, setSearchNoteVerse] = useState<{ reference: string; text: string } | null>(null);
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

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const navigateToVerse = (verse: BibleVerse) => {
    setIsSearching(false);
    setSearchQuery('');
    setSelectedBook(verse.bookName);
    setSelectedChapter(verse.chapter);
    setSelectedVerseNums(new Set([verse.verse]));
  };

  const getBooksByCategory = (category: BookCategory, allBooks: BibleBook[]) => {
    return category.books
      .map(num => allBooks.find(b => b.bookNumber === num))
      .filter((b): b is BibleBook => !!b);
  };

  const SearchVerseActions = ({ verse }: { verse: BibleVerse }) => {
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); copyVerse(verse); }}
          title="複製經文"
          data-testid={`button-search-copy-${verse.id}`}
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); shareVerse(verse); }}
          title="分享經文"
          data-testid={`button-search-share-${verse.id}`}
        >
          <Share2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setSearchCardVerse({
              text: verse.text,
              reference: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
            });
          }}
          title="圖文分享"
          data-testid={`button-search-card-${verse.id}`}
        >
          <Image className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); navigateToVerse(verse); }}
          title="跳到經文原出處"
          data-testid={`button-search-goto-${verse.id}`}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setSearchNoteVerse({
              reference: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
              text: verse.text,
            });
          }}
          title="靈修筆記"
          data-testid={`button-search-note-${verse.id}`}
        >
          <PenLine className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const VerseActions = ({ verse }: { verse: BibleVerse }) => {
    const isSaved = isVerseSaved(verse);
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); copyVerse(verse); }}
          data-testid={`button-copy-${verse.id}`}
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); shareVerse(verse); }}
          data-testid={`button-share-${verse.id}`}
        >
          <Share2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isSaved ? 'text-primary' : ''}
          onClick={(e) => { e.stopPropagation(); toggleSaveVerse(verse); }}
          data-testid={`button-save-${verse.id}`}
        >
          {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </Button>
      </div>
    );
  };

  const renderCategorySection = (category: BookCategory, allBooks: BibleBook[]) => {
    const categoryBooks = getBooksByCategory(category, allBooks);
    if (categoryBooks.length === 0) return null;
    const isExpanded = expandedCategories.has(category.name);

    return (
      <div key={category.name} className="mb-1">
        <button
          className="w-full flex items-center gap-2 py-2 px-2 text-sm font-medium text-muted-foreground rounded-md hover-elevate transition-colors"
          onClick={() => toggleCategory(category.name)}
          data-testid={`button-category-${category.name}`}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
          <span>{category.name}</span>
          <span className="text-xs text-muted-foreground/60 ml-auto">{categoryBooks.length}卷</span>
        </button>
        {isExpanded && (
          <div className="grid grid-cols-1 gap-0.5 pl-2">
            {categoryBooks.map((book) => (
              <Button
                key={book.bookNumber}
                variant="ghost"
                className="justify-between h-auto py-2 px-2 text-sm"
                onClick={() => setSelectedBook(book.bookName)}
                data-testid={`button-book-${book.bookNumber}`}
              >
                <span>{book.bookName}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            ))}
          </div>
        )}
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
        <div className="max-w-5xl lg:max-w-6xl mx-auto w-full flex flex-col flex-1">
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
                  <h3 className="font-semibold text-sm sm:text-lg" data-testid="text-search-title">
                    搜尋: &ldquo;{searchQuery}&rdquo;
                    {searchResults.length > 0 && (
                      <span className="text-muted-foreground font-normal text-xs sm:text-sm ml-2">
                        ({searchResults.length} 筆結果)
                      </span>
                    )}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearSearch} className="h-7 sm:h-8 text-xs sm:text-sm" data-testid="button-back-from-search">
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
                    <div className="space-y-2 sm:space-y-3 pr-2 sm:pr-4">
                      {searchResults.map((v) => (
                        <div key={v.id} className="p-3 sm:p-4 rounded-lg bg-muted/50" data-testid={`search-result-${v.id}`}>
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-1 sm:mb-2">
                            <p className="text-sm sm:text-base text-primary font-medium">
                              {v.bookName} {v.chapter}:{v.verse}
                            </p>
                          </div>
                          <p className="text-sm sm:text-base leading-relaxed mb-2">{v.text}</p>
                          <SearchVerseActions verse={v} />
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
                  <div className="flex items-center gap-1">
                    <ScriptureTTS
                      text={selectedVerseNums.size > 0 ? getSelectedVerses().map(v => v.text).join(' ') : verses.map(v => v.text).join(' ')}
                      compact
                      label={selectedVerseNums.size > 0 ? `朗讀已選(${selectedVerseNums.size}節)` : '朗讀整章'}
                    />
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedChapter(null); setSelectedVerseNums(new Set()); }} className="h-7 sm:h-8 px-2 text-xs sm:text-sm">
                      返回
                    </Button>
                  </div>
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
            <div>
              {booksError ? (
                <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  <span>載入書卷時發生錯誤</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="py-4 px-3 sm:px-4">
                      <button
                        className="w-full flex items-center justify-between gap-2 mb-2"
                        onClick={() => setExpandedOT(!expandedOT)}
                        data-testid="button-toggle-old-testament"
                      >
                        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                          {expandedOT ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Book className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                          舊約聖經
                        </h3>
                        <span className="text-xs text-muted-foreground">{oldTestamentBooks.length}卷</span>
                      </button>
                      {expandedOT && (
                        <div className="mt-2">
                          {OLD_TESTAMENT_CATEGORIES.map(cat => renderCategorySection(cat, oldTestamentBooks))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-3 sm:px-4">
                      <button
                        className="w-full flex items-center justify-between gap-2 mb-2"
                        onClick={() => setExpandedNT(!expandedNT)}
                        data-testid="button-toggle-new-testament"
                      >
                        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                          {expandedNT ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Book className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
                          新約聖經
                        </h3>
                        <span className="text-xs text-muted-foreground">{newTestamentBooks.length}卷</span>
                      </button>
                      {expandedNT && (
                        <div className="mt-2">
                          {NEW_TESTAMENT_CATEGORIES.map(cat => renderCategorySection(cat, newTestamentBooks))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
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
          onNote={() => setShowNoteDialog(true)}
        />
      )}

      <ScriptureCardCreator
        open={showCardModal || !!searchCardVerse}
        onOpenChange={(open) => {
          if (!open) {
            setShowCardModal(false);
            setSearchCardVerse(null);
          }
        }}
        verse={searchCardVerse || getCardVerseData()}
      />

      <DevotionalNoteDialog
        open={showNoteDialog || !!searchNoteVerse}
        onOpenChange={(open) => {
          if (!open) {
            setShowNoteDialog(false);
            setSearchNoteVerse(null);
          }
        }}
        verseReference={searchNoteVerse?.reference || getCardVerseData().reference}
        verseText={searchNoteVerse?.text || getCardVerseData().text}
      />
    </div>
    </FeatureGate>
  );
};

export default BiblePage;
