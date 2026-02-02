import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Search, Book, ChevronRight, X, AlertCircle } from 'lucide-react';

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

const BiblePage = () => {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { data: books = [], isError: booksError } = useQuery<BibleBook[]>({
    queryKey: ['/api/bible/books'],
  });

  const { data: chapters = [], isError: chaptersError } = useQuery<BibleChapter[]>({
    queryKey: ['/api/bible/chapters', selectedBook],
    enabled: !!selectedBook,
  });

  const { data: verses = [], isLoading: versesLoading, isError: versesError } = useQuery<BibleVerse[]>({
    queryKey: ['/api/bible/verses', selectedBook, selectedChapter],
    enabled: !!selectedBook && !!selectedChapter,
  });

  const { data: searchResults = [], isLoading: searchLoading, isError: searchError } = useQuery<BibleVerse[]>({
    queryKey: ['/api/bible/search', { q: searchQuery }],
    enabled: isSearching && searchQuery.length >= 2,
  });

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

  const oldTestamentBooks = books.filter(b => b.bookNumber <= 39);
  const newTestamentBooks = books.filter(b => b.bookNumber > 39);

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
                        <div key={v.id} className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-primary font-medium mb-1">
                            {v.bookName} {v.chapter}:{v.verse}
                          </p>
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
                  <Button variant="ghost" size="sm" onClick={() => setSelectedChapter(null)}>
                    返回章節
                  </Button>
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
                    <div className="space-y-2">
                      {verses.map((v) => (
                        <div key={v.id} className="flex gap-2" data-testid={`verse-${v.chapter}-${v.verse}`}>
                          <span className="text-primary font-medium min-w-[2rem] text-right">{v.verse}</span>
                          <span className="text-foreground">{v.text}</span>
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
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BiblePage;
