import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, UserCheck, TrendingUp } from 'lucide-react';

interface CRMStats {
  totalMembers: number;
  newThisWeek: number;
  newThisMonth: number;
  potentialMembers: number;
  registeredMembers: number;
}

interface CRMStatsCardsProps {
  stats: CRMStats;
  loading?: boolean;
}

export const CRMStatsCards: React.FC<CRMStatsCardsProps> = ({ stats, loading }) => {
  const cards = [
    {
      title: '總會員數',
      value: stats.totalMembers,
      icon: Users,
      description: '所有會員與潛在會員',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '本週新進',
      value: stats.newThisWeek,
      icon: UserPlus,
      description: '過去 7 天加入',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: '本月新進',
      value: stats.newThisMonth,
      icon: TrendingUp,
      description: '過去 30 天加入',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: '已註冊會員',
      value: stats.registeredMembers,
      icon: UserCheck,
      description: '已完成帳號註冊',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '...' : card.value.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
