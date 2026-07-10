import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Heart, Users, User, PartyPopper, HandHeart, Sparkles, MessageCircleHeart } from 'lucide-react';
import { usePrayerWall, PrayerCategory, CATEGORY_LABELS } from '@/hooks/usePrayerWall';
import { PrayerCard } from './PrayerCard';
import { CreatePrayerDialog } from './CreatePrayerDialog';
import { MockPrayerGenerator } from './MockPrayerGenerator';
import { PrayerNotifications } from './PrayerNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type FilterCategory = 'all' | PrayerCategory;
type ViewMode = 'all' | 'my' | 'answered';

const viewModeLabels: Record<ViewMode, string> = {
  all: '全部禱告',
  my: '我的禱告',
  answered: '已蒙應允',
};

const listTitleByView: Record<ViewMode, string> = {
  all: '正在守望清單',
  my: '我的公開代禱',
  answered: '蒙應允見證',
};

export const PrayerWall: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: prayers, isLoading, error, isFetching } = usePrayerWall();
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const view = searchParams.get('view');
    return view === 'my' || view === 'answered' ? view : 'all';
  });

  const showCreatedPrayer = () => {
    setViewMode('all');
    setFilterCategory('all');
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
  };

  // Filter and sort prayers: by view mode, category, then pinned first
  const filteredPrayers = useMemo(() => {
    if (!prayers) return [];
    let filtered = prayers;
    
    // Filter by view mode
    if (viewMode === 'my') {
      filtered = filtered.filter((p) => p.isOwner);
    } else if (viewMode === 'answered') {
      filtered = filtered.filter((p) => p.isAnswered);
    }
    
    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === filterCategory);
    }
    
    // Sort: pinned first, then by createdAt descending
    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [prayers, filterCategory, viewMode]);

  const waitingPrayers = useMemo(
    () => filteredPrayers.filter((prayer) => !prayer.isAnswered),
    [filteredPrayers]
  );

  const answeredFilteredPrayers = useMemo(
    () => filteredPrayers.filter((prayer) => prayer.isAnswered),
    [filteredPrayers]
  );

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">請先登入</h3>
          <p className="text-muted-foreground">
            登入後即可查看和發布禱告事項
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const totalPrayers = prayers?.length || 0;
  const totalAmens = prayers?.reduce((sum, p) => sum + p.amenCount, 0) || 0;
  const answeredPrayers = prayers?.filter((p) => p.isAnswered).length || 0;
  const activePrayers = Math.max(totalPrayers - answeredPrayers, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-0">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-5 sm:p-6">
            <Badge variant="outline" className="mb-3 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              Prayer Wall
            </Badge>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <Heart className="h-7 w-7 text-rose-500" />
              從公開代禱到蒙應允見證
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              先把需要大家守望的事放進清單，大家可以一起阿門、留言鼓勵；等神回應時，再標記為蒙應允見證。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <CreatePrayerDialog onCreated={showCreatedPrayer} />
              <PrayerNotifications />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                className="h-11 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t bg-muted/25 lg:border-l lg:border-t-0 lg:grid-cols-1">
            <div className="flex items-center gap-3 border-r p-4 lg:border-b lg:border-r-0">
              <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 sm:flex">
                <MessageCircleHeart className="h-5 w-5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold sm:text-2xl">{activePrayers}</p>
                <p className="text-xs text-muted-foreground">守望中</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-r p-4 lg:border-b lg:border-r-0">
              <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 sm:flex">
                <HandHeart className="h-5 w-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold sm:text-2xl">{totalAmens}</p>
                <p className="text-xs text-muted-foreground">阿門代禱</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 sm:flex">
                <Sparkles className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold sm:text-2xl">{answeredPrayers}</p>
                <p className="text-xs text-muted-foreground">蒙應允</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admin-only local test helper. Keep it out of production/mobile preview. */}
      {isAdmin && import.meta.env.DEV && <MockPrayerGenerator />}

      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 scrollbar-hide">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(val) => val && setViewMode(val as ViewMode)}
              className="flex min-w-max justify-start gap-2"
            >
              <ToggleGroupItem
                value="all"
                className="min-h-[42px] gap-2 rounded-lg px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Users className="h-4 w-4" />
                全部
              </ToggleGroupItem>
              <ToggleGroupItem
                value="my"
                className="min-h-[42px] gap-2 rounded-lg px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <User className="h-4 w-4" />
                我的
              </ToggleGroupItem>
              <ToggleGroupItem
                value="answered"
                className="min-h-[42px] gap-2 rounded-lg px-4 data-[state=on]:bg-emerald-500 data-[state=on]:text-white"
              >
                <PartyPopper className="h-4 w-4" />
                應允
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 scrollbar-hide">
            <ToggleGroup
              type="single"
              value={filterCategory}
              onValueChange={(val) => val && setFilterCategory(val as FilterCategory)}
              className="flex min-w-max justify-start gap-2"
            >
              <ToggleGroupItem
                value="all"
                className="min-h-[42px] rounded-lg px-3 data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground"
              >
                全部分類
              </ToggleGroupItem>
              {(Object.keys(CATEGORY_LABELS) as PrayerCategory[]).map((key) => (
                <ToggleGroupItem
                  key={key}
                  value={key}
                  className="min-h-[42px] rounded-lg px-3 data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground"
                >
                  {CATEGORY_LABELS[key]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{viewModeLabels[viewMode]} · {filterCategory === 'all' ? '全部分類' : CATEGORY_LABELS[filterCategory]}</span>
          <span>{filteredPrayers.length} / {totalPrayers}</span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex justify-end">
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">載入失敗，請重試</p>
            <Button variant="outline" className="mt-4" onClick={handleRefresh}>
              重試
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredPrayers.length === 0 && (
        <Card className="rounded-lg border-dashed">
          <CardContent className="py-12 text-center">
            {viewMode === 'answered' ? (
              <>
                <PartyPopper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">還沒有蒙應允的禱告</h3>
                <p className="text-muted-foreground mb-4">
                  蒙應允的見證會出現在這裡
                </p>
              </>
            ) : viewMode === 'my' ? (
              <>
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">你還沒有發布禱告</h3>
                <p className="text-muted-foreground mb-4">
                  寫下一件今天想邀請大家一起守望的事
                </p>
              </>
            ) : (
              <>
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {filterCategory === 'all' ? '還沒有禱告事項' : `沒有${CATEGORY_LABELS[filterCategory]}類別的禱告`}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {filterCategory === 'all' ? '可以先從一句簡短的代禱開始' : '換個分類看看，或新增一則代禱'}
                </p>
              </>
            )}
            {viewMode !== 'answered' && <CreatePrayerDialog onCreated={showCreatedPrayer} />}
          </CardContent>
        </Card>
      )}

      {/* Prayer List */}
      {filteredPrayers.length > 0 && (
        <div className="space-y-4">
          {viewMode !== 'answered' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-bold text-foreground">{listTitleByView[viewMode]}</h2>
                <Badge variant="outline">{waitingPrayers.length} 筆</Badge>
              </div>

              {waitingPrayers.length > 0 ? (
                <Card className="overflow-hidden rounded-lg shadow-sm">
                  <CardContent className="divide-y p-0">
                    {waitingPrayers.map((prayer) => (
                      <PrayerCard key={prayer.id} prayer={prayer} />
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-lg border-dashed shadow-sm">
                  <CardContent className="p-5 text-center">
                    <Heart className="mx-auto mb-2 h-8 w-8 text-rose-500" />
                    <h3 className="font-bold text-foreground">目前沒有正在守望的代禱</h3>
                    <p className="mt-1 text-sm text-muted-foreground">新增一則代禱後，就會進入這份清單。</p>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {(viewMode === 'answered' || answeredFilteredPrayers.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-bold text-foreground">蒙應允見證</h2>
                <Badge variant="outline">{answeredFilteredPrayers.length} 筆</Badge>
              </div>

              {answeredFilteredPrayers.length > 0 ? (
                <Card className="overflow-hidden rounded-lg border-emerald-200 shadow-sm">
                  <CardContent className="divide-y p-0">
                    {answeredFilteredPrayers.map((prayer) => (
                      <PrayerCard key={prayer.id} prayer={prayer} />
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-lg border-dashed shadow-sm">
                  <CardContent className="p-6 text-center">
                    <PartyPopper className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
                    <h3 className="text-lg font-bold text-foreground">還沒有蒙應允見證</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      當某一則公開代禱有了後續回應，就可以標記到這裡。
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
