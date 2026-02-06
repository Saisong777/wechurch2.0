import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sprout, Sun, Leaf, Snowflake, Calendar, MapPin, Book, AlertCircle, ChevronUp, FileText, Filter, ChevronDown, Minus, Plus, Type } from 'lucide-react';
import { ScriptureViewer } from '@/components/scripture/ScriptureViewer';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Header } from '@/components/layout/Header';

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
  buttonLabel: string;
  subtitle: string;
  icon: typeof FileText;
  textColor: string;
  badgeBg: string;
  borderColor: string;
  headerBg: string;
  buttonSelectedBg: string;
  buttonSelectedText: string;
  buttonOutlineColor: string;
}> = {
  '後設': {
    buttonLabel: '前後言',
    subtitle: '前後言',
    icon: FileText,
    textColor: 'text-slate-600 dark:text-slate-400',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    borderColor: 'border-slate-300 dark:border-slate-600',
    headerBg: 'bg-slate-50 dark:bg-slate-900/50',
    buttonSelectedBg: 'bg-slate-600 dark:bg-slate-500',
    buttonSelectedText: 'text-white',
    buttonOutlineColor: 'border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-400',
  },
  '春': {
    buttonLabel: '春',
    subtitle: '預備期',
    icon: Sprout,
    textColor: 'text-green-600 dark:text-green-400',
    badgeBg: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-700',
    headerBg: 'bg-green-50 dark:bg-green-950/40',
    buttonSelectedBg: 'bg-green-600 dark:bg-green-600',
    buttonSelectedText: 'text-white',
    buttonOutlineColor: 'border-green-400 text-green-600 dark:border-green-500 dark:text-green-400',
  },
  '夏': {
    buttonLabel: '夏',
    subtitle: '事工高峰',
    icon: Sun,
    textColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-700',
    headerBg: 'bg-amber-50 dark:bg-amber-950/40',
    buttonSelectedBg: 'bg-amber-600 dark:bg-amber-600',
    buttonSelectedText: 'text-white',
    buttonOutlineColor: 'border-amber-400 text-amber-600 dark:border-amber-500 dark:text-amber-400',
  },
  '秋': {
    buttonLabel: '秋',
    subtitle: '轉折衝突',
    icon: Leaf,
    textColor: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-300 dark:border-orange-700',
    headerBg: 'bg-orange-50 dark:bg-orange-950/40',
    buttonSelectedBg: 'bg-orange-600 dark:bg-orange-600',
    buttonSelectedText: 'text-white',
    buttonOutlineColor: 'border-orange-400 text-orange-600 dark:border-orange-500 dark:text-orange-400',
  },
  '冬': {
    buttonLabel: '冬',
    subtitle: '受難復活',
    icon: Snowflake,
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
    headerBg: 'bg-blue-50 dark:bg-blue-950/40',
    buttonSelectedBg: 'bg-blue-600 dark:bg-blue-600',
    buttonSelectedText: 'text-white',
    buttonOutlineColor: 'border-blue-400 text-blue-600 dark:border-blue-500 dark:text-blue-400',
  },
};

const seasonOrder = ['後設', '春', '夏', '秋', '冬'];

const gospelKeys = [
  { field: 'scriptureMt' as const, abbr: '太', fullName: '馬太福音', label: 'Mt', color: 'border-blue-400 text-blue-600 dark:border-blue-500 dark:text-blue-400', selectedBg: 'bg-blue-600 dark:bg-blue-600 text-white border-blue-600' },
  { field: 'scriptureMk' as const, abbr: '可', fullName: '馬可福音', label: 'Mk', color: 'border-green-400 text-green-600 dark:border-green-500 dark:text-green-400', selectedBg: 'bg-green-600 dark:bg-green-600 text-white border-green-600' },
  { field: 'scriptureLk' as const, abbr: '路', fullName: '路加福音', label: 'Lk', color: 'border-amber-400 text-amber-600 dark:border-amber-500 dark:text-amber-400', selectedBg: 'bg-amber-600 dark:bg-amber-600 text-white border-amber-600' },
  { field: 'scriptureJn' as const, abbr: '約', fullName: '約翰福音', label: 'Jn', color: 'border-purple-400 text-purple-600 dark:border-purple-500 dark:text-purple-400', selectedBg: 'bg-purple-600 dark:bg-purple-600 text-white border-purple-600' },
];

const gospelIndicatorColors: Record<string, { active: string; inactive: string }> = {
  '太': { active: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', inactive: 'bg-muted text-muted-foreground/30' },
  '可': { active: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', inactive: 'bg-muted text-muted-foreground/30' },
  '路': { active: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400', inactive: 'bg-muted text-muted-foreground/30' },
  '約': { active: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400', inactive: 'bg-muted text-muted-foreground/30' },
};

const FONT_SIZE_KEY = 'wechurch-timeline-font-size';
const fontSizeOptions = [
  { label: '小', value: 0, class: 'text-sm sm:text-base' },
  { label: '中', value: 1, class: 'text-base sm:text-lg' },
  { label: '大', value: 2, class: 'text-lg sm:text-xl' },
  { label: '特大', value: 3, class: 'text-xl sm:text-2xl' },
];

function getExclusiveGospel(event: JesusEvent): string | null {
  const present = gospelKeys.filter(g => event[g.field]);
  if (present.length === 1) return present[0].abbr;
  return null;
}

const ScriptureDisplay = ({ reference, gospelName, fontSizeClass }: { reference: string; gospelName: string; fontSizeClass: string }) => {
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
      <ScriptureViewer verses={formattedVerses} paragraphMode fontSizeClass={fontSizeClass} />
    </div>
  );
};

const SyncedScriptureDisplay = ({ scriptures, fontSizeClass }: {
  scriptures: { key: string; name: string; ref: string }[];
  fontSizeClass: string;
}) => {
  const scrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isScrolling = useRef(false);

  const handleScroll = useCallback((sourceIdx: number) => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    const source = scrollRefs.current[sourceIdx];
    if (!source) { isScrolling.current = false; return; }

    const scrollTop = source.scrollTop;
    const scrollRatio = source.scrollHeight > source.clientHeight
      ? scrollTop / (source.scrollHeight - source.clientHeight)
      : 0;

    scrollRefs.current.forEach((ref, idx) => {
      if (idx !== sourceIdx && ref) {
        const targetMax = ref.scrollHeight - ref.clientHeight;
        if (targetMax > 0) {
          ref.scrollTop = scrollRatio * targetMax;
        }
      }
    });

    requestAnimationFrame(() => { isScrolling.current = false; });
  }, []);

  const bgColors: Record<string, string> = {
    'scriptureMt': 'bg-blue-50/60 dark:bg-blue-950/20',
    'scriptureMk': 'bg-green-50/60 dark:bg-green-950/20',
    'scriptureLk': 'bg-amber-50/60 dark:bg-amber-950/20',
    'scriptureJn': 'bg-purple-50/60 dark:bg-purple-950/20',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {scriptures.map((g, idx) => (
        <div
          key={g.key}
          ref={(el) => { scrollRefs.current[idx] = el; }}
          onScroll={() => handleScroll(idx)}
          className={`rounded-lg p-2 sm:p-3 sm:max-h-[60vh] sm:overflow-y-scroll scripture-scroll-visible ${bgColors[g.key] || 'bg-muted/30'}`}
        >
          <ScriptureDisplay reference={g.ref} gospelName={g.name} fontSizeClass={fontSizeClass} />
        </div>
      ))}
    </div>
  );
};

const EventCard = ({
  event,
  isCollapsed,
  onToggle,
  fontSizeClass,
}: {
  event: JesusEvent;
  isCollapsed: boolean;
  onToggle: () => void;
  fontSizeClass: string;
}) => {
  const cfg = seasonConfig[event.season] || seasonConfig['春'];
  const exclusive = getExclusiveGospel(event);

  const gospelScriptures = gospelKeys
    .filter(g => event[g.field])
    .map(g => ({ key: g.field, name: g.fullName, ref: event[g.field]! }));

  const hasMultipleScriptures = gospelScriptures.length >= 2;

  return (
    <Card
      className="hover-elevate"
      data-testid={`event-${event.id}`}
    >
      <CardContent className="p-3 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span
            className={`text-xs font-bold ${cfg.textColor} opacity-70 tabular-nums`}
            data-testid={`event-number-${event.id}`}
          >
            {String(event.displayOrder).padStart(3, '0')}
          </span>
          <Badge
            variant="secondary"
            className={`${cfg.badgeBg} border-0 text-[10px] sm:text-xs no-default-hover-elevate no-default-active-elevate`}
            data-testid={`season-badge-${event.id}`}
          >
            {cfg.buttonLabel}
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
          {event.location && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" data-testid={`location-${event.id}`}>
              <MapPin className="w-3 h-3" />
              {event.location}
            </span>
          )}
          {event.approximateDate && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" data-testid={`date-${event.id}`}>
              <Calendar className="w-3 h-3" />
              {event.approximateDate}
            </span>
          )}
        </div>

        <h4
          className="font-semibold text-base sm:text-lg text-foreground mb-1.5 leading-snug"
          data-testid={`event-title-${event.id}`}
        >
          {event.eventName}
        </h4>

        <div className="flex items-center gap-1 mb-2" data-testid={`gospel-indicators-${event.id}`}>
          {gospelKeys.map(g => {
            const hasScripture = !!event[g.field];
            const colors = gospelIndicatorColors[g.abbr];
            return (
              <span
                key={g.field}
                className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold transition-colors ${
                  hasScripture ? colors.active : colors.inactive
                }`}
                data-testid={`gospel-${g.abbr}-${event.id}`}
              >
                {g.abbr}
              </span>
            );
          })}
        </div>

        {isCollapsed && gospelScriptures.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="mt-1 gap-1 text-xs text-muted-foreground"
            data-testid={`button-expand-${event.id}`}
          >
            <Book className="w-3.5 h-3.5" />
            展開經文
          </Button>
        )}

        {!isCollapsed && gospelScriptures.length > 0 && (
          <div
            className="mt-3 pt-3 border-t border-border space-y-3"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {hasMultipleScriptures ? (
              <SyncedScriptureDisplay scriptures={gospelScriptures} fontSizeClass={fontSizeClass} />
            ) : (
              gospelScriptures.map((g) => {
                const bgColors: Record<string, string> = {
                  'scriptureMt': 'bg-blue-50/60 dark:bg-blue-950/20',
                  'scriptureMk': 'bg-green-50/60 dark:bg-green-950/20',
                  'scriptureLk': 'bg-amber-50/60 dark:bg-amber-950/20',
                  'scriptureJn': 'bg-purple-50/60 dark:bg-purple-950/20',
                };
                return (
                  <div key={g.key} className={`rounded-lg p-3 ${bgColors[g.key] || 'bg-muted/30'}`}>
                    <ScriptureDisplay reference={g.ref} gospelName={g.name} fontSizeClass={fontSizeClass} />
                  </div>
                );
              })
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="gap-1 text-xs text-muted-foreground"
              data-testid={`button-collapse-${event.id}`}
            >
              <ChevronUp className="w-3.5 h-3.5" />
              收起經文
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const JesusTimelinePage = () => {
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedGospel, setSelectedGospel] = useState<string | null>(null);
  const [collapsedEvents, setCollapsedEvents] = useState<Set<number>>(new Set());
  const [filterOpen, setFilterOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [fontSizeIdx, setFontSizeIdx] = useState(() => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_KEY);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 0 && parsed < fontSizeOptions.length) return parsed;
      }
    } catch {}
    return 1;
  });

  const currentFontSize = fontSizeOptions[fontSizeIdx];

  const handleFontSizeChange = (delta: number) => {
    setFontSizeIdx(prev => {
      const next = Math.max(0, Math.min(fontSizeOptions.length - 1, prev + delta));
      try { localStorage.setItem(FONT_SIZE_KEY, String(next)); } catch {}
      return next;
    });
  };

  const { data: allEvents = [], isLoading, isError } = useQuery<JesusEvent[]>({
    queryKey: ['/api/jesus/timeline'],
    queryFn: async () => {
      const res = await fetch('/api/jesus/timeline');
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
  });

  const toggleCollapse = (eventId: number) => {
    setCollapsedEvents(prev => {
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
        <Header variant="compact" title="耶穌四季" />
        <main className="flex-1 container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 overflow-y-auto">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-4 pb-8">
            <Card>
              <CardContent className="py-2.5 sm:py-4">
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="flex items-center justify-between w-full gap-2"
                  aria-expanded={filterOpen}
                  data-testid="button-toggle-filter"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground" data-testid="text-event-count">
                      {filteredEvents.length} 個事件
                    </span>
                    {(selectedSeason || selectedGospel) && (
                      <span className="text-xs text-muted-foreground">
                        （共 {allEvents.length} 個）
                      </span>
                    )}
                    {!filterOpen && (selectedSeason || selectedGospel) && (
                      <div className="flex items-center gap-1">
                        {selectedGospel && (
                          <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                            {selectedGospel}
                          </Badge>
                        )}
                        {selectedSeason && (
                          <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                            {seasonConfig[selectedSeason]?.buttonLabel}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${filterOpen ? 'rotate-180' : ''}`} />
                </button>

                {filterOpen && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground mr-1">福音書</span>
                      {gospelKeys.map(g => {
                        const isSelected = selectedGospel === g.abbr;
                        return (
                          <button
                            key={g.abbr}
                            onClick={() => handleGospelClick(g.abbr)}
                            className={`inline-flex items-center justify-center rounded-md text-sm font-medium min-h-8 px-3 border transition-colors ${
                              isSelected
                                ? g.selectedBg
                                : g.color
                            }`}
                            data-testid={`button-gospel-${g.abbr}`}
                          >
                            {g.abbr}
                          </button>
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
                          <button
                            key={season}
                            onClick={() => handleSeasonClick(season)}
                            className={`inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium min-h-8 px-3 border transition-colors ${
                              isSelected
                                ? `${cfg.buttonSelectedBg} ${cfg.buttonSelectedText} border-transparent`
                                : cfg.buttonOutlineColor
                            }`}
                            data-testid={`button-season-${season}`}
                          >
                            <SeasonIcon className="w-3.5 h-3.5" />
                            {cfg.buttonLabel}
                          </button>
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

                    <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
                      <Type className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">字體</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleFontSizeChange(-1)}
                          disabled={fontSizeIdx === 0}
                          data-testid="button-font-decrease"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-xs font-medium text-foreground min-w-[2rem] text-center" data-testid="text-font-size">
                          {currentFontSize.label}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleFontSizeChange(1)}
                          disabled={fontSizeIdx === fontSizeOptions.length - 1}
                          data-testid="button-font-increase"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
              <div className="space-y-6">
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
                          {cfg.buttonLabel}
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
                            isCollapsed={collapsedEvents.has(event.id)}
                            onToggle={() => toggleCollapse(event.id)}
                            fontSizeClass={currentFontSize.class}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default JesusTimelinePage;
