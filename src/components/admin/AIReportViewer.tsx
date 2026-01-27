import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Copy, Printer, Download, FileText, ChevronDown, Users, FileDown } from 'lucide-react';
import { toast } from 'sonner';

// Import from refactored modules
import {
  parseReportContent,
  generateSectionMarkdown,
  generatePrintHTML,
  downloadBlob,
  openPrintWindow,
  GroupSection,
  GroupReport,
} from './report-viewer';

interface AIReportViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportContent: string | null;
  verseReference?: string;
}

export const AIReportViewer: React.FC<AIReportViewerProps> = ({
  open,
  onOpenChange,
  reportContent,
  verseReference,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const parsedSections = reportContent ? parseReportContent(reportContent) : [];
  
  // Separate group reports (groupNumber > 0) from overall reports (groupNumber === 0)
  const groupReports = parsedSections.filter(s => s.groupNumber > 0);
  const overallReports = parsedSections.filter(s => s.groupNumber === 0);
  const hasMultipleGroups = groupReports.length > 1 || (groupReports.length >= 1 && overallReports.length >= 1);
  
  // --- Copy handlers ---
  const handleCopyAll = () => {
    if (reportContent) {
      navigator.clipboard.writeText(reportContent);
      toast.success('報告已複製到剪貼簿！');
    }
  };

  const handleCopyGroup = (groupNumber: number) => {
    const section = parsedSections.find(s => s.groupNumber === groupNumber);
    if (section) {
      navigator.clipboard.writeText(section.raw);
      toast.success(`第 ${groupNumber} 組報告已複製！`);
    }
  };
  
  // --- Print handlers ---
  const handlePrint = (groupNumber?: number) => {
    const html = generatePrintHTML(parsedSections, verseReference, groupNumber);
    openPrintWindow(html, true);
  };

  // --- Download handlers ---
  const handleDownloadPDF = (groupNumber?: number) => {
    const html = generatePrintHTML(parsedSections, verseReference, groupNumber);
    openPrintWindow(html, true);
    
    const title = groupNumber !== undefined 
      ? `第${groupNumber}組報告`
      : '全部報告';
    
    toast.info(`正在開啟 PDF 預覽...`, {
      description: '請使用瀏覽器的「列印」→「另存為 PDF」功能',
    });
  };
  
  const handleDownloadMarkdownAll = () => {
    if (!parsedSections.length) return;
    
    // Generate structured markdown for all sections
    const allMarkdown = parsedSections
      .map(section => generateSectionMarkdown(section, verseReference))
      .join('\n\n' + '='.repeat(50) + '\n\n');
    
    const blob = new Blob([allMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const filename = `查經報告-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.md`;
    downloadBlob(blob, filename);
    
    toast.success('Markdown 已下載！');
  };

  const handleDownloadMarkdownGroup = (groupNumber: number) => {
    const section = parsedSections.find(s => s.groupNumber === groupNumber);
    if (!section) return;
    
    // Use structured markdown generator instead of raw
    const markdown = generateSectionMarkdown(section, verseReference);
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const filename = `第${groupNumber}組報告-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.md`;
    downloadBlob(blob, filename);
    
    toast.success(`第 ${groupNumber} 組 Markdown 已下載！`);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] sm:max-h-[90vh] h-[100dvh] sm:h-auto p-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
              <span className="truncate">AI 查經分析報告</span>
              {verseReference && (
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2 truncate hidden sm:inline">
                  {verseReference}
                </span>
              )}
            </DialogTitle>
          </div>
          {verseReference && (
            <p className="text-xs text-muted-foreground sm:hidden mt-1 truncate">
              {verseReference}
            </p>
          )}
        </DialogHeader>
        
        {/* Toolbar */}
        <div className="px-3 sm:px-6 py-2 sm:py-3 border-b bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-1.5 h-8 px-2 sm:px-3 text-xs sm:text-sm">
              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">複製全部</span>
              <span className="sm:hidden">複製</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint()} className="gap-1.5 h-8 px-2 sm:px-3 text-xs sm:text-sm hidden sm:flex">
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              列印全部
            </Button>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="gap-1.5 h-8 px-2 sm:px-3 text-xs sm:text-sm">
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">下載報告</span>
                <span className="sm:hidden">下載</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 z-50 bg-popover">
              <DropdownMenuItem onClick={handleDownloadMarkdownAll}>
                <FileText className="w-4 h-4 mr-2" />
                全部報告 (Markdown)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadPDF()}>
                <FileDown className="w-4 h-4 mr-2" />
                全部報告 (PDF)
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem onClick={() => handlePrint()} className="sm:hidden">
                <Printer className="w-4 h-4 mr-2" />
                列印全部
              </DropdownMenuItem>
              
              {hasMultipleGroups && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    個別小組
                  </div>
                  {groupReports.map(section => (
                    <DropdownMenuItem 
                      key={section.groupNumber}
                      onClick={() => handleDownloadMarkdownGroup(section.groupNumber)}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      第 {section.groupNumber} 組 (Markdown)
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Content Area */}
        {hasMultipleGroups ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-3 sm:px-6 pt-2 border-b flex-shrink-0 overflow-x-auto">
              <TabsList className="h-auto p-1 bg-muted/50 flex-nowrap sm:flex-wrap min-w-max sm:min-w-0">
                <TabsTrigger value="all" className="px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  全部 ({parsedSections.length})
                </TabsTrigger>
                {overallReports.length > 0 && (
                  <TabsTrigger value="overall" className="px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                    <span className="hidden sm:inline">全組總結</span>
                    <span className="sm:hidden">總結</span>
                  </TabsTrigger>
                )}
                {groupReports.map(section => (
                  <TabsTrigger key={`tab-${section.groupNumber}`} value={`group-${section.groupNumber}`} className="px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                    <span className="hidden sm:inline">第 {section.groupNumber} 組</span>
                    <span className="sm:hidden">{section.groupNumber}組</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6">
              <TabsContent value="all" className="mt-0 space-y-6 sm:space-y-8">
                <div ref={printRef}>
                  {/* Show overall reports first */}
                  {overallReports.map((section, index) => (
                    <React.Fragment key={`overall-${index}`}>
                      <GroupSection
                        section={{ ...section, groupInfo: '全組總結' }}
                        onCopy={handleCopyGroup}
                        onDownloadMarkdown={handleDownloadMarkdownGroup}
                        onDownloadPDF={handleDownloadPDF}
                        onPrint={handlePrint}
                      />
                      {(index < overallReports.length - 1 || groupReports.length > 0) && (
                        <Separator className="my-6 sm:my-8" />
                      )}
                    </React.Fragment>
                  ))}
                  {/* Then show group reports */}
                  {groupReports.map((section, index) => (
                    <React.Fragment key={`all-${section.groupNumber}`}>
                      <GroupSection
                        section={section}
                        onCopy={handleCopyGroup}
                        onDownloadMarkdown={handleDownloadMarkdownGroup}
                        onDownloadPDF={handleDownloadPDF}
                        onPrint={handlePrint}
                      />
                      {index < groupReports.length - 1 && (
                        <Separator className="my-6 sm:my-8" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </TabsContent>
              
              {/* Overall reports tab */}
              {overallReports.length > 0 && (
                <TabsContent value="overall" className="mt-0 space-y-6">
                  {overallReports.map((section, index) => (
                    <React.Fragment key={`overall-tab-${index}`}>
                      <GroupSection
                        section={{ ...section, groupInfo: '全組總結' }}
                        onCopy={handleCopyGroup}
                        onDownloadMarkdown={handleDownloadMarkdownGroup}
                        onDownloadPDF={handleDownloadPDF}
                        onPrint={handlePrint}
                      />
                      {index < overallReports.length - 1 && (
                        <Separator className="my-6 sm:my-8" />
                      )}
                    </React.Fragment>
                  ))}
                </TabsContent>
              )}
              
              {groupReports.map(section => (
                <TabsContent key={`content-${section.groupNumber}`} value={`group-${section.groupNumber}`} className="mt-0">
                  <GroupSection
                    section={section}
                    onCopy={handleCopyGroup}
                    onDownloadMarkdown={handleDownloadMarkdownGroup}
                    onDownloadPDF={handleDownloadPDF}
                    onPrint={handlePrint}
                  />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6" ref={printRef}>
            <div className="space-y-5 sm:space-y-6">
              {parsedSections.map((section, index) => (
                <React.Fragment key={`single-${index}`}>
                  <GroupSection
                    section={section}
                    showHeader={false}
                    onCopy={handleCopyGroup}
                    onDownloadMarkdown={handleDownloadMarkdownGroup}
                    onDownloadPDF={handleDownloadPDF}
                    onPrint={handlePrint}
                  />
                  {index < parsedSections.length - 1 && (
                    <Separator className="my-5 sm:my-6" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            <span className="hidden sm:inline">報告由 AI 分析助理生成 • </span>
            {new Date().toLocaleDateString('zh-TW')}
            {hasMultipleGroups && <span className="hidden sm:inline"> • 共 {groupReports.length} 組</span>}
          </p>
          <Button variant="gold" size="sm" onClick={() => onOpenChange(false)} className="h-9 px-4 text-sm shrink-0">
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
