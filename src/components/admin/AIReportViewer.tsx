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
  parseSingleReport,
  generateSectionMarkdown,
  generatePrintHTML,
  downloadBlob,
  openPrintWindow,
  GroupSection,
  GroupReport,
  OverallReportCharts,
  ReportComparison,
} from './report-viewer';

// Structured report from DB or generation
export interface ReportItem {
  reportType: string;
  groupNumber: number | null;
  content: string;
}

interface AIReportViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: ReportItem[] | null;
  verseReference?: string;
}

export const AIReportViewer: React.FC<AIReportViewerProps> = ({
  open,
  onOpenChange,
  reports,
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

  // Parse each report individually and assign groupNumber from DB data
  const parsedSections = React.useMemo(() => {
    if (!reports || reports.length === 0) return [];
    return reports.map(r => {
      // Parse each report individually — no score thresholds, no group detection needed
      const section = parseSingleReport(r.content);
      // Set group identification from DB data (reliable)
      section.groupNumber = r.reportType === 'overall' ? 0 : (r.groupNumber || 0);
      section.groupInfo = r.reportType === 'overall'
        ? '📊 全會眾綜合分析'
        : `第 ${r.groupNumber} 組`;
      return section;
    });
  }, [reports]);

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

  // Reconstruct full text for copy
  const allContentText = React.useMemo(() => {
    if (!reports) return '';
    return reports.map(r => r.content).join('\n\n');
  }, [reports]);

  // --- Copy handlers ---
  const handleCopyAll = () => {
    if (allContentText) {
      navigator.clipboard.writeText(allContentText);
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

  // Section card definitions for slides
  const newFormatCards: Array<{ field: keyof GroupReport; label: string; color: string }> = [
    { field: 'topic', label: '📖 本次查經主題', color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-400' },
    { field: 'observations', label: '🔍 共同觀察', color: 'from-teal-500/20 to-teal-500/5 border-teal-400' },
    { field: 'theology', label: '💡 神學亮光', color: 'from-amber-500/20 to-amber-500/5 border-amber-400' },
    { field: 'applications', label: '🎯 共同應用', color: 'from-blue-500/20 to-blue-500/5 border-blue-400' },
    { field: 'highlights', label: '⭐ 亮光語錄', color: 'from-yellow-500/20 to-yellow-500/5 border-yellow-400' },
    { field: 'divergence', label: '🔀 觀點分歧', color: 'from-orange-500/20 to-orange-500/5 border-orange-400' },
    { field: 'soulGym', label: '🏋️ SoulGym 微操練', color: 'from-purple-500/20 to-purple-500/5 border-purple-400' },
    { field: 'summary', label: '✨ 一句話總結', color: 'from-indigo-500/20 to-indigo-500/5 border-indigo-400' },
  ];
  const oldFormatCards: Array<{ field: keyof GroupReport; label: string; color: string }> = [
    { field: 'themes', label: '📖 主題', color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-400' },
    { field: 'observations', label: '🔍 事實發現', color: 'from-teal-500/20 to-teal-500/5 border-teal-400' },
    { field: 'insights', label: '💡 獨特亮光', color: 'from-amber-500/20 to-amber-500/5 border-amber-400' },
    { field: 'applications', label: '🎯 如何應用', color: 'from-blue-500/20 to-blue-500/5 border-blue-400' },
    { field: 'contributions', label: '👤 個人貢獻', color: 'from-purple-500/20 to-purple-500/5 border-purple-400' },
  ];

  type PresentationSlide = {
    type: 'title' | 'section-header' | 'content' | 'end';
    title?: string;
    subtitle?: string;
    members?: string;
    verse?: string;
    cards?: Array<{ field: keyof GroupReport; label: string; color: string; content: string }>;
    groupNumber?: number;
  };

  const presentationSlides = React.useMemo(() => {
    if (!parsedSections.length) return [] as PresentationSlide[];
    const groupReportsSorted = parsedSections.filter(s => s.groupNumber > 0).sort((a, b) => a.groupNumber - b.groupNumber);
    const overallReport = parsedSections.find(s => s.groupNumber === 0);
    const slides: PresentationSlide[] = [];

    // Title slide
    slides.push({ type: 'title', title: '查經分析報告', subtitle: verseReference || '靈魂健身房' });

    // Helper: smart pagination — short cards paired, long cards solo
    const countLines = (text: string) => text.replace(/\*\*/g, '').split('\n').filter(l => l.trim()).length;
    const SHORT_THRESHOLD = 5; // ≤5 lines = short card

    const addSectionSlides = (section: GroupReport, label: string) => {
      const isNewFmt = !!(section.topic || section.theology || section.highlights || section.divergence || section.soulGym || section.summary);
      const cardDefs = isNewFmt ? newFormatCards : oldFormatCards;
      const activeCards = cardDefs
        .filter(c => section[c.field])
        .map(c => ({ ...c, content: section[c.field] as string, lines: countLines(section[c.field] as string) }));

      if (activeCards.length === 0) return;

      // Section header slide
      slides.push({
        type: 'section-header',
        title: label,
        members: section.members,
        verse: section.verse,
        groupNumber: section.groupNumber,
      });

      // Group cards into slides: pair short cards, give long cards their own slide
      let i = 0;
      while (i < activeCards.length) {
        const current = activeCards[i];
        const next = i + 1 < activeCards.length ? activeCards[i + 1] : null;

        // Both short → pair them
        if (current.lines <= SHORT_THRESHOLD && next && next.lines <= SHORT_THRESHOLD) {
          slides.push({ type: 'content', title: label, cards: [current, next], groupNumber: section.groupNumber });
          i += 2;
        } else {
          // Long card or last remaining card → solo slide
          slides.push({ type: 'content', title: label, cards: [current], groupNumber: section.groupNumber });
          i += 1;
        }
      }
    };

    if (overallReport) addSectionSlides(overallReport, '📊 全會眾綜合分析');
    for (const section of groupReportsSorted) {
      addSectionSlides(section, `第 ${section.groupNumber} 組`);
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
    const formatSlideContent = (text?: string, maxLines = 10) => {
      if (!text) return null;
      const lines = text.replace(/\*\*/g, '').replace(/^[-•]\s*/gm, '• ').split('\n').filter(l => l.trim());
      const display = lines.slice(0, maxLines);
      return display.map((line, i) => (
        <div key={i} className="py-1 leading-loose text-xl lg:text-2xl">{line.trim()}</div>
      ));
    };

    const isOverall = slide?.groupNumber === 0;

    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center">
        {/* 16:9 slide container */}
        <div
          className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl overflow-hidden"
          style={{
            width: 'min(100vw, calc(100vh * 16 / 9))',
            height: 'min(100vh, calc(100vw * 9 / 16))',
          }}
        >
          {/* Top bar: slide counter + close */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-4">
            <span className="text-white/40 text-sm lg:text-base font-medium tracking-wider">
              {slide?.title && slide.type === 'content' ? slide.title : ''}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-white/40 text-sm lg:text-base">
                {currentSlide + 1} / {presentationSlides.length}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPresentationMode(false)}
                className="text-white/50 hover:text-white h-7 w-7"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Slide content area */}
          <div className="absolute inset-0 flex items-center justify-center p-12 pt-16 pb-20">
            {/* Title / End slide */}
            {(slide?.type === 'title' || slide?.type === 'end') && (
              <div className="text-center max-w-[80%]">
                <h1 className="text-5xl lg:text-7xl font-bold text-white mb-8" style={{ textShadow: '2px 2px 12px rgba(0,0,0,0.4)' }}>
                  {slide.title}
                </h1>
                {slide.subtitle && (
                  <p className="text-2xl lg:text-4xl text-white/70 font-light">{slide.subtitle}</p>
                )}
                {slide.type === 'title' && (
                  <div className="mt-12 flex items-center justify-center gap-3 text-white/40 text-lg">
                    <span>{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>·</span>
                    <span>WeChurch</span>
                  </div>
                )}
                {slide.type === 'end' && (
                  <div className="mt-12 text-white/30 text-2xl">🙏</div>
                )}
              </div>
            )}

            {/* Section header slide */}
            {slide?.type === 'section-header' && (
              <div className="text-center max-w-[80%]">
                <div className={cn(
                  "inline-block px-6 py-2.5 rounded-full text-lg lg:text-xl font-medium mb-8",
                  isOverall ? "bg-purple-500/20 text-purple-300" : "bg-teal-500/20 text-teal-300"
                )}>
                  {isOverall ? '全會眾報告' : '小組報告'}
                </div>
                <h1 className={cn(
                  "text-5xl lg:text-7xl font-bold mb-8",
                  isOverall ? "text-purple-200" : "text-teal-200"
                )} style={{ textShadow: '2px 2px 12px rgba(0,0,0,0.4)' }}>
                  {slide.title}
                </h1>
                {slide.members && (
                  <p className="text-xl lg:text-2xl text-white/60 mb-4">
                    <span className="text-white/40">👥 組員：</span>{slide.members}
                  </p>
                )}
                {slide.verse && (
                  <p className="text-xl lg:text-2xl text-white/50 italic">
                    <span className="text-white/40">📖 經文：</span>{slide.verse}
                  </p>
                )}
              </div>
            )}

            {/* Content slide: 1 or 2 section cards */}
            {slide?.type === 'content' && slide.cards && (
              <div className={cn(
                "w-full h-full flex flex-col justify-center max-w-[90%]",
                slide.cards.length === 2 ? "gap-5" : ""
              )}>
                {slide.cards.length === 1 ? (
                  /* Solo card: full height, large text */
                  <div
                    className={cn(
                      "bg-gradient-to-br border-l-[6px] rounded-2xl p-8 lg:p-10 flex flex-col overflow-hidden flex-1 min-h-0",
                      slide.cards[0].color
                    )}
                  >
                    <h3 className="text-2xl lg:text-3xl font-bold text-white/90 mb-6 shrink-0">
                      {slide.cards[0].label}
                    </h3>
                    <div className="text-white/85 overflow-auto flex-1 leading-loose">
                      {formatSlideContent(slide.cards[0].content, 12)}
                    </div>
                  </div>
                ) : (
                  /* Two cards side by side */
                  <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
                    {slide.cards.map((card) => (
                      <div
                        key={card.field}
                        className={cn(
                          "bg-gradient-to-br border-l-[5px] rounded-2xl p-7 lg:p-8 flex flex-col overflow-hidden",
                          card.color
                        )}
                      >
                        <h3 className="text-xl lg:text-2xl font-bold text-white/90 mb-4 shrink-0">
                          {card.label}
                        </h3>
                        <div className="text-white/85 overflow-auto flex-1 text-lg lg:text-xl leading-relaxed">
                          {formatSlideContent(card.content, 7)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom navigation bar */}
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-4 py-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
              disabled={currentSlide === 0}
              className="text-white/50 hover:text-white disabled:opacity-20 h-8 w-8"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex gap-1">
              {presentationSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === currentSlide ? "bg-white w-6" : "bg-white/20 w-1.5"
                  )}
                />
              ))}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentSlide(prev => Math.min(prev + 1, presentationSlides.length - 1))}
              disabled={currentSlide === presentationSlides.length - 1}
              className="text-white/50 hover:text-white disabled:opacity-20 h-8 w-8"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Hint below slide */}
        <p className="text-white/20 text-xs mt-3">方向鍵 / 空白鍵導航 · ESC 退出</p>
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
