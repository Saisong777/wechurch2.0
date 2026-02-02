import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Sprout, Sun, Leaf, Snowflake, Calendar, MapPin, Book, AlertCircle, ChevronDown, ChevronUp, BookOpen, FileText } from 'lucide-react';

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
    label: '後設資料',
    shortLabel: '後設',
    icon: FileText,
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    preface: '後設資料包含福音書的序言、家譜等背景資料，幫助讀者理解耶穌生平的歷史和神學背景。'
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

  return (
    <div className="mb-4">
      <h6 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
        <Book className="w-4 h-4" />
        {gospelName} {data.chapter} 章
      </h6>
      <div className="space-y-1 pl-2 border-l-2 border-primary/20">
        {data.verses.map((v) => (
          <p key={v.id} className="text-sm leading-relaxed" data-testid={`verse-${v.chapter}-${v.verse}`}>
            <span className="text-primary font-medium mr-2">{v.verse}</span>
            {v.text}
          </p>
        ))}
      </div>
    </div>
  );
};

const JesusTimelinePage = () => {
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [showPrefaceModal, setShowPrefaceModal] = useState(false);

  const { data: allEvents = [], isLoading, isError } = useQuery<JesusEvent[]>({
    queryKey: ['/api/jesus/timeline'],
    queryFn: async () => {
      const res = await fetch('/api/jesus/timeline');
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
  });

  const toggleEventExpand = (eventId: number) => {
    setExpandedEvents(prev => {
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPrefaceModal(true)}
                  data-testid="button-preface-modal"
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  前後之言
                </Button>
                <div className="w-px h-6 bg-border" />
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
                  const isExpanded = expandedEvents.has(event.id);
                  
                  return (
                    <Card 
                      key={event.id}
                      className="bg-muted/30 cursor-pointer hover-elevate"
                      onClick={() => toggleEventExpand(event.id)}
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
                                {gospels.length > 0 && (
                                  <Badge variant="outline" className="text-xs" data-testid={`scripture-count-${event.id}`}>
                                    <Book className="w-3 h-3 mr-1" />
                                    {gospels.length} 福音書
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" data-testid={`button-expand-${event.id}`}>
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
                              <div className="mb-4">
                                <h5 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <BookOpen className="w-4 h-4" />
                                  經文內容
                                </h5>
                                <div className="space-y-4">
                                  {gospels.map((g) => (
                                    <ScriptureDisplay key={g.key} reference={g.ref} gospelName={g.name} />
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {event.jesusCharacter && (
                              <div className="mb-3">
                                <h5 className="text-xs font-semibold text-muted-foreground mb-1">耶穌的品格</h5>
                                <p className="text-sm">{event.jesusCharacter}</p>
                              </div>
                            )}
                            {event.focus && (
                              <div className="mb-3">
                                <h5 className="text-xs font-semibold text-muted-foreground mb-1">焦點</h5>
                                <p className="text-sm">{event.focus}</p>
                              </div>
                            )}
                            {event.gospelCenter && (
                              <div>
                                <h5 className="text-xs font-semibold text-muted-foreground mb-1">福音中心</h5>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{event.gospelCenter}</p>
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

      <Dialog open={showPrefaceModal} onOpenChange={setShowPrefaceModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              前後之言
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {seasonOrder.map(season => {
              const info = getSeasonInfo(season);
              const SeasonIcon = info.icon;
              
              return (
                <div key={season} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${info.color} flex items-center justify-center`}>
                      <SeasonIcon className="w-3 h-3 text-white" />
                    </div>
                    <h4 className={`font-semibold ${info.textColor}`}>{info.label}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                    {info.preface}
                  </p>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JesusTimelinePage;
