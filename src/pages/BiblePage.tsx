import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Search, Book, ChevronRight, X, AlertCircle, Copy, Share2, Bookmark, BookmarkCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
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
      return apiRequest('/api/saved-verses', {
        method: 'POST',
        body: JSON.stringify({
          verseReference: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
          verseText: verse.text,
          bookName: verse.bookName,
          chapter: verse.chapter,
          verseStart: verse.verse,
        }),
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
      return apiRequest(`/api/saved-verses/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-verses'] });
      toast({
        title: "已取消收藏",
      });
    },
  });

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

  const toggleVerseSelection = (verseId: number) => {
    setSelectedVerses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(verseId)) {
        newSet.delete(verseId);
      } else {
        newSet.add(verseId);
      }
      return newSet;
    });
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
    const selectedVersesList = verses.filter(v => selectedVerses.has(v.id));
    if (selectedVersesList.length === 0) return;
    
    const text = selectedVersesList
      .map(v => `${v.verse} ${v.text}`)
      .join('\n');
    const header = `${selectedBook} ${selectedChapter}:${selectedVersesList.map(v => v.verse).join(',')}`;
    
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
    const selectedVersesList = verses.filter(v => selectedVerses.has(v.id));
    if (selectedVersesList.length === 0) return;
    
    const text = selectedVersesList.map(v => `${v.verse} ${v.text}`).join('\n');
    const header = `${selectedBook} ${selectedChapter}:${selectedVersesList.map(v => v.verse).join(',')}`;
    const fullText = `${header}\n${text}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: header,
          text: fullText,
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

  const toggleSaveVerse = async (verse: BibleVerse) => {
    const savedId = getSavedVerseId(verse);
    if (savedId) {
      deleteVerseMutation.mutate(savedId);
    } else {
      saveVerseMutation.mutate(verse);
    }
  };

  const oldTestamentBooks = books.filter(b => b.bookNumber <= 39);
  const newTestamentBooks = books.filter(b => b.bookNumber > 39);

  const VerseActions = ({ verse }: { verse: BibleVerse }) => {
    const isSaved = isVerseSaved(verse);
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); copyVerse(verse); }}
          data-testid={`button-copy-${verse.id}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); shareVerse(verse); }}
          data-testid={`button-share-${verse.id}`}
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${isSaved ? 'text-primary' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleSaveVerse(verse); }}
          data-testid={`button-save-${verse.id}`}
        >
          {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="聖經閱讀" subtitle="和合本" />
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/learn" className="gap-2" data-testid="link-back-learn">
              <ArrowLeft className="w-4 h-4" />
              返回學習
            </Link>
          </Button>

          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋經文..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
                data-testid="input-bible-search"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={clearSearch}
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch} data-testid="button-search">
              搜尋
            </Button>
          </div>

          {isSearching ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">搜尋結果: "{searchQuery}"</h3>
                  <Button variant="ghost" size="sm" onClick={clearSearch}>
                    返回書卷列表
                  </Button>
                </div>
                {searchLoading ? (
                  <div className="text-center py-8 text-muted-foreground">搜尋中...</div>
                ) : searchError ? (
                  <div className="text-center py-8 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>搜尋時發生錯誤</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">找不到相關經文</div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {searchResults.map((v) => (
                        <div key={v.id} className="p-3 rounded-lg bg-muted/50 group">
                          <div className="flex justify-between items-start">
                            <p className="text-sm text-primary font-medium mb-1">
                              {v.bookName} {v.chapter}:{v.verse}
                            </p>
                            <VerseActions verse={v} />
                          </div>
                          <p className="text-foreground">{v.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ) : selectedBook && selectedChapter ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">{selectedBook} 第 {selectedChapter} 章</h3>
                  <div className="flex gap-2">
                    {selectedVerses.size > 0 && (
                      <>
                        <Button variant="outline" size="sm" onClick={copySelectedVerses}>
                          <Copy className="w-4 h-4 mr-1" />
                          複製 ({selectedVerses.size})
                        </Button>
                        <Button variant="outline" size="sm" onClick={shareSelectedVerses}>
                          <Share2 className="w-4 h-4 mr-1" />
                          分享
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedChapter(null); setSelectedVerses(new Set()); }}>
                      返回章節
                    </Button>
                  </div>
                </div>
                {versesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">載入中...</div>
                ) : versesError ? (
                  <div className="text-center py-8 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>載入經文時發生錯誤</span>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-1">
                      {verses.map((v) => (
                        <div 
                          key={v.id} 
                          className={`flex gap-2 p-2 rounded-lg cursor-pointer group transition-colors ${
                            selectedVerses.has(v.id) ? 'bg-primary/10' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleVerseSelection(v.id)}
                          data-testid={`verse-${v.chapter}-${v.verse}`}
                        >
                          <span className="text-primary font-medium min-w-[2rem] text-right">{v.verse}</span>
                          <span className="text-foreground flex-1">{v.text}</span>
                          <VerseActions verse={v} />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ) : selectedBook ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">{selectedBook}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBook(null)}>
                    返回書卷
                  </Button>
                </div>
                {chaptersError ? (
                  <div className="text-center py-8 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>載入章節時發生錯誤</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                    {chapters.map((c) => (
                      <Button
                        key={c.chapter}
                        variant="outline"
                        className="h-10"
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
                <div className="text-center py-8 text-destructive flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  <span>載入書卷時發生錯誤</span>
                </div>
              ) : (
                <>
                  <Card>
                    <CardContent className="py-4">
                      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Book className="w-5 h-5 text-amber-600" />
                        舊約聖經
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {oldTestamentBooks.map((book) => (
                          <Button
                            key={book.bookNumber}
                            variant="ghost"
                            className="justify-between h-auto py-2"
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
                    <CardContent className="py-4">
                      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Book className="w-5 h-5 text-sky-600" />
                        新約聖經
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {newTestamentBooks.map((book) => (
                          <Button
                            key={book.bookNumber}
                            variant="ghost"
                            className="justify-between h-auto py-2"
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
    </div>
  );
};

export default BiblePage;
