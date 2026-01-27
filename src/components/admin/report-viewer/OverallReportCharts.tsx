// Visualization charts for overall AI report analysis with animations

import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: 'spring', 
      stiffness: 300, 
      damping: 24 
    }
  }
};

const statCardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      type: 'spring',
      stiffness: 400,
      damping: 25
    }
  })
};

const progressVariants = {
  hidden: { pathLength: 0 },
  visible: (percentage: number) => ({
    pathLength: percentage / 100,
    transition: {
      duration: 1.2,
      ease: 'easeOut',
      delay: 0.3
    }
  })
};

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
  
  // Animated number counter hook
  const AnimatedNumber: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
      const duration = 1000;
      const steps = 30;
      const increment = value / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }, [value]);
    
    return <>{displayValue}{suffix}</>;
  };

  // Animated circular progress component
  const AnimatedCircularProgress: React.FC<{
    percentage: number;
    color: string;
    size?: number;
  }> = ({ percentage, color, size = 80 }) => {
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    
    return (
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
        initial="hidden"
        animate="visible"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ 
            strokeDashoffset: circumference - (percentage / 100) * circumference 
          }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </motion.svg>
    );
  };
  
  return (
    <motion.div 
      className={cn("space-y-4", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Summary Stats with staggered animation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: '小組數', value: groupReports.length, color: 'primary', gradient: 'from-primary/10 to-primary/5', border: 'border-primary/20' },
          { icon: MessageSquare, label: '參與人數', value: totalMembers, color: 'secondary', gradient: 'from-secondary/10 to-secondary/5', border: 'border-secondary/20' },
          { icon: Lightbulb, label: '熱門主題', value: keywordFrequency[0]?.keyword || '-', color: 'accent', gradient: 'from-accent/10 to-accent/5', border: 'border-accent/20', isText: true },
          { icon: TrendingUp, label: '平均完成度', value: avgCompleteness, suffix: '%', color: 'emerald', gradient: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            custom={idx}
            variants={statCardVariants}
          >
            <Card className={cn(`bg-gradient-to-br ${stat.gradient} ${stat.border}`)}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1 + 0.2, type: 'spring', stiffness: 400 }}
                  >
                    <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", `text-${stat.color}`)} />
                  </motion.div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={cn("text-lg sm:text-2xl font-bold", stat.isText ? "text-sm sm:text-lg truncate" : "", `text-${stat.color}`)}>
                      {stat.isText ? stat.value : <AnimatedNumber value={stat.value as number} suffix={stat.suffix} />}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      
      {/* Charts Grid with animation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Group Participation Chart */}
        <motion.div variants={cardVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                各組參與度比較
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <motion.div 
                className="h-48 sm:h-56"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
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
                    <Bar 
                      dataKey="memberCount" 
                      name="memberCount" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      animationDuration={1200}
                      animationBegin={400}
                    />
                    <Bar 
                      dataKey="completeness" 
                      name="completeness" 
                      fill="hsl(var(--secondary))" 
                      radius={[4, 4, 0, 0]}
                      animationDuration={1200}
                      animationBegin={600}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
              <motion.div 
                className="flex justify-center gap-4 mt-2 text-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-primary" /> 人數
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-secondary" /> 完成度(%)
                </span>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Keyword Word Cloud (as Bar Chart) */}
        <motion.div variants={cardVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                主題關鍵詞頻率
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <motion.div 
                className="h-48 sm:h-56"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
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
                    <Bar 
                      dataKey="count" 
                      radius={[0, 4, 4, 0]}
                      animationDuration={1200}
                      animationBegin={500}
                    >
                      {keywordFrequency.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Section Completion with animated rings */}
        <motion.div variants={cardVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                各項目填寫情況
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {sectionStats.map((stat, idx) => (
                  <motion.div 
                    key={stat.name} 
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + idx * 0.1, type: 'spring', stiffness: 300 }}
                  >
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
                      <AnimatedCircularProgress 
                        percentage={stat.percentage} 
                        color={CHART_COLORS[idx]} 
                        size={80}
                      />
                      <motion.div 
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1 + idx * 0.1, type: 'spring' }}
                      >
                        <span className="text-sm sm:text-base font-bold text-foreground">
                          <AnimatedNumber value={stat.percentage} suffix="%" />
                        </span>
                      </motion.div>
                    </div>
                    <motion.p 
                      className="text-xs sm:text-sm mt-2 text-muted-foreground"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 + idx * 0.1 }}
                    >
                      {stat.name}
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1.3 + idx * 0.1 }}
                    >
                      <Badge variant="secondary" className="text-[10px]">
                        {stat.count}/{groupReports.length} 組
                      </Badge>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};
