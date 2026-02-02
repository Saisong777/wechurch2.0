import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Sprout, Sun, Leaf, Snowflake, Calendar, MapPin, Book, AlertCircle, ChevronDown, ChevronUp, BookOpen, FileText } from 'lucide-react';
import { ScriptureViewer } from '@/components/scripture/ScriptureViewer';

interface JesusEvent {
  id: number;
  season: string;
  displayOrder: number;
  eventName: string;
  eventCategory: string | null;
  theologicalTheme: string | null;
  location: string | null;
  scriptureOverview: string | null;
  approximateDate: string | null;
  jesusCharacter: string | null;
  focus: string | null;
  gospelCenter: string | null;
  scriptureMt: string | null;
  scriptureMk: string | null;
  scriptureLk: string | null;
  scriptureJn: string | null;
}

interface BibleVerse {
  id: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ScriptureData {
  bookName: string;
  chapter: number;
  verses: BibleVerse[];
}

const seasonInfo = {
  '後設': {
    label: '前後言',
    shortLabel: '前後言',
    icon: FileText,
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    preface: '前後言包含福音書的序言、家譜等背景資料，幫助讀者理解耶穌生平的歷史和神學背景。'
  },
  '春': { 
    label: '春季 - 開始', 
    shortLabel: '春',
    icon: Sprout, 
    color: 'bg-green-500', 
    textColor: 'text-green-600',
    preface: '春季代表耶穌生命的開始，包括祂的誕生、童年，以及開始公開事工的預備時期。這個階段揭示了神救贖計劃的啟動，透過施洗約翰的預備，為彌賽亞的到來鋪路。'
  },
  '夏': { 
    label: '夏季 - 事工', 
    shortLabel: '夏',
    icon: Sun, 
    color: 'bg-amber-500', 
    textColor: 'text-amber-600',
    preface: '夏季是耶穌事工的高峰期，祂走遍加利利各城各鄉，教導群眾、醫治病人、行各樣神蹟。這個階段展現了神國度的福音，以及耶穌作為道路、真理、生命的身份。'
  },
  '秋': { 
    label: '秋季 - 衝突', 
    shortLabel: '秋',
    icon: Leaf, 
    color: 'bg-orange-500', 
    textColor: 'text-orange-600',
    preface: '秋季呈現了耶穌與宗教領袖之間日益加劇的衝突。隨著祂的教導越發挑戰當時的宗教體制，反對的聲浪也越來越大，為最終的受難埋下伏筆。'
  },
  '冬': { 
    label: '冬季 - 受難', 
    shortLabel: '冬',
    icon: Snowflake, 
    color: 'bg-blue-500', 
    textColor: 'text-blue-600',
    preface: '冬季是救贖計劃的高潮，記載耶穌的受難、釘十字架、復活與升天。這個階段彰顯了神對人類最深的愛，以及基督作為贖罪羔羊的完全獻祭。'
  },
};

const seasonOrder = ['後設', '春', '夏', '秋', '冬'];

const gospelNames: Record<string, string> = {
  'scriptureMt': '馬太福音',
  'scriptureMk': '馬可福音',
  'scriptureLk': '路加福音',
  'scriptureJn': '約翰福音',
};

const ScriptureDisplay = ({ reference, gospelName }: { reference: string; gospelName: string }) => {
  const { data, isLoading } = useQuery<ScriptureData>({
    queryKey: ['/api/bible/by-reference', reference],
    queryFn: async () => {
      const res = await fetch(`/api/bible/by-reference?ref=${encodeURIComponent(reference)}`);
      if (!res.ok) throw new Error('Failed to fetch verses');
      return res.json();
    },
    enabled: !!reference,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-2">載入經文中...</div>;
  }

  if (!data || !data.verses || data.verses.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        {gospelName} {reference.replace(/^(Mt|Mk|Lk|Jn)\s*/i, '')}
      </div>
    );
  }

  const formattedVerses = data.verses.map(v => ({
    bookName: gospelName,
    chapter: v.chapter,
    verse: v.verse,
    text: v.text,
  }));

  return (
    <div className="mb-2">
      <h6 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
        <Book className="w-4 h-4" />
        {gospelName} {data.chapter} 章
      </h6>
      <ScriptureViewer verses={formattedVerses} />
    </div>
  );
};

const JesusTimelinePage = () => {
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [collapsedEvents, setCollapsedEvents] = useState<Set<number>>(new Set());

  const { data: allEvents = [], isLoading, isError } = useQuery<JesusEvent[]>({
    queryKey: ['/api/jesus/timeline'],
    queryFn: async () => {
      const res = await fetch('/api/jesus/timeline');
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
  });

  const toggleEventCollapse = (eventId: number) => {
    setCollapsedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const getSeasonInfo = (season: string) => {
    return seasonInfo[season as keyof typeof seasonInfo] || seasonInfo['春'];
  };

  const getGospelScriptures = (event: JesusEvent) => {
    const gospels: { key: string; name: string; ref: string }[] = [];
    if (event.scriptureMt) gospels.push({ key: 'scriptureMt', name: '馬太福音', ref: event.scriptureMt });
    if (event.scriptureMk) gospels.push({ key: 'scriptureMk', name: '馬可福音', ref: event.scriptureMk });
    if (event.scriptureLk) gospels.push({ key: 'scriptureLk', name: '路加福音', ref: event.scriptureLk });
    if (event.scriptureJn) gospels.push({ key: 'scriptureJn', name: '約翰福音', ref: event.scriptureJn });
    return gospels;
  };

  const handleSeasonClick = (season: string) => {
    setSelectedSeason(selectedSeason === season ? null : season);
  };

  // Filter events by selected season
  const filteredEvents = selectedSeason 
    ? allEvents.filter(e => e.season === selectedSeason)
    : allEvents;

  return (
    <div className="min-h-screen bg-background">
      <Header title="耶穌四季" subtitle="生平時間軸" />
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Link to="/learn">
              <Button variant="ghost" size="sm" data-testid="link-back-learn">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回學習
              </Button>
            </Link>
          </div>

          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-muted-foreground">探索耶穌的一生，共 {allEvents.length} 個事件</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {seasonOrder.map((season) => {
                  const info = getSeasonInfo(season);
                  const SeasonIcon = info.icon;
                  const isSelected = selectedSeason === season;
                  
                  return (
                    <Button
                      key={season}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSeasonClick(season)}
                      className="gap-1"
                      data-testid={`button-season-${season}`}
                    >
                      <SeasonIcon className="w-4 h-4" />
                      {info.shortLabel}
                    </Button>
                  );
                })}
                {selectedSeason && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSeason(null)}
                    data-testid="button-clear-filter"
                  >
                    顯示全部
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">載入中...</div>
          ) : isError ? (
            <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              <span>載入時間軸事件時發生錯誤</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">沒有找到事件</div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-3 pr-4">
                {filteredEvents.map((event, index) => {
                  const info = getSeasonInfo(event.season);
                  const SeasonIcon = info.icon;
                  const gospels = getGospelScriptures(event);
                  const isExpanded = !collapsedEvents.has(event.id);
                  
                  return (
                    <Card 
                      key={event.id}
                      className="bg-muted/30 cursor-pointer hover-elevate"
                      onClick={() => toggleEventCollapse(event.id)}
                      data-testid={`event-${event.id}`}
                    >
                      <CardContent className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-full ${info.color} flex items-center justify-center flex-shrink-0`}>
                              <SeasonIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs" data-testid={`season-badge-${event.id}`}>
                                  {info.shortLabel}
                                </Badge>
                                <span className="text-xs text-muted-foreground">#{event.displayOrder}</span>
                              </div>
                              <h4 className="font-semibold text-foreground mb-1" data-testid={`event-title-${event.id}`}>
                                {event.eventName}
                              </h4>
                              {event.theologicalTheme && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {event.theologicalTheme}
                                </p>
                              )}
                              
                              <div className="flex flex-wrap gap-2">
                                {event.location && (
                                  <Badge variant="outline" className="text-xs" data-testid={`location-${event.id}`}>
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {event.location}
                                  </Badge>
                                )}
                                {event.approximateDate && (
                                  <Badge variant="outline" className="text-xs" data-testid={`date-${event.id}`}>
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {event.approximateDate}
                                  </Badge>
                                )}
                                {gospels.length > 0 && gospels.map((g) => (
                                  <Badge key={g.key} variant="outline" className="text-xs" data-testid={`scripture-${event.id}-${g.key}`}>
                                    <Book className="w-3 h-3 mr-1" />
                                    {g.name.replace('福音', '')}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="flex-shrink-0" data-testid={`button-expand-${event.id}`}>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                            {gospels.length > 0 && (
                              <div className={`grid gap-3 mb-4 ${gospels.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                {gospels.map((g, idx) => {
                                  const bgColors = ['bg-blue-50 dark:bg-blue-950/30', 'bg-green-50 dark:bg-green-950/30', 'bg-amber-50 dark:bg-amber-950/30', 'bg-purple-50 dark:bg-purple-950/30'];
                                  return (
                                    <div key={g.key} className={`rounded-lg p-3 ${bgColors[idx % bgColors.length]}`}>
                                      <ScriptureDisplay reference={g.ref} gospelName={g.name} />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </main>

    </div>
  );
};

export default JesusTimelinePage;
