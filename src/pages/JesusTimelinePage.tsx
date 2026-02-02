import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Sprout, Sun, Leaf, Snowflake, Calendar, MapPin, Book, AlertCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

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
}

const seasonInfo = {
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

const JesusTimelinePage = () => {
  const [selectedSeason, setSelectedSeason] = useState<string>('春');
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [showPreface, setShowPreface] = useState(true);

  const { data: events = [], isLoading, isError } = useQuery<JesusEvent[]>({
    queryKey: ['/api/jesus/timeline', selectedSeason],
    queryFn: async () => {
      const res = await fetch(`/api/jesus/timeline?season=${encodeURIComponent(selectedSeason)}`);
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
  });

  const currentSeason = seasonInfo[selectedSeason as keyof typeof seasonInfo];

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

  return (
    <div className="min-h-screen bg-background">
      <Header title="耶穌四季" subtitle="生平時間軸" />
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/learn" className="gap-2" data-testid="link-back-learn">
              <ArrowLeft className="w-4 h-4" />
              返回學習
            </Link>
          </Button>

          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-muted-foreground">探索耶穌的一生，從降生到復活</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(seasonInfo).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => { setSelectedSeason(key); setExpandedEvents(new Set()); setShowPreface(true); }}
                    className={`p-3 rounded-lg transition-all ${
                      selectedSeason === key 
                        ? `${info.color} text-white` 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    data-testid={`button-season-${key}`}
                  >
                    <info.icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{info.label.split(' - ')[0]}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {showPreface && (
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-1 self-stretch rounded-full ${currentSeason.color}`} />
                    <Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${currentSeason.textColor}`} />
                    <div>
                      <h4 className="font-semibold mb-2">前言</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {currentSeason.preface}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => setShowPreface(false)}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showPreface && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={() => setShowPreface(true)}
            >
              <Info className="w-4 h-4 mr-1" />
              顯示前言
            </Button>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <currentSeason.icon className={`w-5 h-5 ${currentSeason.textColor}`} />
                {currentSeason.label}
                <span className="text-sm font-normal text-muted-foreground ml-auto">
                  共 {events.length} 個事件
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : isError ? (
                <div className="text-center py-8 text-destructive flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  <span>載入時間軸事件時發生錯誤</span>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暫無事件</div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="relative">
                    <div className={`absolute left-4 top-0 bottom-0 w-0.5 ${currentSeason.color}`} />
                    <div className="space-y-4">
                      {events.map((event, index) => (
                        <div key={event.id} className="relative pl-10">
                          <div className={`absolute left-2 top-2 w-5 h-5 rounded-full ${currentSeason.color} flex items-center justify-center text-white text-xs font-bold`}>
                            {index + 1}
                          </div>
                          <Card 
                            className="bg-muted/30 cursor-pointer hover-elevate"
                            onClick={() => toggleEventExpand(event.id)}
                          >
                            <CardContent className="py-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-foreground mb-1">
                                    {event.eventName}
                                  </h4>
                                  {event.theologicalTheme && (
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {event.theologicalTheme}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    {event.location && (
                                      <Badge variant="secondary" className="text-xs">
                                        <MapPin className="w-3 h-3 mr-1" />
                                        {event.location}
                                      </Badge>
                                    )}
                                    {event.scriptureOverview && (
                                      <Badge variant="outline" className="text-xs">
                                        <Book className="w-3 h-3 mr-1" />
                                        {event.scriptureOverview}
                                      </Badge>
                                    )}
                                    {event.approximateDate && (
                                      <Badge variant="outline" className="text-xs">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {event.approximateDate}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
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
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default JesusTimelinePage;
