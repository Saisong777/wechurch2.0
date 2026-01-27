// Side-by-side report comparison component

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Columns, Users, BarChart3, ArrowLeftRight, X } from 'lucide-react';
import { GroupReport } from './parse';
import { EnhancedSection } from '../report-elements';
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

  const swapGroups = () => {
    setLeftGroup(rightGroup);
    setRightGroup(leftGroup);
  };

  const renderReportPane = (report: GroupReport | undefined, side: 'left' | 'right') => {
    if (!report) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          請選擇要比較的報告
        </div>
      );
    }

    const content = report[activeSection];
    const isOverall = report.groupNumber === 0;

    return (
      <motion.div
        key={`${side}-${report.groupNumber}-${activeSection}`}
        initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
        transition={{ duration: 0.3 }}
        className="h-full"
      >
        {/* Group Header */}
        <div className={cn(
          "rounded-t-lg px-4 py-3",
          isOverall
            ? "bg-gradient-to-r from-accent/20 to-secondary/10"
            : "gradient-navy text-primary-foreground"
        )}>
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
          {report.members && (
            <p className="text-xs mt-1 opacity-80">
              👥 {report.members}
            </p>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100%-60px)]">
          <div className="p-4">
            {content ? (
              <EnhancedSection 
                type={activeSection} 
                content={content} 
                showQuotes={activeSection === 'insights'} 
                showKeywords={false} 
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
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
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
      </CardHeader>

      <CardContent className="p-0 flex-1">
        <div className="grid grid-cols-2 divide-x divide-border h-[400px] sm:h-[500px]">
          {/* Left Pane */}
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              {renderReportPane(leftReport, 'left')}
            </AnimatePresence>
          </div>

          {/* Right Pane */}
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              {renderReportPane(rightReport, 'right')}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
