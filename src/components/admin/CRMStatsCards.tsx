import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Clock, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CRMStatsCardsProps {
  total: number;
  converted: number;
  pending: number;
  avgAttendance: number;
  loading?: boolean;
}

export const CRMStatsCards = ({ total, converted, pending, avgAttendance, loading }: CRMStatsCardsProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
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
      title: '潛在會員',
      value: total,
      icon: Users,
      description: '總參與人數',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '已轉換會員',
      value: converted,
      icon: UserCheck,
      description: '已註冊帳號',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: '待跟進',
      value: pending,
      icon: Clock,
      description: '尚未註冊',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: '平均出席',
      value: avgAttendance,
      icon: BarChart3,
      description: '次/人',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
