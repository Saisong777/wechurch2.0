import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const seasonInfo = {
  '後設': {
    label: '後設資料',
    icon: FileText,
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    preface: '後設資料包含福音書的序言、家譜等背景資料，幫助讀者理解耶穌生平的歷史和神學背景。'
  },
  '春': { 
    label: '春季 - 開始', 
    icon: Sprout, 
    color: 'bg-green-500', 
    textColor: 'text-green-600',
    preface: '春季代表耶穌生命的開始，包括祂的誕生、童年，以及開始公開事工的預備時期。這個階段揭示了神救贖計劃的啟動，透過施洗約翰的預備，為彌賽亞的到來鋪路。'
  },
  '夏': { 
    label: '夏季 - 事工', 
    icon: Sun, 
    color: 'bg-amber-500', 
    textColor: 'text-amber-600',
    preface: '夏季是耶穌事工的高峰期，祂走遍加利利各城各鄉，教導群眾、醫治病人、行各樣神蹟。這個階段展現了神國度的福音，以及耶穌作為道路、真理、生命的身份。'
  },
  '秋': { 
    label: '秋季 - 衝突', 
    icon: Leaf, 
    color: 'bg-orange-500', 
    textColor: 'text-orange-600',
    preface: '秋季呈現了耶穌與宗教領袖之間日益加劇的衝突。隨著祂的教導越發挑戰當時的宗教體制，反對的聲浪也越來越大，為最終的受難埋下伏筆。'
  },
  '冬': { 
    label: '冬季 - 受難', 
    icon: Snowflake, 
    color: 'bg-blue-500', 
    textColor: 'text-blue-600',
    preface: '冬季是救贖計劃的高潮，記載耶穌的受難、釘十字架、復活與升天。這個階段彰顯了神對人類最深的愛，以及基督作為贖罪羔羊的完全獻祭。'
  },
};

const seasonOrder = ['後設', '春', '夏', '秋', '冬'];

const JesusTimelinePage = () => {
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
    const gospels: { name: string; ref: string }[] = [];
    if (event.scriptureMt) gospels.push({ name: '太', ref: event.scriptureMt });
    if (event.scriptureMk) gospels.push({ name: '可', ref: event.scriptureMk });
    if (event.scriptureLk) gospels.push({ name: '路', ref: event.scriptureLk });
    if (event.scriptureJn) gospels.push({ name: '約', ref: event.scriptureJn });
    return gospels;
  };

  // Group events by season
  const groupedEvents = seasonOrder.reduce((acc, season) => {
    acc[season] = allEvents.filter(e => e.season === season);
    return acc;
  }, {} as Record<string, JesusEvent[]>);

  return (
    <div className="min-h-screen bg-background">
      <Header title="耶穌四季" subtitle="生平時間軸" />
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Link to="/learn">
              <Button variant="ghost" size="sm" data-testid="link-back-learn">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回學習
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowPrefaceModal(true)}
              data-testid="button-preface"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              前後之言
            </Button>
          </div>

          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-muted-foreground">探索耶穌的一生，從降生到復活，共 {allEvents.length} 個事件</span>
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
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-8 pr-4">
                {seasonOrder.map(season => {
                  const events = groupedEvents[season];
                  if (!events || events.length === 0) return null;
                  
                  const info = getSeasonInfo(season);
                  const SeasonIcon = info.icon;
                  
                  return (
                    <div key={season}>
                      <div className="flex flex-wrap items-center gap-3 mb-4 sticky top-0 bg-background py-2 z-10" data-testid={`season-header-${season}`}>
                        <div className={`w-8 h-8 rounded-full ${info.color} flex items-center justify-center`}>
                          <SeasonIcon className="w-4 h-4 text-white" />
                        </div>
                        <h3 className={`font-semibold text-lg ${info.textColor}`} data-testid={`season-title-${season}`}>{info.label}</h3>
                        <Badge variant="secondary" className="ml-auto" data-testid={`season-count-${season}`}>
                          {events.length} 個事件
                        </Badge>
                      </div>
                      
                      <div className="relative">
                        <div className={`absolute left-4 top-0 bottom-0 w-0.5 ${info.color}`} />
                        <div className="space-y-3">
                          {events.map((event, index) => {
                            const gospels = getGospelScriptures(event);
                            
                            return (
                              <div key={event.id} className="relative pl-10">
                                <div className={`absolute left-2 top-3 w-5 h-5 rounded-full ${info.color} flex items-center justify-center text-white text-xs font-bold`}>
                                  {index + 1}
                                </div>
                                <Card 
                                  className="bg-muted/30 cursor-pointer hover-elevate"
                                  onClick={() => toggleEventExpand(event.id)}
                                  data-testid={`event-${event.id}`}
                                >
                                  <CardContent className="py-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-foreground mb-1" data-testid={`event-title-${event.id}`}>
                                          {event.eventName}
                                        </h4>
                                        {event.theologicalTheme && (
                                          <p className="text-sm text-muted-foreground mb-2">
                                            {event.theologicalTheme}
                                          </p>
                                        )}
                                        
                                        {/* Gospel scripture references */}
                                        {gospels.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 mb-2">
                                            {gospels.map((g, i) => (
                                              <Badge 
                                                key={i}
                                                variant="outline"
                                                className="text-xs"
                                                data-testid={`gospel-${event.id}-${g.name}`}
                                              >
                                                <Book className="w-3 h-3 mr-1" />
                                                {g.name} {g.ref.replace(/^(Mt|Mk|Lk|Jn)\s*/i, '')}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                        
                                        <div className="flex flex-wrap gap-2">
                                          {event.location && (
                                            <Badge variant="secondary" className="text-xs" data-testid={`location-${event.id}`}>
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
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" data-testid={`button-expand-${event.id}`}>
                                        {expandedEvents.has(event.id) ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </div>
                                    
                                    {expandedEvents.has(event.id) && (
                                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                                        {event.jesusCharacter && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-muted-foreground mb-1">耶穌的品格</h5>
                                            <p className="text-sm">{event.jesusCharacter}</p>
                                          </div>
                                        )}
                                        {event.focus && (
                                          <div>
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
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </main>

      {/* Preface Modal */}
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
                  <div className="flex items-center gap-2">
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
