import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Heart, Users, User, PartyPopper } from 'lucide-react';
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

export const PrayerWall: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: prayers, isLoading, error, isFetching } = usePrayerWall();
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('all');

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

  return (
    <div className="max-w-2xl md:max-w-3xl mx-auto space-y-6 px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            禱告牆
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            彼此代禱，互相扶持
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrayerNotifications />
          <CreatePrayerDialog />
        </div>
      </div>

      {/* Admin: Mock Data Generator */}
      {isAdmin && <MockPrayerGenerator />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPrayers}</p>
              <p className="text-xs text-muted-foreground">禱告事項</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-500/5 to-rose-500/10">
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-rose-500/10">
              <Heart className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAmens}</p>
              <p className="text-xs text-muted-foreground">阿門代禱</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Tabs */}
      <div className="space-y-2 -mx-4 sm:mx-0">
        <div className="overflow-x-auto px-4 sm:px-0 scrollbar-hide">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(val) => val && setViewMode(val as ViewMode)}
            className="flex gap-2 justify-start min-w-max"
          >
            <ToggleGroupItem 
              value="all" 
              className="flex items-center gap-2 min-h-[44px] px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Users className="h-4 w-4" />
              全部禱告
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="my" 
              className="flex items-center gap-2 min-h-[44px] px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <User className="h-4 w-4" />
              我的禱告
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="answered" 
              className="flex items-center gap-2 min-h-[44px] px-4 data-[state=on]:bg-emerald-500 data-[state=on]:text-white"
            >
              <PartyPopper className="h-4 w-4" />
              已蒙應允
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Category Filter */}
      <div className="space-y-2 -mx-4 sm:mx-0">
        <p className="text-sm text-muted-foreground px-4 sm:px-0">篩選分類</p>
        <div className="overflow-x-auto px-4 sm:px-0 scrollbar-hide">
          <ToggleGroup
            type="single"
            value={filterCategory}
            onValueChange={(val) => val && setFilterCategory(val as FilterCategory)}
            className="flex gap-2 justify-start min-w-max"
          >
            <ToggleGroupItem 
              value="all" 
              className="min-h-[44px] px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              全部
            </ToggleGroupItem>
            {(Object.keys(CATEGORY_LABELS) as PrayerCategory[]).map((key) => (
              <ToggleGroupItem
                key={key}
                value={key}
                className="min-h-[44px] px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {CATEGORY_LABELS[key]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          className="gap-2 text-muted-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
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
        <Card>
          <CardContent className="py-12 text-center">
            {viewMode === 'answered' ? (
              <>
                <PartyPopper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">還沒有蒙應允的禱告</h3>
                <p className="text-muted-foreground mb-4">
                  當禱告蒙應允時，可點擊勾選按鈕標記為已蒙應允
                </p>
              </>
            ) : viewMode === 'my' ? (
              <>
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">你還沒有發布禱告</h3>
                <p className="text-muted-foreground mb-4">
                  點擊上方按鈕分享你的禱告事項
                </p>
              </>
            ) : (
              <>
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {filterCategory === 'all' ? '還沒有禱告事項' : `沒有${CATEGORY_LABELS[filterCategory]}類別的禱告`}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {filterCategory === 'all' ? '成為第一個分享禱告的人吧！' : '嘗試選擇其他分類或新增禱告'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prayer List */}
      {filteredPrayers.length > 0 && (
        <div className="space-y-4">
          {filteredPrayers.map((prayer) => (
            <PrayerCard key={prayer.id} prayer={prayer} />
          ))}
        </div>
      )}
    </div>
  );
};
