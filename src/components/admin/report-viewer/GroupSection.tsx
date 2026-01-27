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
import { Copy, Download, ChevronDown, Users, FileText, FileDown, Printer } from 'lucide-react';
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
  const hasStructuredContent = section.themes || section.observations || section.insights || section.applications;
  
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
        <div className="bg-muted/50 px-5 py-3 border border-t-0 border-border rounded-b-lg">
          {section.members && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">👥 組員：</span> {section.members}
            </p>
          )}
          {section.verse && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">📖 經文：</span> {section.verse}
            </p>
          )}
        </div>
      )}
      
      {/* Structured Sections with Enhanced Visual Elements */}
      {hasStructuredContent ? (
        <div className="space-y-4">
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
        </div>
      ) : (
        <div className="p-5 bg-card border border-border rounded-lg">
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-serif">
            {section.raw}
          </div>
        </div>
      )}
    </div>
  );
};
