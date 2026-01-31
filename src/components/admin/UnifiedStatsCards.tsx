import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Clock, BarChart3, UserPlus, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface UnifiedStatsCardsProps {
  registeredCount: number;
  adminCount: number;
  leaderCount: number;
  potentialTotal: number;
  linkedCount: number;
  pendingCount: number;
  avgAttendance: number;
  newThisWeek?: number;
  newThisMonth?: number;
  loading?: boolean;
}

export const UnifiedStatsCards = ({
  registeredCount,
  adminCount,
  leaderCount,
  potentialTotal,
  linkedCount,
  pendingCount,
  avgAttendance,
  newThisWeek = 0,
  newThisMonth = 0,
  loading,
}: UnifiedStatsCardsProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: '本週新進',
      value: newThisWeek,
      icon: UserPlus,
      description: '過去 7 天',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: '本月新進',
      value: newThisMonth,
      icon: TrendingUp,
      description: '過去 30 天',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    },
    {
      title: '已註冊會員',
      value: registeredCount,
      icon: UserCheck,
      description: `管理員 ${adminCount} ・ 組長 ${leaderCount}`,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      title: '潛在會員',
      value: potentialTotal,
      icon: Users,
      description: `已連結 ${linkedCount}`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: '待跟進',
      value: pendingCount,
      icon: Clock,
      description: '尚未註冊帳號',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: '平均出席',
      value: avgAttendance,
      icon: BarChart3,
      description: '次/人',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
