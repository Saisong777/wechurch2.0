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
import { Copy, Download, ChevronDown, Users, FileText, FileDown, Printer, User } from 'lucide-react';
import { EnhancedSection } from '../report-elements';
import { GroupReport } from './parse';

interface GroupSectionProps {
  section: GroupReport;
  showHeader?: boolean;
  onCopy: (groupNumber: number) => void;
  onDownloadMarkdown: (groupNumber: number) => void;
  onDownloadPDF: (groupNumber: number) => void;
  onPrint: (groupNumber: number) => void;
}

export const GroupSection: React.FC<GroupSectionProps> = ({
  section,
  showHeader = true,
  onCopy,
  onDownloadMarkdown,
  onDownloadPDF,
  onPrint,
}) => {
  const hasStructuredContent = section.contributions || section.themes || section.observations || section.insights || section.applications;
  
  return (
    <div className="group-section space-y-4">
      {/* Group Header */}
      {showHeader && section.groupInfo && (
        <div className="rounded-t-lg gradient-navy text-primary-foreground px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              {section.groupInfo}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-white/20 h-8 px-2"
                onClick={() => onCopy(section.groupNumber)}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary-foreground hover:bg-white/20 h-8 px-2"
                  >
                    <Download className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                    列印此組
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}
      
      {/* Group Meta Info */}
      {(section.members || section.verse) && (
        <div className="bg-gradient-to-r from-muted/60 to-muted/30 px-5 py-4 border border-t-0 border-border rounded-b-lg">
          {section.members && (
            <p className="text-sm flex items-start gap-2">
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
            <p className="text-sm text-muted-foreground mt-2 flex items-start gap-2">
              <span className="font-medium text-foreground shrink-0">📖 經文：</span>
              <span className="italic">{section.verse}</span>
            </p>
          )}
        </div>
      )}
      
      {/* Structured Sections with Enhanced Visual Elements */}
      {hasStructuredContent ? (
        <div className="space-y-5">
          {section.themes && (
            <EnhancedSection type="themes" content={section.themes} showKeywords={false} />
          )}
          
          {section.observations && (
            <EnhancedSection type="observations" content={section.observations} showKeywords={false} />
          )}
          
          {section.insights && (
            <EnhancedSection type="insights" content={section.insights} showQuotes={true} showKeywords={false} />
          )}
          
          {section.applications && (
            <EnhancedSection type="applications" content={section.applications} showKeywords={false} />
          )}
          
          {/* Personal Contributions Section - at the bottom */}
          {section.contributions && (
            <ContributionsSection contributions={section.contributions} />
          )}
        </div>
      ) : (
        <div className="p-5 bg-card border border-border rounded-lg shadow-sm">
          <div className="text-sm text-foreground whitespace-pre-wrap leading-7">
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
          <div key={idx} className="flex gap-2 py-2 border-b border-accent/20 last:border-0">
            <span className="font-bold text-primary shrink-0 min-w-[5rem]">
              {nameMatch[1]}
            </span>
            <span className="text-foreground/90">{nameMatch[2]}</span>
          </div>
        );
      }
      
      // Fallback: just highlight any name patterns
      const namePattern = /([^\s，。、：:]+(?:弟兄|姊妹|姐妹|同學|老師))/g;
      const parts = line.replace(/^[-•]\s*/, '').split(namePattern);
      
      return (
        <div key={idx} className="py-1.5">
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
    <div className="p-5 border-l-4 rounded-r-lg bg-gradient-to-r from-accent/15 to-accent/5 border-accent shadow-sm">
      <h3 className="flex items-center gap-2 font-bold text-base mb-4 text-accent">
        <User className="w-5 h-5" />
        👤 個人貢獻摘要 Personal Contributions
      </h3>
      <div className="text-sm leading-relaxed pl-1">
        {formatContributions(contributions)}
      </div>
    </div>
  );
};
