import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Sprout, Sun, Leaf, Snowflake, Calendar, MapPin, Book, AlertCircle, ChevronDown, ChevronUp, BookOpen, FileText, Quote } from 'lucide-react';
import { ScriptureViewer } from '@/components/scripture/ScriptureViewer';
import { FeatureGate } from '@/components/ui/feature-gate';

interface JesusEvent {
  id: number;
  displayOrder: number;
  eventId: string | null;
  dateMaybe: string | null;
  dateStage: string | null;
  stageShort: string | null;
  season: string;
  approximateDate: string | null;
  location: string | null;
  eventName: string;
  eventCategory: string | null;
  theologicalTheme: string | null;
  jesusCharacter: string | null;
  focus: string | null;
  gospelCenter: string | null;
  scriptureOverview: string | null;
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

const seasonConfig: Record<string, {
  english: string;
  subtitle: string;
  icon: typeof FileText;
  bgColor: string;
  textColor: string;
  badgeBg: string;
  borderColor: string;
  headerBg: string;
}> = {
  '後設': {
    english: 'Postlude',
    subtitle: '前後言',
    icon: FileText,
    bgColor: 'bg-gray-100 dark:bg-gray-800/40',
    textColor: 'text-gray-600 dark:text-gray-400',
    badgeBg: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-600',
    headerBg: 'bg-gray-50 dark:bg-gray-900/50',
  },
  '春': {
    english: 'Spring',
    subtitle: '預備期',
    icon: Sprout,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-600 dark:text-green-400',
    badgeBg: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-700',
    headerBg: 'bg-green-50 dark:bg-green-950/40',
  },
  '夏': {
    english: 'Summer',
    subtitle: '事工高峰',
    icon: Sun,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-700',
    headerBg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  '秋': {
    english: 'Autumn',
    subtitle: '轉折衝突',
    icon: Leaf,
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-300 dark:border-orange-700',
    headerBg: 'bg-orange-50 dark:bg-orange-950/40',
  },
  '冬': {
    english: 'Winter',
    subtitle: '受難復活',
    icon: Snowflake,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
    headerBg: 'bg-blue-50 dark:bg-blue-950/40',
  },
};

const seasonOrder = ['後設', '春', '夏', '秋', '冬'];

const gospelKeys = [
  { field: 'scriptureMt' as const, abbr: '太', fullName: '馬太福音', label: 'Mt' },
  { field: 'scriptureMk' as const, abbr: '可', fullName: '馬可福音', label: 'Mk' },
  { field: 'scriptureLk' as const, abbr: '路', fullName: '路加福音', label: 'Lk' },
  { field: 'scriptureJn' as const, abbr: '約', fullName: '約翰福音', label: 'Jn' },
];

function extractQuote(gospelCenter: string | null): string | null {
  if (!gospelCenter) return null;
  const lastIdx = gospelCenter.lastIndexOf('】');
  if (lastIdx !== -1) {
    const quote = gospelCenter.substring(lastIdx + 1).trim();
    return quote || null;
  }
  return gospelCenter.trim() || null;
}

function getExclusiveGospel(event: JesusEvent): string | null {
  const present = gospelKeys.filter(g => event[g.field]);
  if (present.length === 1) return present[0].abbr;
  return null;
}

function getFirstScriptureRef(event: JesusEvent): { fullName: string; label: string; ref: string } | null {
  for (const g of gospelKeys) {
    if (event[g.field]) {
      return { fullName: g.fullName, label: g.label, ref: event[g.field]! };
    }
  }
  return null;
}

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

const EventCard = ({
  event,
  isExpanded,
  onToggle,
}: {
  event: JesusEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const cfg = seasonConfig[event.season] || seasonConfig['春'];
  const exclusive = getExclusiveGospel(event);
  const quote = extractQuote(event.gospelCenter);
  const firstRef = getFirstScriptureRef(event);

  const gospelScriptures = gospelKeys
    .filter(g => event[g.field])
    .map(g => ({ key: g.field, name: g.fullName, ref: event[g.field]! }));

  return (
    <Card
      className="hover-elevate"
      data-testid={`event-${event.id}`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-3 sm:gap-4">
          <div className="flex-shrink-0 pt-1">
            <span
              className={`text-2xl sm:text-3xl font-bold ${cfg.textColor} opacity-60 select-none`}
              data-testid={`event-number-${event.id}`}
            >
              {String(event.displayOrder).padStart(3, '0')}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Badge
                variant="secondary"
                className={`${cfg.badgeBg} border-0 text-[10px] sm:text-xs no-default-hover-elevate no-default-active-elevate`}
                data-testid={`season-badge-${event.id}`}
              >
                {cfg.english}
              </Badge>
              {exclusive && (
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs border-amber-400 dark:border-amber-600 text-amber-600 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate"
                  data-testid={`exclusive-${event.id}`}
                >
                  {exclusive} 獨家
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1.5">
              {event.location && (
                <span className="inline-flex items-center gap-1" data-testid={`location-${event.id}`}>
                  <MapPin className="w-3 h-3" />
                  {event.location}
                </span>
              )}
              {event.approximateDate && (
                <span className="inline-flex items-center gap-1" data-testid={`date-${event.id}`}>
                  <Calendar className="w-3 h-3" />
                  {event.approximateDate}
                </span>
              )}
            </div>

            <h4
              className="font-semibold text-base sm:text-lg text-foreground mb-2 leading-snug"
              data-testid={`event-title-${event.id}`}
            >
              {event.eventName}
            </h4>

            <div className="flex items-center gap-1 mb-2" data-testid={`gospel-indicators-${event.id}`}>
              {gospelKeys.map(g => {
                const hasScripture = !!event[g.field];
                return (
                  <span
                    key={g.field}
                    className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold transition-colors ${
                      hasScripture
                        ? 'bg-primary/10 dark:bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground/30'
                    }`}
                    data-testid={`gospel-${g.abbr}-${event.id}`}
                  >
                    {g.abbr}
                  </span>
                );
              })}
            </div>

            {event.theologicalTheme && (
              <div className="mb-2">
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs no-default-hover-elevate no-default-active-elevate"
                  data-testid={`theme-${event.id}`}
                >
                  {event.theologicalTheme}
                </Badge>
              </div>
            )}

            {quote && (
              <blockquote
                className="border-l-2 border-muted-foreground/20 pl-3 my-2 text-sm text-muted-foreground italic leading-relaxed line-clamp-3"
                data-testid={`quote-${event.id}`}
              >
                {quote}
              </blockquote>
            )}

            {firstRef && (
              <p className="text-xs text-muted-foreground mt-2" data-testid={`scripture-ref-${event.id}`}>
                {firstRef.fullName} {firstRef.ref.replace(/^(Mt|Mk|Lk|Jn)\s*/i, '')}
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="mt-2 gap-1 text-xs text-muted-foreground"
              data-testid={`button-expand-${event.id}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isExpanded ? '收起經文' : '展開經文'}
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>

            {isExpanded && gospelScriptures.length > 0 && (
              <div
                className="mt-3 pt-3 border-t border-border space-y-3"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {gospelScriptures.map((g, idx) => {
                  const bgColors = [
                    'bg-blue-50/60 dark:bg-blue-950/20',
                    'bg-green-50/60 dark:bg-green-950/20',
                    'bg-amber-50/60 dark:bg-amber-950/20',
                    'bg-purple-50/60 dark:bg-purple-950/20',
                  ];
                  return (
                    <div key={g.key} className={`rounded-lg p-3 ${bgColors[idx % bgColors.length]}`}>
                      <ScriptureDisplay reference={g.ref} gospelName={g.name} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const JesusTimelinePage = () => {
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedGospel, setSelectedGospel] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const { data: allEvents = [], isLoading, isError } = useQuery<JesusEvent[]>({
    queryKey: ['/api/jesus/timeline'],
    queryFn: async () => {
      const res = await fetch('/api/jesus/timeline');
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
  });

  const toggleExpand = (eventId: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const filteredEvents = useMemo(() => {
    let events = allEvents;
    if (selectedSeason) {
      events = events.filter(e => e.season === selectedSeason);
    }
    if (selectedGospel) {
      events = events.filter(e => {
        const g = gospelKeys.find(gk => gk.abbr === selectedGospel);
        return g ? !!e[g.field] : true;
      });
    }
    return events;
  }, [allEvents, selectedSeason, selectedGospel]);

  const groupedBySeason = useMemo(() => {
    const groups: { season: string; events: JesusEvent[] }[] = [];
    const map = new Map<string, JesusEvent[]>();
    for (const e of filteredEvents) {
      if (!map.has(e.season)) map.set(e.season, []);
      map.get(e.season)!.push(e);
    }
    for (const s of seasonOrder) {
      const evts = map.get(s);
      if (evts && evts.length > 0) {
        groups.push({ season: s, events: evts });
      }
    }
    return groups;
  }, [filteredEvents]);

  const handleSeasonClick = (season: string) => {
    setSelectedSeason(selectedSeason === season ? null : season);
  };

  const handleGospelClick = (abbr: string) => {
    setSelectedGospel(selectedGospel === abbr ? null : abbr);
  };

  return (
    <FeatureGate
      featureKeys={["we_learn", "jesus_timeline"]}
      title="耶穌四季功能維護中"
      description="耶穌四季功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background flex flex-col">
        <Header title="耶穌四季" subtitle="Gospel Harmony" variant="compact" />

        <main className="flex-1 container mx-auto px-2 sm:px-4 py-2 sm:py-4 flex flex-col">
          <div className="max-w-3xl mx-auto w-full flex flex-col flex-1">
            <Card className="mb-4">
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground" data-testid="text-event-count">
                    {filteredEvents.length} 個事件
                  </span>
                  {(selectedSeason || selectedGospel) && (
                    <span className="text-xs text-muted-foreground">
                      （共 {allEvents.length} 個）
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground mr-1">福音書</span>
                  {gospelKeys.map(g => {
                    const isSelected = selectedGospel === g.abbr;
                    return (
                      <Button
                        key={g.abbr}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleGospelClick(g.abbr)}
                        data-testid={`button-gospel-${g.abbr}`}
                      >
                        {g.abbr}
                      </Button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">季節</span>
                  {seasonOrder.map((season) => {
                    const cfg = seasonConfig[season];
                    const SeasonIcon = cfg.icon;
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
                        <SeasonIcon className="w-3.5 h-3.5" />
                        {cfg.english}
                      </Button>
                    );
                  })}
                  {(selectedSeason || selectedGospel) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSeason(null);
                        setSelectedGospel(null);
                      }}
                      data-testid="button-clear-filter"
                    >
                      清除篩選
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
              <div className="text-center py-12 text-muted-foreground text-sm">沒有找到事件</div>
            ) : (
              <ScrollArea className="flex-1 h-[calc(100vh-240px)] sm:h-[calc(100vh-280px)]">
                <div className="space-y-6 pr-2 sm:pr-4 pb-8">
                  {groupedBySeason.map(({ season, events }) => {
                    const cfg = seasonConfig[season];
                    const SeasonIcon = cfg.icon;
                    return (
                      <section key={season} data-testid={`section-season-${season}`}>
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 ${cfg.headerBg} border ${cfg.borderColor}`}
                        >
                          <SeasonIcon className={`w-4 h-4 ${cfg.textColor}`} />
                          <h3 className={`text-sm sm:text-base font-semibold ${cfg.textColor}`}>
                            {cfg.english}
                            <span className="text-muted-foreground font-normal">
                              {' / '}
                              {cfg.subtitle}
                            </span>
                          </h3>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {events.length} 個事件
                          </span>
                        </div>

                        <div className="space-y-3">
                          {events.map(event => (
                            <EventCard
                              key={event.id}
                              event={event}
                              isExpanded={expandedEvents.has(event.id)}
                              onToggle={() => toggleExpand(event.id)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default JesusTimelinePage;
