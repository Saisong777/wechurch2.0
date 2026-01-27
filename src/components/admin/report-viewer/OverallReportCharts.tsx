// Visualization charts for overall AI report analysis

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, Lightbulb, TrendingUp } from 'lucide-react';
import { GroupReport } from './parse';
import { cn } from '@/lib/utils';

// Color palette for charts
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
];

interface OverallReportChartsProps {
  groupReports: GroupReport[];
  overallReport?: GroupReport;
  className?: string;
}

// Extract participation stats from group reports
function extractParticipationStats(groups: GroupReport[]) {
  return groups.map(g => {
    // Count members from the members field
    const memberCount = g.members 
      ? g.members.split(/[,，、]/).filter(m => m.trim()).length 
      : 0;
    
    // Estimate content richness from raw length
    const contentLength = g.raw?.length || 0;
    const hasThemes = !!g.themes;
    const hasObservations = !!g.observations;
    const hasInsights = !!g.insights;
    const hasApplications = !!g.applications;
    const hasContributions = !!g.contributions;
    
    const sectionScore = [hasThemes, hasObservations, hasInsights, hasApplications, hasContributions]
      .filter(Boolean).length;
    
    return {
      name: `第${g.groupNumber}組`,
      groupNumber: g.groupNumber,
      memberCount,
      contentLength: Math.min(contentLength / 100, 100), // Normalize for chart
      sectionScore,
      completeness: Math.round((sectionScore / 5) * 100),
    };
  }).sort((a, b) => a.groupNumber - b.groupNumber);
}

// Extract keyword frequency across all groups
function extractKeywordFrequency(groups: GroupReport[]) {
  const keywordCounts = new Map<string, number>();
  
  const patterns = [
    /神(?:的[愛恩典榮耀旨意國度])?/g,
    /耶穌(?:基督)?/g,
    /聖靈/g,
    /信心|信仰/g,
    /盼望|希望/g,
    /愛心|慈愛/g,
    /救恩|拯救|救贖/g,
    /恩典/g,
    /禱告|祈禱/g,
    /順服/g,
    /謙卑/g,
    /聖潔/g,
    /平安/g,
    /喜樂/g,
    /生命|永生/g,
    /福音/g,
  ];
  
  for (const group of groups) {
    const text = [group.themes, group.observations, group.insights, group.applications, group.raw]
      .filter(Boolean)
      .join(' ');
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const normalized = match.replace(/的[愛恩典榮耀旨意國度]/, '').trim();
          keywordCounts.set(normalized, (keywordCounts.get(normalized) || 0) + 1);
        }
      }
    }
  }
  
  return Array.from(keywordCounts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// Extract section completeness data
function extractSectionStats(groups: GroupReport[]) {
  const sectionNames = ['主題', '觀察', '亮光', '應用', '個人貢獻'];
  const sectionKeys: (keyof GroupReport)[] = ['themes', 'observations', 'insights', 'applications', 'contributions'];
  
  return sectionNames.map((name, idx) => {
    const key = sectionKeys[idx];
    const groupsWithSection = groups.filter(g => g[key] && String(g[key]).trim().length > 10).length;
    return {
      name,
      count: groupsWithSection,
      percentage: Math.round((groupsWithSection / groups.length) * 100),
    };
  });
}

export const OverallReportCharts: React.FC<OverallReportChartsProps> = ({
  groupReports,
  overallReport,
  className,
}) => {
  const participationStats = useMemo(() => extractParticipationStats(groupReports), [groupReports]);
  const keywordFrequency = useMemo(() => extractKeywordFrequency(groupReports), [groupReports]);
  const sectionStats = useMemo(() => extractSectionStats(groupReports), [groupReports]);
  
  const totalMembers = participationStats.reduce((sum, g) => sum + g.memberCount, 0);
  const avgCompleteness = participationStats.length > 0 
    ? Math.round(participationStats.reduce((sum, g) => sum + g.completeness, 0) / participationStats.length)
    : 0;
  
  if (groupReports.length === 0) return null;
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">小組數</p>
                <p className="text-lg sm:text-2xl font-bold text-primary">{groupReports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
              <div>
                <p className="text-xs text-muted-foreground">參與人數</p>
                <p className="text-lg sm:text-2xl font-bold text-secondary">{totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">熱門主題</p>
                <p className="text-sm sm:text-lg font-bold text-accent truncate">
                  {keywordFrequency[0]?.keyword || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">平均完成度</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{avgCompleteness}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Group Participation Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              各組參與度比較
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={participationStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'memberCount') return [value, '人數'];
                      if (name === 'completeness') return [`${value}%`, '完成度'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="memberCount" name="memberCount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completeness" name="completeness" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-primary" /> 人數
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-secondary" /> 完成度(%)
              </span>
            </div>
          </CardContent>
        </Card>
        
        {/* Keyword Word Cloud (as Bar Chart) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              主題關鍵詞頻率
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={keywordFrequency} 
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis 
                    type="category" 
                    dataKey="keyword" 
                    tick={{ fontSize: 11 }} 
                    width={60}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value} 次`, '出現次數']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {keywordFrequency.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Section Completion Pie Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              各項目填寫情況
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {sectionStats.map((stat, idx) => (
                <div key={stat.name} className="text-center">
                  <div 
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg"
                    style={{ 
                      background: `conic-gradient(${CHART_COLORS[idx]} ${stat.percentage}%, hsl(var(--muted)) ${stat.percentage}%)`,
                    }}
                  >
                    <span 
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-foreground font-bold"
                      style={{ backgroundColor: 'hsl(var(--background))' }}
                    >
                      {stat.percentage}%
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm mt-2 text-muted-foreground">{stat.name}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {stat.count}/{groupReports.length} 組
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
