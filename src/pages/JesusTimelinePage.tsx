import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Sprout, Sun, Leaf, Snowflake, Calendar, MapPin, Book } from 'lucide-react';

interface JesusEvent {
  id: number;
  season: string;
  eventNumber: number;
  eventTitle: string;
  eventDescription: string | null;
  location: string | null;
  scriptureReference: string | null;
  sortOrder: number;
}

const seasonInfo = {
  spring: { label: '春季 - 開始', icon: Sprout, color: 'bg-green-500', textColor: 'text-green-600' },
  summer: { label: '夏季 - 事工', icon: Sun, color: 'bg-amber-500', textColor: 'text-amber-600' },
  autumn: { label: '秋季 - 衝突', icon: Leaf, color: 'bg-orange-500', textColor: 'text-orange-600' },
  winter: { label: '冬季 - 受難', icon: Snowflake, color: 'bg-blue-500', textColor: 'text-blue-600' },
};

const JesusTimelinePage = () => {
  const [selectedSeason, setSelectedSeason] = useState<string>('spring');

  const { data: events = [], isLoading } = useQuery<JesusEvent[]>({
    queryKey: ['/api/jesus/timeline', { season: selectedSeason }],
  });

  const currentSeason = seasonInfo[selectedSeason as keyof typeof seasonInfo];

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
                    onClick={() => setSelectedSeason(key)}
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <currentSeason.icon className={`w-5 h-5 ${currentSeason.textColor}`} />
                {currentSeason.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
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
                            {event.eventNumber}
                          </div>
                          <Card className="bg-muted/30">
                            <CardContent className="py-3">
                              <h4 className="font-semibold text-foreground mb-1">
                                {event.eventTitle}
                              </h4>
                              {event.eventDescription && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {event.eventDescription}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {event.location && (
                                  <Badge variant="secondary" className="text-xs">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {event.location}
                                  </Badge>
                                )}
                                {event.scriptureReference && (
                                  <Badge variant="outline" className="text-xs">
                                    <Book className="w-3 h-3 mr-1" />
                                    {event.scriptureReference}
                                  </Badge>
                                )}
                              </div>
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
