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
  const hasMultipleGroups = parsedSections.length > 1 && parsedSections[0].groupNumber > 0;
  
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
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-secondary" />
              AI 查經分析報告
              {verseReference && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {verseReference}
                </span>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        {/* Toolbar */}
        <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-2">
              <Copy className="w-4 h-4" />
              複製全部
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint()} className="gap-2">
              <Printer className="w-4 h-4" />
              列印全部
            </Button>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                下載報告
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleDownloadMarkdownAll}>
                <FileText className="w-4 h-4 mr-2" />
                全部報告 (Markdown)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadPDF()}>
                <FileDown className="w-4 h-4 mr-2" />
                全部報告 (PDF)
              </DropdownMenuItem>
              
              {hasMultipleGroups && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    個別小組
                  </div>
                  {parsedSections.filter(s => s.groupNumber > 0).map(section => (
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
            <div className="px-6 pt-2 border-b flex-shrink-0">
              <TabsList className="h-auto p-1 bg-muted/50 flex-wrap">
                <TabsTrigger value="all" className="px-4">
                  全部 ({parsedSections.length} 組)
                </TabsTrigger>
                {parsedSections.filter(s => s.groupNumber > 0).map(section => (
                  <TabsTrigger key={`tab-${section.groupNumber}`} value={`group-${section.groupNumber}`}>
                    第 {section.groupNumber} 組
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <div className="flex-1 min-h-0 overflow-auto p-6">
              <TabsContent value="all" className="mt-0 space-y-8">
                <div ref={printRef}>
                  {parsedSections.map((section, index) => (
                    <React.Fragment key={`all-${section.groupNumber}`}>
                      <GroupSection
                        section={section}
                        onCopy={handleCopyGroup}
                        onDownloadMarkdown={handleDownloadMarkdownGroup}
                        onDownloadPDF={handleDownloadPDF}
                        onPrint={handlePrint}
                      />
                      {index < parsedSections.length - 1 && (
                        <Separator className="my-8" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </TabsContent>
              
              {parsedSections.filter(s => s.groupNumber > 0).map(section => (
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
          <div className="flex-1 min-h-0 overflow-auto p-6" ref={printRef}>
            <div className="space-y-6">
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
                    <Separator className="my-6" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            報告由 AI 分析助理生成 • {new Date().toLocaleDateString('zh-TW')}
            {hasMultipleGroups && ` • 共 ${parsedSections.length} 組`}
          </p>
          <Button variant="gold" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
