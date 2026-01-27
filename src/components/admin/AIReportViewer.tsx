import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { EnhancedSection } from './ReportVisualElements';

interface GroupReport {
  groupNumber: number;
  groupInfo?: string;
  members?: string;
  verse?: string;
  themes?: string;
  observations?: string;
  insights?: string;
  applications?: string;
  raw: string;
}

interface AIReportViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportContent: string | null;
  verseReference?: string;
}

// Clean markdown formatting - remove ** and handle list items
function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
    .replace(/^\s*\*\s+/gm, '• ')        // Replace * at line start with bullet
    .replace(/^\s*-\s+/gm, '• ')         // Replace - at line start with bullet
    .trim();
}

// Parse report content into structured sections
function parseReportContent(content: string): GroupReport[] {
  const sections: GroupReport[] = [];
  const groupIndex = new Map<number, number>();

  const getScore = (s: Partial<GroupReport>) => {
    const len = (v?: string) => (v ? v.trim().length : 0);
    // Prefer structured sections heavily; raw-only headers will score low.
    return (
      len(s.themes) +
      len(s.observations) +
      len(s.insights) +
      len(s.applications) +
      Math.min(len(s.raw), 400) +
      (s.members ? 50 : 0) +
      (s.verse ? 20 : 0)
    );
  };

  // Split by group separators if multiple groups
  const groupReports = content.split(/={40,}/);
  
  for (const groupReport of groupReports) {
    if (!groupReport.trim()) continue;
    
    const section: Partial<GroupReport> = {};
    
    // Extract group number
    const groupMatch = groupReport.match(/第\s*(\d+)\s*組(?:報告)?/);
    if (groupMatch) {
      const groupNum = parseInt(groupMatch[1], 10);
      section.groupNumber = groupNum;
      section.groupInfo = `第 ${groupMatch[1]} 組`;
    }
    
    // Extract members
    const membersMatch = groupReport.match(/(?:\*\*)?組員(?:\*\*)?[：:]\s*([^\n]+)/);
    if (membersMatch) {
      section.members = cleanMarkdown(membersMatch[1]);
    }
    
    // Extract verse
    const verseMatch = groupReport.match(/(?:\*\*)?查經經文(?:\*\*)?[：:]\s*([^\n]+)/);
    if (verseMatch) {
      section.verse = cleanMarkdown(verseMatch[1]);
    }
    
    // Extract themes - handle formats like "**📖 主題（Themes）：**" or "📖 主題 Themes："
    const themesMatch = groupReport.match(/(?:\*\*)?📖?\s*主題[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?🔍|(?:\*\*)?💡|(?:\*\*)?🎯|---|ℹ️|$)/i);
    if (themesMatch) {
      section.themes = cleanMarkdown(themesMatch[1]);
    }
    
    // Extract observations - handle formats like "**🔍 事實發現（Observations）：**"
    const obsMatch = groupReport.match(/(?:\*\*)?🔍?\s*事實發現[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?💡|(?:\*\*)?🎯|---|ℹ️|$)/i);
    if (obsMatch) {
      section.observations = cleanMarkdown(obsMatch[1]);
    }
    
    // Extract insights - handle formats like "**💡 獨特亮光（Unique Insights）：**"
    const insightsMatch = groupReport.match(/(?:\*\*)?💡?\s*獨特亮光[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?🎯|---|ℹ️|$)/i);
    if (insightsMatch) {
      section.insights = cleanMarkdown(insightsMatch[1]);
    }
    
    // Extract applications - handle formats like "**🎯 如何應用（Applications）：**"
    const appMatch = groupReport.match(/(?:\*\*)?🎯?\s*如何應用[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=---|ℹ️|$)/i);
    if (appMatch) {
      section.applications = cleanMarkdown(appMatch[1]);
    }
    
    // Store raw content as fallback - also cleaned
    section.raw = cleanMarkdown(groupReport);

    // If this chunk is just the injected header (e.g. "第 4 組報告") it will have a very low score.
    // We still allow it in temporarily, but will replace it with a richer chunk if we later parse one.
    if (section.groupNumber && section.groupNumber > 0) {
      const idx = groupIndex.get(section.groupNumber);
      if (idx === undefined) {
        groupIndex.set(section.groupNumber, sections.length);
        sections.push(section as GroupReport);
      } else {
        const existing = sections[idx];
        if (getScore(section) > getScore(existing)) {
          sections[idx] = section as GroupReport;
        }
      }
    } else if (section.raw && section.raw.length > 50) {
      // For overall reports or ungrouped content - only if substantial
      sections.push({ groupNumber: 0, raw: section.raw, ...section });
    }
  }
  
  return sections.length > 0 ? sections : [{ groupNumber: 0, raw: cleanMarkdown(content) }];
}

// Generate structured Markdown from a parsed section (for downloads)
function generateSectionMarkdown(section: GroupReport, verseReference?: string): string {
  const lines: string[] = [];
  
  lines.push('### 小組查經整合文件\n');
  
  if (section.groupInfo) {
    lines.push(`**組別：** ${section.groupInfo}\n`);
  }
  
  if (section.members) {
    lines.push(`**組員：** ${section.members}\n`);
  }
  
  if (section.verse || verseReference) {
    lines.push(`**查經經文：** ${section.verse || verseReference}\n`);
  }
  
  lines.push('---\n');
  
  if (section.themes) {
    lines.push(`**📖 主題（Themes）：**\n${section.themes}\n`);
  }
  
  if (section.observations) {
    lines.push(`**🔍 事實發現（Observations）：**\n${section.observations}\n`);
  }
  
  if (section.insights) {
    lines.push(`**💡 獨特亮光（Unique Insights）：**\n${section.insights}\n`);
  }
  
  if (section.applications) {
    lines.push(`**🎯 如何應用（Applications）：**\n${section.applications}\n`);
  }
  
  // If no structured content, fall back to raw
  const hasStructured = section.themes || section.observations || section.insights || section.applications;
  if (!hasStructured && section.raw) {
    lines.push(section.raw);
  }
  
  return lines.join('\n');
}

// Generate print-ready HTML for a single group or all groups
function generatePrintHTML(sections: GroupReport[], verseReference?: string, singleGroup?: number): string {
  const filteredSections = singleGroup !== undefined 
    ? sections.filter(s => s.groupNumber === singleGroup)
    : sections;

  const styles = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap');
      
      * { box-sizing: border-box; }
      
      body {
        font-family: 'Noto Serif TC', serif;
        line-height: 1.9;
        color: #1a1a2e;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
        background: #fff;
      }
      
      .print-header {
        text-align: center;
        margin-bottom: 36px;
        padding-bottom: 28px;
        border-bottom: 3px solid #16a085;
      }
      
      .print-header h1 {
        font-size: 26px;
        color: #16a085;
        margin: 0 0 12px 0;
        letter-spacing: 2px;
      }
      
      .print-header p {
        font-size: 15px;
        color: #666;
        margin: 0;
      }
      
      .group-section {
        margin-bottom: 48px;
        page-break-inside: avoid;
      }
      
      .group-header {
        background: linear-gradient(135deg, #16a085 0%, #1abc9c 100%);
        color: white;
        padding: 18px 28px;
        border-radius: 10px 10px 0 0;
        margin-bottom: 0;
      }
      
      .group-header h2 {
        margin: 0;
        font-size: 20px;
        letter-spacing: 1px;
      }
      
      .group-meta {
        background: #f0fdf4;
        padding: 18px 28px;
        border: 1px solid #e0f2f1;
        border-top: none;
        border-radius: 0 0 0 0;
      }
      
      .group-meta p {
        margin: 6px 0;
        font-size: 14px;
        color: #555;
      }
      
      .section {
        margin: 24px 0;
        padding: 22px 28px;
        background: #fafafa;
        border-left: 5px solid #16a085;
        border-radius: 0 10px 10px 0;
      }
      
      .section h3 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 14px 0;
        font-size: 17px;
        color: #16a085;
        font-weight: 600;
      }
      
      .section-content {
        font-size: 15px;
        color: #333;
        white-space: pre-wrap;
        line-height: 1.9;
      }
      
      .section.themes { border-left-color: #22c55e; }
      .section.themes h3 { color: #16a34a; }
      
      .section.observations { border-left-color: #16a085; }
      .section.observations h3 { color: #0d9488; }
      
      .section.insights {
        background: #fffbeb;
        border-left-color: #f59e0b;
      }
      .section.insights h3 { color: #d97706; }
      
      .section.applications {
        background: #eff6ff;
        border-left-color: #3b82f6;
      }
      .section.applications h3 { color: #2563eb; }
      
      .footer {
        margin-top: 48px;
        padding-top: 24px;
        border-top: 2px solid #e0e0e0;
        text-align: center;
        font-size: 13px;
        color: #999;
      }
      
      @media print {
        body { padding: 24px; }
        .group-section { page-break-inside: avoid; }
        .print-header { page-break-after: avoid; }
      }
    </style>
  `;
  
  const groupsHTML = filteredSections.map(section => {
    const hasStructuredContent = section.themes || section.observations || section.insights || section.applications;
    
    return `
      <div class="group-section">
        ${section.groupInfo ? `
          <div class="group-header">
            <h2>📚 ${section.groupInfo}</h2>
          </div>
        ` : ''}
        
        ${(section.members || section.verse) ? `
          <div class="group-meta">
            ${section.members ? `<p><strong>👥 組員：</strong>${section.members}</p>` : ''}
            ${section.verse ? `<p><strong>📖 經文：</strong>${section.verse}</p>` : ''}
          </div>
        ` : ''}
        
        ${hasStructuredContent ? `
          ${section.themes ? `
            <div class="section themes">
              <h3>📖 主題 Themes</h3>
              <div class="section-content">${section.themes}</div>
            </div>
          ` : ''}
          
          ${section.observations ? `
            <div class="section observations">
              <h3>🔍 事實發現 Observations</h3>
              <div class="section-content">${section.observations}</div>
            </div>
          ` : ''}
          
          ${section.insights ? `
            <div class="section insights">
              <h3>💡 獨特亮光 Unique Insights</h3>
              <div class="section-content">${section.insights}</div>
            </div>
          ` : ''}
          
          ${section.applications ? `
            <div class="section applications">
              <h3>🎯 如何應用 Applications</h3>
              <div class="section-content">${section.applications}</div>
            </div>
          ` : ''}
        ` : `
          <div class="section">
            <div class="section-content">${section.raw}</div>
          </div>
        `}
      </div>
    `;
  }).join('');
  
  const title = singleGroup !== undefined 
    ? `第 ${singleGroup} 組查經報告`
    : '共同查經分析報告';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${verseReference || '靈魂健身房'}</title>
        ${styles}
      </head>
      <body>
        <div class="print-header">
          <h1>🧠 ${title}</h1>
          <p>${verseReference || ''} | ${new Date().toLocaleDateString('zh-TW')}</p>
        </div>
        ${groupsHTML}
        <div class="footer">
          <p>此報告由 靈魂健身房 AI 分析助理 生成</p>
          <p>${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
      </body>
    </html>
  `;
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
  
  const handlePrint = (groupNumber?: number) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = generatePrintHTML(parsedSections, verseReference, groupNumber);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for fonts to load
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleDownloadPDF = (groupNumber?: number) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = generatePrintHTML(parsedSections, verseReference, groupNumber);
    printWindow.document.write(html);
    printWindow.document.close();
    
    const title = groupNumber !== undefined 
      ? `第${groupNumber}組報告`
      : '全部報告';
    
    toast.info(`正在開啟 PDF 預覽...`, {
      description: '請使用瀏覽器的「列印」→「另存為 PDF」功能',
    });
    
    setTimeout(() => {
      printWindow.print();
    }, 600);
  };
  
  const handleDownloadMarkdownAll = () => {
    if (!parsedSections.length) return;
    
    // Generate structured markdown for all sections
    const allMarkdown = parsedSections
      .map(section => generateSectionMarkdown(section, verseReference))
      .join('\n\n' + '='.repeat(50) + '\n\n');
    
    const blob = new Blob([allMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `查經報告-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Markdown 已下載！');
  };

  const handleDownloadMarkdownGroup = (groupNumber: number) => {
    const section = parsedSections.find(s => s.groupNumber === groupNumber);
    if (!section) return;
    
    // Use structured markdown generator instead of raw
    const markdown = generateSectionMarkdown(section, verseReference);
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `第${groupNumber}組報告-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`第 ${groupNumber} 組 Markdown 已下載！`);
  };

  // Render a single group section
  const renderGroupSection = (section: GroupReport, showHeader = true) => {
    const hasStructuredContent = section.themes || section.observations || section.insights || section.applications;
    
    return (
      <div key={section.groupNumber} className="group-section space-y-4">
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
                  onClick={() => handleCopyGroup(section.groupNumber)}
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
                    <DropdownMenuItem onClick={() => handleDownloadMarkdownGroup(section.groupNumber)}>
                      <FileText className="w-4 h-4 mr-2" />
                      下載 Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownloadPDF(section.groupNumber)}>
                      <FileDown className="w-4 h-4 mr-2" />
                      下載 PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePrint(section.groupNumber)}>
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
              <EnhancedSection type="themes" content={section.themes} />
            )}
            
            {section.observations && (
              <EnhancedSection type="observations" content={section.observations} />
            )}
            
            {section.insights && (
              <EnhancedSection type="insights" content={section.insights} showQuotes={true} />
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
                      {renderGroupSection(section)}
                      {index < parsedSections.length - 1 && (
                        <Separator className="my-8" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </TabsContent>
              
              {parsedSections.filter(s => s.groupNumber > 0).map(section => (
                <TabsContent key={`content-${section.groupNumber}`} value={`group-${section.groupNumber}`} className="mt-0">
                  {renderGroupSection(section)}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto p-6" ref={printRef}>
            <div className="space-y-6">
              {parsedSections.map((section, index) => (
                <React.Fragment key={`single-${index}`}>
                  {renderGroupSection(section, false)}
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
