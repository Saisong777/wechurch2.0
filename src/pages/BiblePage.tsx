import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Search, Book, ChevronRight, X, AlertCircle, Copy, Share2, Bookmark, BookmarkCheck, Image, Download, Upload, Check } from 'lucide-react';
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

const BACKGROUND_PRESETS = [
  { id: 'gradient1', name: '晨曦', style: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient2', name: '夕陽', style: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'gradient3', name: '大海', style: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'gradient4', name: '森林', style: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'gradient5', name: '天空', style: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { id: 'gradient6', name: '星夜', style: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)' },
];

const TEXT_POSITIONS = [
  { id: 'top-left', name: '左上', align: 'items-start justify-start', textAlign: 'text-left' },
  { id: 'top-center', name: '上', align: 'items-start justify-center', textAlign: 'text-center' },
  { id: 'top-right', name: '右上', align: 'items-start justify-end', textAlign: 'text-right' },
  { id: 'center-left', name: '左', align: 'items-center justify-start', textAlign: 'text-left' },
  { id: 'center', name: '中', align: 'items-center justify-center', textAlign: 'text-center' },
  { id: 'center-right', name: '右', align: 'items-center justify-end', textAlign: 'text-right' },
  { id: 'bottom-left', name: '左下', align: 'items-end justify-start', textAlign: 'text-left' },
  { id: 'bottom-center', name: '下', align: 'items-end justify-center', textAlign: 'text-center' },
  { id: 'bottom-right', name: '右下', align: 'items-end justify-end', textAlign: 'text-right' },
];

const ASPECT_RATIOS = [
  { id: 'square', name: '正方形', ratio: 'aspect-square', width: 400, height: 400 },
  { id: 'portrait', name: '直式 3:4', ratio: 'aspect-[3/4]', width: 400, height: 533 },
  { id: 'story', name: '限時動態 9:16', ratio: 'aspect-[9/16]', width: 360, height: 640 },
  { id: 'landscape', name: '橫式 4:3', ratio: 'aspect-[4/3]', width: 480, height: 360 },
  { id: 'wide', name: '寬螢幕 16:9', ratio: 'aspect-[16/9]', width: 480, height: 270 },
];

const FONT_SIZES = [
  { id: 'sm', name: '小', verse: 'text-base', ref: 'text-sm', message: 'text-sm' },
  { id: 'md', name: '中', verse: 'text-lg', ref: 'text-base', message: 'text-base' },
  { id: 'lg', name: '大', verse: 'text-xl', ref: 'text-lg', message: 'text-lg' },
  { id: 'xl', name: '特大', verse: 'text-2xl', ref: 'text-xl', message: 'text-xl' },
];

const BiblePage = () => {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVerseNums, setSelectedVerseNums] = useState<Set<number>>(new Set());
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardBackground, setCardBackground] = useState(BACKGROUND_PRESETS[0].style);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [personalMessage, setPersonalMessage] = useState('');
  const [textPosition, setTextPosition] = useState(TEXT_POSITIONS[4]);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[1]);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      const link = document.createElement('a');
      link.download = `經文卡-${selectedBook}${selectedChapter}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: "下載成功",
        description: "圖卡已儲存",
      });
    } catch (err) {
      toast({
        title: "下載失敗",
        description: "請稍後再試",
        variant: "destructive",
      });
    }
  };

  const shareCard = async () => {
    if (!cardRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const file = new File([blob], `經文卡-${selectedBook}${selectedChapter}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${selectedBook} ${selectedChapter}`,
            });
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              await downloadCard();
            }
          }
        } else {
          await downloadCard();
        }
      }, 'image/png');
    } catch (err) {
      toast({
        title: "分享失敗",
        variant: "destructive",
      });
    }
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

  const getCardVerseText = () => {
    const selectedVersesList = getSelectedVerses();
    const verseNums = selectedVersesList.map(v => v.verse);
    const rangeText = formatVerseRange(verseNums);
    const header = `${selectedBook} ${selectedChapter}:${rangeText}`;
    const text = selectedVersesList.map(v => v.text).join(' ');
    return { header, text };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="聖經閱讀" subtitle="和合本" />
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
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
              <CardContent className="py-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-lg">搜尋結果: "{searchQuery}"</h3>
                  <Button variant="ghost" size="sm" onClick={clearSearch}>
                    返回書卷列表
                  </Button>
                </div>
                {searchLoading ? (
                  <div className="text-center py-12 text-muted-foreground">搜尋中...</div>
                ) : searchError ? (
                  <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>搜尋時發生錯誤</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">找不到相關經文</div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4 pr-4">
                      {searchResults.map((v) => (
                        <div key={v.id} className="p-4 rounded-lg bg-muted/50 group">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-base text-primary font-medium">
                              {v.bookName} {v.chapter}:{v.verse}
                            </p>
                            <VerseActions verse={v} />
                          </div>
                          <p className="text-lg leading-relaxed">{v.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ) : selectedBook && selectedChapter ? (
            <Card>
              <CardContent className="py-6">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                  <h3 className="font-semibold text-xl">{selectedBook} 第 {selectedChapter} 章</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedVerseNums.size > 0 && (
                      <>
                        <Button variant="outline" size="sm" onClick={copySelectedVerses} data-testid="button-copy-selected">
                          <Copy className="w-4 h-4 mr-1" />
                          複製 ({selectedVerseNums.size})
                        </Button>
                        <Button variant="outline" size="sm" onClick={shareSelectedVerses} data-testid="button-share-selected">
                          <Share2 className="w-4 h-4 mr-1" />
                          分享
                        </Button>
                        <Button variant="default" size="sm" onClick={openCardCreator} data-testid="button-create-card">
                          <Image className="w-4 h-4 mr-1" />
                          製作圖卡
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedVerseNums(new Set())} data-testid="button-clear-selection">
                          <X className="w-4 h-4 mr-1" />
                          取消選取
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedChapter(null); setSelectedVerseNums(new Set()); }}>
                      返回章節
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">
                  點擊經文可選取，選取後可複製、分享或製作圖卡
                </p>
                
                {versesLoading ? (
                  <div className="text-center py-12 text-muted-foreground">載入中...</div>
                ) : versesError ? (
                  <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>載入經文時發生錯誤</span>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-2 pr-4">
                      {verses.map((v) => (
                        <div 
                          key={v.verse} 
                          className={`flex gap-4 p-3 rounded-lg cursor-pointer group transition-colors ${
                            selectedVerseNums.has(v.verse) 
                              ? 'bg-primary/10 ring-2 ring-primary/30' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleVerseSelection(v.verse)}
                          data-testid={`verse-${v.chapter}-${v.verse}`}
                        >
                          <div className="flex items-start gap-2">
                            {selectedVerseNums.has(v.verse) && (
                              <Check className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                            )}
                            <span className="text-primary font-bold text-lg min-w-[2rem] text-right">{v.verse}</span>
                          </div>
                          <span className="text-lg leading-relaxed flex-1">{v.text}</span>
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
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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

      <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>製作經文圖卡</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">個人寄語</p>
                <textarea
                  className="w-full p-3 rounded-lg border bg-background text-sm resize-none"
                  rows={2}
                  placeholder="親愛的，我今天讀經讀到這個，跟你分享，願主平安..."
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  data-testid="input-personal-message"
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">選擇背景</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`h-12 rounded-lg transition-all ${
                        cardBackground === preset.style && !customImage
                          ? 'ring-2 ring-primary ring-offset-2'
                          : ''
                      }`}
                      style={{ background: preset.style }}
                      onClick={() => { setCardBackground(preset.style); setCustomImage(null); }}
                      data-testid={`bg-preset-${preset.id}`}
                    >
                      <span className="text-white text-xs font-medium drop-shadow-lg">{preset.name}</span>
                    </button>
                  ))}
                </div>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-image"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  上傳圖片
                </Button>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">圖卡比例</p>
                <div className="flex flex-wrap gap-1">
                  {ASPECT_RATIOS.map((ratio) => (
                    <Button
                      key={ratio.id}
                      variant={aspectRatio.id === ratio.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAspectRatio(ratio)}
                      data-testid={`ratio-${ratio.id}`}
                    >
                      {ratio.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">字體大小</p>
                <div className="flex gap-1">
                  {FONT_SIZES.map((size) => (
                    <Button
                      key={size.id}
                      variant={fontSize.id === size.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFontSize(size)}
                      data-testid={`font-${size.id}`}
                    >
                      {size.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">文字位置</p>
                <div className="grid grid-cols-3 gap-1">
                  {TEXT_POSITIONS.map((pos) => (
                    <Button
                      key={pos.id}
                      variant={textPosition.id === pos.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextPosition(pos)}
                      data-testid={`pos-${pos.id}`}
                    >
                      {pos.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div
                ref={cardRef}
                className={`relative ${aspectRatio.ratio} rounded-lg overflow-hidden flex p-6`}
                style={{
                  background: customImage ? `url(${customImage}) center/cover` : cardBackground,
                  maxHeight: '400px',
                }}
              >
                <div className="absolute inset-0 bg-black/30" />
                <div className={`relative text-white z-10 flex flex-col w-full ${textPosition.align}`}>
                  <div className={`max-w-full ${textPosition.textAlign}`}>
                    {personalMessage && (
                      <p className={`${fontSize.message} leading-relaxed mb-3 drop-shadow-lg opacity-90 italic`}>
                        {personalMessage}
                      </p>
                    )}
                    <p className={`${fontSize.verse} leading-relaxed mb-3 drop-shadow-lg font-medium`}>
                      {getCardVerseText().text}
                    </p>
                    <p className={`${fontSize.ref} opacity-90 drop-shadow-lg`}>
                      — {getCardVerseText().header}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={downloadCard} data-testid="button-download-card">
                  <Download className="w-4 h-4 mr-2" />
                  下載圖卡
                </Button>
                <Button className="flex-1" variant="outline" onClick={shareCard} data-testid="button-share-card">
                  <Share2 className="w-4 h-4 mr-2" />
                  分享圖卡
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BiblePage;
