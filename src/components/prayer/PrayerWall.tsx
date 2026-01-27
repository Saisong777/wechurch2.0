import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Heart, Users } from 'lucide-react';
import { usePrayerWall, PrayerCategory, CATEGORY_LABELS } from '@/hooks/usePrayerWall';
import { PrayerCard } from './PrayerCard';
import { CreatePrayerDialog } from './CreatePrayerDialog';
import { MockPrayerGenerator } from './MockPrayerGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type FilterCategory = 'all' | PrayerCategory;

export const PrayerWall: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: prayers, isLoading, error, isFetching } = usePrayerWall();
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
  };

  // Filter prayers by category
  const filteredPrayers = useMemo(() => {
    if (!prayers) return [];
    if (filterCategory === 'all') return prayers;
    return prayers.filter((p) => p.category === filterCategory);
  }, [prayers, filterCategory]);

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
  const totalAmens = prayers?.reduce((sum, p) => sum + p.amen_count, 0) || 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 sm:px-0">
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
        <CreatePrayerDialog />
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

      {/* Category Filter */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">篩選分類</p>
        <ToggleGroup
          type="single"
          value={filterCategory}
          onValueChange={(val) => val && setFilterCategory(val as FilterCategory)}
          className="flex flex-wrap gap-2 justify-start"
        >
          <ToggleGroupItem value="all" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            全部
          </ToggleGroupItem>
          {(Object.keys(CATEGORY_LABELS) as PrayerCategory[]).map((key) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {CATEGORY_LABELS[key]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {filterCategory === 'all' ? '還沒有禱告事項' : `沒有${CATEGORY_LABELS[filterCategory]}類別的禱告`}
            </h3>
            <p className="text-muted-foreground mb-4">
              {filterCategory === 'all' ? '成為第一個分享禱告的人吧！' : '嘗試選擇其他分類或新增禱告'}
            </p>
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
