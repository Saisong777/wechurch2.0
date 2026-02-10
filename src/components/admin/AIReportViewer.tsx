import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
import { Sparkles, Copy, Printer, Download, FileText, ChevronDown, Users, FileDown, BookOpen, LayoutGrid, List, Columns, Presentation, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import {
  parseReportContent,
  generateSectionMarkdown,
  generatePrintHTML,
  downloadBlob,
  openPrintWindow,
  GroupSection,
  GroupReport,
  OverallReportCharts,
  ReportComparison,
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
  const [activeTab, setActiveTab] = useState<'all' | 'overall' | 'compare' | number>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  React.useEffect(() => {
    if (!open) setPresentationMode(false);
  }, [open]);
  
  const parsedSections = reportContent ? parseReportContent(reportContent) : [];
  
  // Filter sections based on search query
  const filteredSections = parsedSections.filter(section => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (section.raw?.toLowerCase().includes(query) || "") ||
      (section.groupInfo && section.groupInfo.toLowerCase().includes(query)) ||
      (section.groupNumber > 0 && `第 ${section.groupNumber} 組`.includes(query))
    );
  });

  // Separate group reports (groupNumber > 0) from overall reports (groupNumber === 0)
  const groupReports = filteredSections.filter(s => s.groupNumber > 0);
  const overallReports = filteredSections.filter(s => s.groupNumber === 0);
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
      toast.success(groupNumber === 0 ? '全組總結已複製！' : `第 ${groupNumber} 組報告已複製！`);
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
    
    toast.info(`正在開啟 PDF 預覽...`, {
      description: '請使用瀏覽器的「列印」→「另存為 PDF」功能',
    });
  };
  
  const handleDownloadMarkdownAll = () => {
    if (!parsedSections.length) return;
    
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
    
    const markdown = generateSectionMarkdown(section, verseReference);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const filename = groupNumber === 0 
      ? `全組總結-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.md`
      : `第${groupNumber}組報告-${verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.md`;
    downloadBlob(blob, filename);
    
    toast.success(groupNumber === 0 ? '全組總結 Markdown 已下載！' : `第 ${groupNumber} 組 Markdown 已下載！`);
  };

  const handlePresentationMode = () => {
    if (!parsedSections.length) return;
    setCurrentSlide(0);
    setPresentationMode(true);
  };

  const presentationSlides = React.useMemo(() => {
    if (!parsedSections.length) return [];
    const groupReportsSorted = parsedSections.filter(s => s.groupNumber > 0).sort((a, b) => a.groupNumber - b.groupNumber);
    const overallReport = parsedSections.find(s => s.groupNumber === 0);
    const slides: { type: 'title' | 'content' | 'end'; title?: string; subtitle?: string; section?: GroupReport }[] = [];
    slides.push({ type: 'title', title: '查經分析報告', subtitle: verseReference || '靈魂健身房' });
    if (overallReport) {
      slides.push({ type: 'content', title: '全會眾綜合分析', section: overallReport });
    }
    for (const section of groupReportsSorted) {
      slides.push({ type: 'content', title: `第 ${section.groupNumber} 組`, section });
    }
    slides.push({ type: 'end', title: '感謝參與', subtitle: '願神的話語常存在我們心中' });
    return slides;
  }, [parsedSections, verseReference]);

  React.useEffect(() => {
    if (!presentationMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, presentationSlides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setPresentationMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentationMode, presentationSlides.length]);

  // Get current content based on active tab
  const getCurrentContent = () => {
    if (activeTab === 'all') {
      return { overallReports, groupReports, showAll: true, showCompare: false };
    } else if (activeTab === 'overall') {
      return { overallReports, groupReports: [], showAll: false, showCompare: false };
    } else if (activeTab === 'compare') {
      return { overallReports: [], groupReports: [], showAll: false, showCompare: true };
    } else {
      const group = groupReports.find(s => s.groupNumber === activeTab);
      return { overallReports: [], groupReports: group ? [group] : [], showAll: false, showCompare: false };
    }
  };

  const { overallReports: visibleOverall, groupReports: visibleGroups, showAll, showCompare } = getCurrentContent();
  
  if (presentationMode) {
    const slide = presentationSlides[currentSlide];
    const formatSlideContent = (text?: string) => {
      if (!text) return null;
      return text.replace(/\*\*/g, '').replace(/^[-•]\s*/gm, '').split('\n').filter(l => l.trim()).map((line, i) => (
        <div key={i} className="py-0.5 text-sm sm:text-base leading-relaxed">{line.trim()}</div>
      ));
    };
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <span className="text-white/60 text-xs sm:text-sm">
            {currentSlide + 1} / {presentationSlides.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPresentationMode(false)}
            className="text-white/70 hover:text-white"
            data-testid="button-close-presentation"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto">
          {slide?.type === 'title' || slide?.type === 'end' ? (
            <div className="text-center">
              <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.3)' }}>
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="text-xl sm:text-2xl text-white/80">{slide.subtitle}</p>
              )}
              {slide.type === 'title' && (
                <p className="mt-6 text-white/50 text-sm">
                  {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          ) : slide?.section ? (
            <div className="w-full max-w-5xl">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  slide.section.groupNumber === 0 ? "text-purple-300" : "text-teal-300"
                )}>
                  {slide.title}
                </h2>
                {slide.section.members && (
                  <span className="text-sm text-white/50 bg-white/10 px-3 py-1 rounded-full">
                    {slide.section.members}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {slide.section.themes && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-green-400">
                    <h3 className="text-green-300 font-semibold text-sm mb-2">主題</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.themes)}</div>
                  </div>
                )}
                {slide.section.observations && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-teal-400">
                    <h3 className="text-teal-300 font-semibold text-sm mb-2">事實發現</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.observations)}</div>
                  </div>
                )}
                {slide.section.insights && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-amber-400">
                    <h3 className="text-amber-300 font-semibold text-sm mb-2">獨特亮光</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.insights)}</div>
                  </div>
                )}
                {slide.section.applications && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-blue-400">
                    <h3 className="text-blue-300 font-semibold text-sm mb-2">如何應用</h3>
                    <div className="text-white/90">{formatSlideContent(slide.section.applications)}</div>
                  </div>
                )}
              </div>
              {slide.section.contributions && (
                <div className="mt-3 sm:mt-4 bg-white/5 backdrop-blur rounded-lg p-3 sm:p-4 border-l-4 border-purple-400">
                  <h3 className="text-purple-300 font-semibold text-sm mb-2">個人貢獻摘要</h3>
                  <div className="text-white/80 text-sm">{formatSlideContent(slide.section.contributions)}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-4 pb-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            className="text-white/70 hover:text-white disabled:opacity-30"
            data-testid="button-prev-slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex gap-1.5">
            {presentationSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === currentSlide ? "bg-white w-6" : "bg-white/30"
                )}
                data-testid={`button-slide-dot-${i}`}
              />
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCurrentSlide(prev => Math.min(prev + 1, presentationSlides.length - 1))}
            disabled={currentSlide === presentationSlides.length - 1}
            className="text-white/70 hover:text-white disabled:opacity-30"
            data-testid="button-next-slide"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
        <p className="text-center text-white/30 text-xs pb-3">使用方向鍵或點擊導航 · ESC 退出</p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] sm:max-h-[90vh] h-[100dvh] sm:h-auto p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
              <span className="truncate">查經分析報告</span>
            </DialogTitle>
            {verseReference && (
              <Badge variant="secondary" className="hidden sm:flex items-center gap-1 font-normal">
                <BookOpen className="w-3 h-3" />
                {verseReference}
              </Badge>
            )}
          </div>
          {verseReference && (
            <p className="text-xs text-muted-foreground sm:hidden mt-1 truncate flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {verseReference}
            </p>
          )}
        </DialogHeader>
        
        {/* Quick Navigation Bar - Only show when multiple groups */}
        {hasMultipleGroups && (
          <div className="px-3 sm:px-6 py-2 sm:py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {/* All Reports Button */}
              <Button
                variant={activeTab === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('all')}
                className={cn(
                  "gap-1.5 h-9 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all",
                  activeTab === 'all' && "shadow-md"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">全部報告</span>
                <span className="sm:hidden">全部</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {parsedSections.length}
                </Badge>
              </Button>

              {/* Compare Button - Only when 2+ groups */}
              {groupReports.length >= 2 && (
                <Button
                  variant={activeTab === 'compare' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('compare')}
                  className={cn(
                    "gap-1.5 h-9 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all",
                    activeTab === 'compare' && "shadow-md bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                  )}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">報告比對</span>
                  <span className="sm:hidden">比對</span>
                </Button>
              )}

              {/* Separator */}
              <div className="h-6 w-px bg-border shrink-0" />

              {/* Overall Summary Button */}
              {overallReports.length > 0 && (
                <Button
                  variant={activeTab === 'overall' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('overall')}
                  className={cn(
                    "gap-1.5 h-9 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all",
                    activeTab === 'overall' && "bg-accent text-accent-foreground shadow-sm ring-1 ring-accent"
                  )}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">全組總結</span>
                  <span className="sm:hidden">總結</span>
                </Button>
              )}

              {/* Group Buttons */}
              {groupReports.map(section => (
                <Button
                  key={`nav-${section.groupNumber}`}
                  variant={activeTab === section.groupNumber ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab(section.groupNumber)}
                  className={cn(
                    "gap-1.5 h-9 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all",
                    activeTab === section.groupNumber && "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">第 {section.groupNumber} 組</span>
                  <span className="sm:hidden">{section.groupNumber}組</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* Toolbar */}
        <div className="px-3 sm:px-6 py-2 border-b bg-background/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative w-40 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋報告內容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs sm:text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-1.5 h-8 px-2 sm:px-3 text-xs sm:text-sm">
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">複製全部</span>
              <span className="sm:hidden">複製</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint()} className="gap-1.5 h-8 px-2 sm:px-3 text-xs sm:text-sm hidden sm:flex">
              <Printer className="w-3.5 h-3.5" />
              列印
            </Button>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="gap-1.5 h-8 px-2 sm:px-3 text-xs sm:text-sm">
                <Download className="w-3.5 h-3.5" />
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
              <DropdownMenuItem onClick={handlePresentationMode}>
                <Presentation className="w-4 h-4 mr-2" />
                簡報模式 (PPT)
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
                    個別下載
                  </div>
                  {overallReports.length > 0 && (
                    <DropdownMenuItem onClick={() => handleDownloadMarkdownGroup(0)}>
                      <List className="w-4 h-4 mr-2" />
                      全組總結 (Markdown)
                    </DropdownMenuItem>
                  )}
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
        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6" ref={printRef}>
          <div className="space-y-6 sm:space-y-8">
            {/* Comparison View */}
            {showCompare && groupReports.length >= 2 && (
              <ReportComparison 
                groupReports={groupReports}
                overallReport={overallReports[0]}
                onClose={() => setActiveTab('all')}
              />
            )}

            {/* Visualization Charts for Overall View */}
            {!showCompare && (activeTab === 'all' || activeTab === 'overall') && groupReports.length > 1 && (
              <OverallReportCharts 
                groupReports={groupReports} 
                overallReport={overallReports[0]}
                className="mb-6"
              />
            )}

            {/* Overall Reports */}
            {!showCompare && visibleOverall.map((section, index) => (
              <React.Fragment key={`overall-${index}`}>
                <GroupSection
                  section={{ ...section, groupInfo: '📊 全會眾綜合分析' }}
                  onCopy={handleCopyGroup}
                  onDownloadMarkdown={handleDownloadMarkdownGroup}
                  onDownloadPDF={handleDownloadPDF}
                  onPrint={handlePrint}
                  variant="overall"
                />
                {(index < visibleOverall.length - 1 || visibleGroups.length > 0) && showAll && (
                  <div className="relative py-2">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                      各組報告
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))}

            {visibleGroups.length > 0 && (
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">各組查經內容</h3>
                </div>
                {(() => {
                  const groupedByNumber = visibleGroups.reduce((acc, curr) => {
                    const num = curr.groupNumber || 0;
                    if (!acc[num]) acc[num] = [];
                    acc[num].push(curr);
                    return acc;
                  }, {} as Record<number, typeof visibleGroups>);

                  return Object.entries(groupedByNumber)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([groupNum, sections]) => (
                      <div key={`group-wrapper-${groupNum}`} className="space-y-4 border rounded-lg p-4 bg-muted/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-secondary" />
                          <h4 className="font-medium text-sm">第 {groupNum} 組</h4>
                        </div>
                        {sections.map((section, idx) => (
                          <React.Fragment key={`section-${section.groupNumber}-${idx}`}>
                            <GroupSection
                              section={section}
                              onCopy={handleCopyGroup}
                              onDownloadMarkdown={handleDownloadMarkdownGroup}
                              onDownloadPDF={handleDownloadPDF}
                              onPrint={handlePrint}
                            />
                            {idx < sections.length - 1 && <Separator className="my-4" />}
                          </React.Fragment>
                        ))}
                      </div>
                    ));
                })()}
              </div>
            )}

            {/* Empty State */}
            {visibleOverall.length === 0 && visibleGroups.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無報告內容</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {new Date().toLocaleDateString('zh-TW')}
            {hasMultipleGroups && (
              <span className="hidden sm:inline">
                {overallReports.length > 0 && ' • 含全組總結'}
                {groupReports.length > 0 && ` • ${groupReports.length} 個小組`}
              </span>
            )}
          </p>
          <Button variant="gold" size="sm" onClick={() => onOpenChange(false)} className="h-9 px-4 text-sm shrink-0">
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
