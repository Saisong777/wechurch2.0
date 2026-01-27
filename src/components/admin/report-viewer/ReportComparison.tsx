// Side-by-side report comparison component with diff highlighting

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Columns, Users, BarChart3, ArrowLeftRight, X, Highlighter } from 'lucide-react';
import { GroupReport } from './parse';
import { cn } from '@/lib/utils';

interface ReportComparisonProps {
  groupReports: GroupReport[];
  overallReport?: GroupReport;
  onClose?: () => void;
}

const sectionTypes = [
  { key: 'themes', label: '主題', icon: '🎯' },
  { key: 'observations', label: '觀察', icon: '👀' },
  { key: 'insights', label: '亮光', icon: '💡' },
  { key: 'applications', label: '應用', icon: '✍️' },
] as const;

type SectionKey = typeof sectionTypes[number]['key'];

// Extract keywords from content for comparison
function extractKeywords(content: string): Set<string> {
  if (!content) return new Set();
  
  // Common keywords to look for
  const patterns = [
    /神(?:的[愛恩典榮耀旨意國度])?/g,
    /耶穌(?:基督)?/g,
    /聖靈/g,
    /信心|信仰/g,
    /盼望|希望/g,
    /愛心|慈愛|愛/g,
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
    /真理/g,
    /公義/g,
    /憐憫/g,
    /敬拜|讚美/g,
  ];
  
  const keywords = new Set<string>();
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(m => keywords.add(m.replace(/的[愛恩典榮耀旨意國度]/, '')));
    }
  }
  
  return keywords;
}

// Find unique keywords in each side
function findDifferences(leftContent: string, rightContent: string) {
  const leftKeywords = extractKeywords(leftContent);
  const rightKeywords = extractKeywords(rightContent);
  
  const leftOnly = new Set([...leftKeywords].filter(k => !rightKeywords.has(k)));
  const rightOnly = new Set([...rightKeywords].filter(k => !leftKeywords.has(k)));
  const common = new Set([...leftKeywords].filter(k => rightKeywords.has(k)));
  
  return { leftOnly, rightOnly, common };
}

// Highlight content with diff markers
function HighlightedContent({ 
  content, 
  uniqueKeywords, 
  commonKeywords,
  showDiff 
}: { 
  content: string; 
  uniqueKeywords: Set<string>; 
  commonKeywords: Set<string>;
  showDiff: boolean;
}) {
  if (!content || !showDiff) {
    return <div className="text-sm leading-relaxed whitespace-pre-wrap">{content || ''}</div>;
  }

  // Create regex to match all keywords
  const allKeywords = [...uniqueKeywords, ...commonKeywords];
  if (allKeywords.length === 0) {
    return <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>;
  }

  const pattern = new RegExp(`(${allKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = content.split(pattern);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, idx) => {
        const isUnique = uniqueKeywords.has(part);
        const isCommon = commonKeywords.has(part);
        
        if (isUnique) {
          return (
            <motion.span
              key={idx}
              initial={{ backgroundColor: 'transparent' }}
              animate={{ backgroundColor: 'hsl(var(--accent) / 0.3)' }}
              className="px-1 py-0.5 rounded font-semibold text-accent-foreground bg-accent/30 border-b-2 border-accent"
              title="獨特觀點"
            >
              {part}
            </motion.span>
          );
        }
        
        if (isCommon) {
          return (
            <span
              key={idx}
              className="px-0.5 text-primary font-medium"
              title="共同主題"
            >
              {part}
            </span>
          );
        }
        
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}

// Summary of differences
function DiffSummary({ 
  leftOnly, 
  rightOnly, 
  common,
  leftLabel,
  rightLabel 
}: { 
  leftOnly: Set<string>; 
  rightOnly: Set<string>; 
  common: Set<string>;
  leftLabel: string;
  rightLabel: string;
}) {
  if (leftOnly.size === 0 && rightOnly.size === 0 && common.size === 0) {
    return null;
  }

  return (
    <motion.div 
      className="mb-4 p-3 rounded-lg bg-muted/50 border text-xs space-y-2"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 font-medium text-sm">
        <Highlighter className="w-4 h-4 text-accent" />
        差異分析
      </div>
      
      {common.size > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-muted-foreground">共同主題：</span>
          {[...common].map(k => (
            <Badge key={k} variant="secondary" className="text-[10px] h-5">
              {k}
            </Badge>
          ))}
        </div>
      )}
      
      {leftOnly.size > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-muted-foreground">{leftLabel} 獨有：</span>
          {[...leftOnly].map(k => (
            <Badge key={k} className="text-[10px] h-5 bg-accent/20 text-accent-foreground border-accent">
              {k}
            </Badge>
          ))}
        </div>
      )}
      
      {rightOnly.size > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-muted-foreground">{rightLabel} 獨有：</span>
          {[...rightOnly].map(k => (
            <Badge key={k} className="text-[10px] h-5 bg-secondary/20 text-secondary-foreground border-secondary">
              {k}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export const ReportComparison: React.FC<ReportComparisonProps> = ({
  groupReports,
  overallReport,
  onClose,
}) => {
  const [leftGroup, setLeftGroup] = useState<number | 'overall'>(
    groupReports[0]?.groupNumber || 'overall'
  );
  const [rightGroup, setRightGroup] = useState<number | 'overall'>(
    groupReports[1]?.groupNumber || groupReports[0]?.groupNumber || 'overall'
  );
  const [activeSection, setActiveSection] = useState<SectionKey>('themes');
  const [showDiff, setShowDiff] = useState(true);

  const getReport = (selection: number | 'overall'): GroupReport | undefined => {
    if (selection === 'overall') return overallReport;
    return groupReports.find(g => g.groupNumber === selection);
  };

  const leftReport = getReport(leftGroup);
  const rightReport = getReport(rightGroup);

  const options = [
    ...(overallReport ? [{ value: 'overall', label: '📊 全組總結' }] : []),
    ...groupReports.map(g => ({ value: g.groupNumber.toString(), label: `第 ${g.groupNumber} 組` })),
  ];

  const getLabel = (selection: number | 'overall') => {
    if (selection === 'overall') return '全組總結';
    return `第 ${selection} 組`;
  };

  // Calculate differences
  const diff = useMemo(() => {
    const leftContent = leftReport?.[activeSection] || '';
    const rightContent = rightReport?.[activeSection] || '';
    return findDifferences(leftContent, rightContent);
  }, [leftReport, rightReport, activeSection]);

  const swapGroups = () => {
    setLeftGroup(rightGroup);
    setRightGroup(leftGroup);
  };

  const renderReportPane = (
    report: GroupReport | undefined, 
    side: 'left' | 'right',
    uniqueKeywords: Set<string>
  ) => {
    if (!report) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          請選擇要比較的報告
        </div>
      );
    }

    const content = report[activeSection] || '';
    const isOverall = report.groupNumber === 0;

    return (
      <motion.div
        key={`${side}-${report.groupNumber}-${activeSection}`}
        initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
        transition={{ duration: 0.3 }}
        className="h-full flex flex-col"
      >
        {/* Group Header */}
        <div className={cn(
          "rounded-t-lg px-4 py-3 shrink-0",
          isOverall
            ? "bg-gradient-to-r from-accent/20 to-secondary/10"
            : "gradient-navy text-primary-foreground"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOverall ? (
                <BarChart3 className="w-4 h-4 text-accent" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              <span className={cn("font-bold", isOverall && "text-accent")}>
                {isOverall ? '全組總結' : `第 ${report.groupNumber} 組`}
              </span>
            </div>
            {showDiff && uniqueKeywords.size > 0 && (
              <Badge variant="outline" className={cn(
                "text-[10px] h-5",
                isOverall ? "border-accent text-accent" : "border-primary-foreground/50 text-primary-foreground"
              )}>
                {uniqueKeywords.size} 獨特觀點
              </Badge>
            )}
          </div>
          {report.members && (
            <p className="text-xs mt-1 opacity-80">
              👥 {report.members}
            </p>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {content ? (
              <HighlightedContent 
                content={content}
                uniqueKeywords={uniqueKeywords}
                commonKeywords={diff.common}
                showDiff={showDiff}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">此組沒有「{sectionTypes.find(s => s.key === activeSection)?.label}」內容</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </motion.div>
    );
  };

  return (
    <Card className="h-full border-2 border-primary/20">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Columns className="w-5 h-5 text-primary" />
            報告比對
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch 
                id="show-diff" 
                checked={showDiff} 
                onCheckedChange={setShowDiff}
                className="data-[state=checked]:bg-accent"
              />
              <Label htmlFor="show-diff" className="text-xs cursor-pointer flex items-center gap-1">
                <Highlighter className="w-3 h-3" />
                <span className="hidden sm:inline">差異高亮</span>
              </Label>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Selectors */}
        <div className="flex items-center gap-2 mt-3">
          <Select
            value={leftGroup.toString()}
            onValueChange={(v) => setLeftGroup(v === 'overall' ? 'overall' : parseInt(v))}
          >
            <SelectTrigger className="flex-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value} disabled={opt.value === rightGroup.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={swapGroups}
            className="h-9 w-9 p-0 shrink-0"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Button>

          <Select
            value={rightGroup.toString()}
            onValueChange={(v) => setRightGroup(v === 'overall' ? 'overall' : parseInt(v))}
          >
            <SelectTrigger className="flex-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value} disabled={opt.value === leftGroup.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {sectionTypes.map(section => (
            <Button
              key={section.key}
              variant={activeSection === section.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection(section.key)}
              className={cn(
                "gap-1 h-8 text-xs shrink-0 transition-all",
                activeSection === section.key && "shadow-md"
              )}
            >
              <span>{section.icon}</span>
              {section.label}
            </Button>
          ))}
        </div>

        {/* Diff Summary */}
        {showDiff && (
          <DiffSummary 
            leftOnly={diff.leftOnly}
            rightOnly={diff.rightOnly}
            common={diff.common}
            leftLabel={getLabel(leftGroup)}
            rightLabel={getLabel(rightGroup)}
          />
        )}
      </CardHeader>

      <CardContent className="p-0 flex-1">
        <div className="grid grid-cols-2 divide-x divide-border h-[400px] sm:h-[450px]">
          {/* Left Pane */}
          <div className="overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              {renderReportPane(leftReport, 'left', diff.leftOnly)}
            </AnimatePresence>
          </div>

          {/* Right Pane */}
          <div className="overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              {renderReportPane(rightReport, 'right', diff.rightOnly)}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
