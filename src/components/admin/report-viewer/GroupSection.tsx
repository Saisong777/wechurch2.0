// Group section UI component for AI report viewer

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Download, ChevronDown, Users, FileText, FileDown, Printer, User, BarChart3 } from 'lucide-react';
import { EnhancedSection } from '../report-elements';
import { GroupReport } from './parse';
import { cn } from '@/lib/utils';

interface GroupSectionProps {
  section: GroupReport;
  showHeader?: boolean;
  variant?: 'default' | 'overall';
  onCopy: (groupNumber: number) => void;
  onDownloadMarkdown: (groupNumber: number) => void;
  onDownloadPDF: (groupNumber: number) => void;
  onPrint: (groupNumber: number) => void;
}

export const GroupSection: React.FC<GroupSectionProps> = ({
  section,
  showHeader = true,
  variant = 'default',
  onCopy,
  onDownloadMarkdown,
  onDownloadPDF,
  onPrint,
}) => {
  const isNewFormat = !!(section.topic || section.theology || section.highlights || section.divergence || section.soulGym || section.summary);
  const hasStructuredContent = section.contributions || section.themes || section.observations || section.insights || section.applications
    || section.topic || section.theology || section.highlights || section.divergence || section.soulGym || section.summary;
  const isOverall = variant === 'overall' || section.groupNumber === 0;
  
  return (
    <div className={cn(
      "group-section space-y-3 sm:space-y-4",
      isOverall && "ring-1 ring-accent/30 rounded-xl p-1"
    )}>
      {/* Group Header */}
      {showHeader && section.groupInfo && (
        <div className={cn(
          "rounded-t-lg px-3 sm:px-5 py-3 sm:py-4",
          isOverall 
            ? "bg-gradient-to-r from-accent/20 via-accent/10 to-secondary/10 text-foreground border border-b-0 border-accent/20" 
            : "gradient-navy text-primary-foreground"
        )}>
          <div className="flex items-center justify-between">
            <h2 className={cn(
              "font-bold text-base sm:text-lg flex items-center gap-2",
              isOverall && "text-accent"
            )}>
              {isOverall ? (
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              {section.groupInfo}
            </h2>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 sm:px-2 sm:w-auto",
                  isOverall 
                    ? "text-accent hover:bg-accent/20" 
                    : "text-primary-foreground hover:bg-white/20"
                )}
                onClick={() => onCopy(section.groupNumber)}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-2",
                      isOverall 
                        ? "text-accent hover:bg-accent/20" 
                        : "text-primary-foreground hover:bg-white/20"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50 bg-popover">
                  <DropdownMenuItem onClick={() => onDownloadMarkdown(section.groupNumber)}>
                    <FileText className="w-4 h-4 mr-2" />
                    下載 Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownloadPDF(section.groupNumber)}>
                    <FileDown className="w-4 h-4 mr-2" />
                    下載 PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onPrint(section.groupNumber)}>
                    <Printer className="w-4 h-4 mr-2" />
                    {isOverall ? '列印總結' : '列印此組'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}
      
      {/* Group Meta Info */}
      {(section.members || section.verse) && (
        <div className={cn(
          "px-3 sm:px-5 py-3 sm:py-4 border border-t-0 rounded-b-lg",
          isOverall 
            ? "bg-gradient-to-r from-accent/5 to-secondary/5 border-accent/20" 
            : "bg-gradient-to-r from-muted/60 to-muted/30 border-border"
        )}>
          {section.members && (
            <p className="text-xs sm:text-sm flex flex-wrap items-start gap-1 sm:gap-2">
              <span className="font-medium text-foreground shrink-0">👥 組員：</span>
              <span className="text-muted-foreground">
                {section.members.split(/[,，、]/).map((name, idx, arr) => (
                  <span key={idx}>
                    <span className="font-medium text-primary">{name.trim()}</span>
                    {idx < arr.length - 1 && <span className="text-muted-foreground">、</span>}
                  </span>
                ))}
              </span>
            </p>
          )}
          {section.verse && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 flex items-start gap-1 sm:gap-2">
              <span className="font-medium text-foreground shrink-0">📖 經文：</span>
              <span className="italic">{section.verse}</span>
            </p>
          )}
        </div>
      )}
      
      {/* Structured Sections with Enhanced Visual Elements */}
      {hasStructuredContent ? (
        <div className="space-y-4 sm:space-y-5">
          {isNewFormat ? (
            <>
              {section.topic && <EnhancedSection type="topic" content={section.topic} showKeywords={false} />}
              {section.observations && <EnhancedSection type="observations" content={section.observations} showKeywords={false} />}
              {section.theology && <EnhancedSection type="theology" content={section.theology} showKeywords={false} />}
              {section.applications && <EnhancedSection type="applications" content={section.applications} showKeywords={false} />}
              {section.highlights && <EnhancedSection type="highlights" content={section.highlights} showQuotes={true} showKeywords={false} />}
              {section.divergence && <EnhancedSection type="divergence" content={section.divergence} showKeywords={false} />}
              {section.soulGym && <EnhancedSection type="soulGym" content={section.soulGym} showKeywords={false} />}
              {section.summary && <EnhancedSection type="summary" content={section.summary} showKeywords={false} />}
            </>
          ) : (
            <>
              {section.themes && <EnhancedSection type="themes" content={section.themes} showKeywords={false} />}
              {section.observations && <EnhancedSection type="observations" content={section.observations} showKeywords={false} />}
              {section.insights && <EnhancedSection type="insights" content={section.insights} showQuotes={true} showKeywords={false} />}
              {section.applications && <EnhancedSection type="applications" content={section.applications} showKeywords={false} />}
              {section.contributions && <ContributionsSection contributions={section.contributions} />}
            </>
          )}
        </div>
      ) : (
        <div className={cn(
          "p-3 sm:p-5 border rounded-lg shadow-sm",
          isOverall ? "bg-accent/5 border-accent/20" : "bg-card border-border"
        )}>
          <div className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-6 sm:leading-7">
            {section.raw}
          </div>
        </div>
      )}
    </div>
  );
};

// Separate component for contributions with name highlighting
const ContributionsSection: React.FC<{ contributions: string }> = ({ contributions }) => {
  // Parse contributions to highlight names
  const formatContributions = (text: string): React.ReactNode => {
    const lines = text.split('\n').filter(l => l.trim());
    
    return lines.map((line, idx) => {
      // Pattern: "Name：content" or "Name: content" or "- Name：content"
      const nameMatch = line.match(/^[-•]?\s*([^\s：:]+(?:弟兄|姊妹|姐妹|同學|老師|[A-Za-z]+))[\s]*[：:]\s*(.+)/);
      
      if (nameMatch) {
        return (
          <div key={idx} className="flex flex-col sm:flex-row gap-1 sm:gap-2 py-2 border-b border-accent/20 last:border-0">
            <span className="font-bold text-primary shrink-0 sm:min-w-[5rem]">
              {nameMatch[1]}
            </span>
            <span className="text-foreground/90 text-xs sm:text-sm">{nameMatch[2]}</span>
          </div>
        );
      }
      
      // Fallback: just highlight any name patterns
      const namePattern = /([^\s，。、：:]+(?:弟兄|姊妹|姐妹|同學|老師))/g;
      const parts = line.replace(/^[-•]\s*/, '').split(namePattern);
      
      return (
        <div key={idx} className="py-1.5 text-xs sm:text-sm">
          {parts.map((part, pIdx) => {
            if (namePattern.test(part)) {
              namePattern.lastIndex = 0;
              return <span key={pIdx} className="font-semibold text-primary">{part}</span>;
            }
            return part;
          })}
        </div>
      );
    });
  };
  
  return (
    <div className="p-3 sm:p-5 border-l-4 rounded-r-lg bg-gradient-to-r from-accent/15 to-accent/5 border-accent shadow-sm">
      <h3 className="flex items-center gap-2 font-bold text-sm sm:text-base mb-3 sm:mb-4 text-accent">
        <User className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="hidden sm:inline">👤 個人貢獻摘要 Personal Contributions</span>
        <span className="sm:hidden">👤 個人貢獻</span>
      </h3>
      <div className="text-xs sm:text-sm leading-relaxed pl-1">
        {formatContributions(contributions)}
      </div>
    </div>
  );
};
