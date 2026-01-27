import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Copy, Printer, Download, X, BookOpen, Lightbulb, Target, Search } from 'lucide-react';
import { toast } from 'sonner';

interface AIReportViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportContent: string | null;
  verseReference?: string;
}

// Parse report content into structured sections
function parseReportContent(content: string) {
  const sections: {
    groupInfo?: string;
    members?: string;
    verse?: string;
    themes?: string;
    observations?: string;
    insights?: string;
    applications?: string;
    raw?: string;
  }[] = [];

  // Split by group separators if multiple groups
  const groupReports = content.split(/={40,}/);
  
  for (const groupReport of groupReports) {
    if (!groupReport.trim()) continue;
    
    const section: typeof sections[0] = {};
    
    // Extract group info
    const groupMatch = groupReport.match(/第\s*(\d+)\s*組報告/);
    if (groupMatch) {
      section.groupInfo = `第 ${groupMatch[1]} 組`;
    }
    
    // Extract members
    const membersMatch = groupReport.match(/(?:\*\*)?組員(?:\*\*)?[：:]\s*([^\n]+)/);
    if (membersMatch) {
      section.members = membersMatch[1].trim();
    }
    
    // Extract verse
    const verseMatch = groupReport.match(/(?:\*\*)?查經經文(?:\*\*)?[：:]\s*([^\n]+)/);
    if (verseMatch) {
      section.verse = verseMatch[1].trim();
    }
    
    // Extract themes
    const themesMatch = groupReport.match(/(?:📖\s*)?(?:\*\*)?主題.*?(?:\*\*)?[：:]\s*([\s\S]*?)(?=(?:🔍|💡|🎯|---|\*\*事實|\*\*獨特|\*\*如何|$))/i);
    if (themesMatch) {
      section.themes = themesMatch[1].trim();
    }
    
    // Extract observations
    const obsMatch = groupReport.match(/(?:🔍\s*)?(?:\*\*)?事實發現.*?(?:\*\*)?[：:]\s*([\s\S]*?)(?=(?:💡|🎯|---|\*\*獨特|\*\*如何|$))/i);
    if (obsMatch) {
      section.observations = obsMatch[1].trim();
    }
    
    // Extract insights
    const insightsMatch = groupReport.match(/(?:💡\s*)?(?:\*\*)?獨特亮光.*?(?:\*\*)?[：:]\s*([\s\S]*?)(?=(?:🎯|---|\*\*如何|$))/i);
    if (insightsMatch) {
      section.insights = insightsMatch[1].trim();
    }
    
    // Extract applications
    const appMatch = groupReport.match(/(?:🎯\s*)?(?:\*\*)?如何應用.*?(?:\*\*)?[：:]\s*([\s\S]*?)(?=(?:---|$))/i);
    if (appMatch) {
      section.applications = appMatch[1].trim();
    }
    
    // Store raw content as fallback
    section.raw = groupReport.trim();
    
    sections.push(section);
  }
  
  return sections.length > 0 ? sections : [{ raw: content }];
}

export const AIReportViewer: React.FC<AIReportViewerProps> = ({
  open,
  onOpenChange,
  reportContent,
  verseReference,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  
  const handleCopy = () => {
    if (reportContent) {
      navigator.clipboard.writeText(reportContent);
      toast.success('報告已複製到剪貼簿！');
    }
  };
  
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;
    
    const styles = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Noto Serif TC', serif;
          line-height: 1.8;
          color: #1a1a2e;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          background: #fff;
        }
        
        .print-header {
          text-align: center;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #16a085;
        }
        
        .print-header h1 {
          font-size: 24px;
          color: #16a085;
          margin: 0 0 8px 0;
        }
        
        .print-header p {
          font-size: 14px;
          color: #666;
          margin: 0;
        }
        
        .group-section {
          margin-bottom: 40px;
          page-break-inside: avoid;
        }
        
        .group-header {
          background: linear-gradient(135deg, #16a085 0%, #1abc9c 100%);
          color: white;
          padding: 16px 24px;
          border-radius: 8px 8px 0 0;
          margin-bottom: 0;
        }
        
        .group-header h2 {
          margin: 0;
          font-size: 18px;
        }
        
        .group-meta {
          background: #f8fffe;
          padding: 16px 24px;
          border: 1px solid #e0f2f1;
          border-top: none;
        }
        
        .group-meta p {
          margin: 4px 0;
          font-size: 14px;
          color: #555;
        }
        
        .section {
          margin: 24px 0;
          padding: 20px 24px;
          background: #fafafa;
          border-left: 4px solid #16a085;
          border-radius: 0 8px 8px 0;
        }
        
        .section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #16a085;
        }
        
        .section-icon {
          font-size: 18px;
        }
        
        .section-content {
          font-size: 14px;
          color: #333;
          white-space: pre-wrap;
        }
        
        .section.insights {
          background: #fffbeb;
          border-left-color: #f59e0b;
        }
        
        .section.insights h3 {
          color: #d97706;
        }
        
        .section.applications {
          background: #eff6ff;
          border-left-color: #3b82f6;
        }
        
        .section.applications h3 {
          color: #2563eb;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
        
        @media print {
          body {
            padding: 20px;
          }
          .group-section {
            page-break-inside: avoid;
          }
        }
      </style>
    `;
    
    const content = printRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>查經分析報告 - ${verseReference || '靈魂健身房'}</title>
          ${styles}
        </head>
        <body>
          <div class="print-header">
            <h1>🧠 共同查經分析報告</h1>
            <p>${verseReference || ''} | ${new Date().toLocaleDateString('zh-TW')}</p>
          </div>
          ${content}
          <div class="footer">
            <p>此報告由 靈魂健身房 AI 分析助理 生成</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for fonts to load
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
  
  const handleDownloadMarkdown = () => {
    if (!reportContent) return;
    
    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `查經報告-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Markdown 已下載！');
  };
  
  const parsedSections = reportContent ? parseReportContent(reportContent) : [];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
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
        <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
            <Copy className="w-4 h-4" />
            複製
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            列印
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadMarkdown} className="gap-2">
            <Download className="w-4 h-4" />
            下載 Markdown
          </Button>
        </div>
        
        {/* Report Content */}
        <ScrollArea className="h-[60vh]">
          <div className="p-6 space-y-6" ref={printRef}>
            {parsedSections.map((section, index) => (
              <div key={index} className="group-section">
                {/* Group Header */}
                {section.groupInfo && (
                  <div className="rounded-t-lg gradient-navy text-primary-foreground px-5 py-3">
                    <h2 className="font-bold text-lg">{section.groupInfo}</h2>
                  </div>
                )}
                
                {/* Group Meta Info */}
                {(section.members || section.verse) && (
                  <div className="bg-muted/50 px-5 py-3 border border-t-0 border-border">
                    {section.members && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">組員：</span> {section.members}
                      </p>
                    )}
                    {section.verse && (
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">經文：</span> {section.verse}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Structured Sections */}
                <div className="space-y-4 mt-4">
                  {section.themes && (
                    <div className="p-4 bg-card border border-border rounded-lg">
                      <h3 className="flex items-center gap-2 font-semibold text-primary mb-2">
                        <BookOpen className="w-4 h-4" />
                        📖 主題 Themes
                      </h3>
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {section.themes}
                      </div>
                    </div>
                  )}
                  
                  {section.observations && (
                    <div className="p-4 bg-card border border-border rounded-lg">
                      <h3 className="flex items-center gap-2 font-semibold text-primary mb-2">
                        <Search className="w-4 h-4" />
                        🔍 事實發現 Observations
                      </h3>
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {section.observations}
                      </div>
                    </div>
                  )}
                  
                  {section.insights && (
                    <div className="p-4 bg-secondary/10 border border-secondary/30 rounded-lg">
                      <h3 className="flex items-center gap-2 font-semibold text-secondary mb-2">
                        <Lightbulb className="w-4 h-4" />
                        💡 獨特亮光 Unique Insights
                      </h3>
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {section.insights}
                      </div>
                    </div>
                  )}
                  
                  {section.applications && (
                    <div className="p-4 bg-accent/20 border border-accent/40 rounded-lg">
                      <h3 className="flex items-center gap-2 font-semibold text-accent-foreground mb-2">
                        <Target className="w-4 h-4" />
                        🎯 如何應用 Applications
                      </h3>
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {section.applications}
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback: show raw content if no sections parsed */}
                  {!section.themes && !section.observations && !section.insights && !section.applications && section.raw && (
                    <div className="p-4 bg-card border border-border rounded-lg">
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-serif">
                        {section.raw}
                      </div>
                    </div>
                  )}
                </div>
                
                {index < parsedSections.length - 1 && (
                  <Separator className="mt-6" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            報告由 AI 分析助理生成 • {new Date().toLocaleDateString('zh-TW')}
          </p>
          <Button variant="gold" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
