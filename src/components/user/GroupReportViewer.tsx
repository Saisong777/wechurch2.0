import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Users, BookOpen, Share2, Download, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { EnhancedSection } from '@/components/admin/report-elements';
import {
  parseReportContent as parseReportContentFull,
  generateSectionMarkdown,
  downloadBlob,
  GroupReport,
} from '@/components/admin/report-viewer';
import { useSessionAnalysis } from '@/hooks/useSessionAnalysis';

interface GroupReportViewerProps {
  sessionId: string;
  groupNumber: number;
  verseReference?: string;
}

// Simplified parsed report for single group (compatible with existing UI)
interface ParsedReport {
  members?: string;
  verse?: string;
  contributions?: string;
  themes?: string;
  observations?: string;
  insights?: string;
  applications?: string;
  raw: string;
}

// Convert full GroupReport to simplified ParsedReport for UI compatibility
function parseReportContent(content: string): ParsedReport {
  const sections = parseReportContentFull(content);
  const section = sections[0];
  
  if (!section) {
    return { raw: content };
  }
  
  return {
    members: section.members,
    verse: section.verse,
    contributions: section.contributions,
    themes: section.themes,
    observations: section.observations,
    insights: section.insights,
    applications: section.applications,
    raw: section.raw,
  };
}

// Generate structured Markdown from a parsed report (for downloads)
function generateReportMarkdown(parsed: ParsedReport, groupNumber: number, verseReference?: string): string {
  // Convert ParsedReport to GroupReport format for the shared generator
  const section: GroupReport = {
    groupNumber,
    groupInfo: `第 ${groupNumber} 組`,
    members: parsed.members,
    verse: parsed.verse,
    contributions: parsed.contributions,
    themes: parsed.themes,
    observations: parsed.observations,
    insights: parsed.insights,
    applications: parsed.applications,
    raw: parsed.raw,
  };
  
  return generateSectionMarkdown(section, verseReference);
}

export const GroupReportViewer: React.FC<GroupReportViewerProps> = ({
  sessionId,
  groupNumber,
  verseReference,
}) => {
  // Use the shared hook with polling support
  // isParticipant: true uses edge function to bypass RLS for guest users
  const { 
    latestAnalysis, 
    isLoading, 
    isPending, 
    isCompleted 
  } = useSessionAnalysis({
    sessionId,
    groupNumber,
    reportType: 'group',
    isParticipant: true,
  });

  const report = isCompleted && latestAnalysis ? latestAnalysis.content : null;
  const reportDate = latestAnalysis?.createdAt || null;

  const handleShare = async () => {
    if (!report) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `第 ${groupNumber} 組查經報告`,
          text: report,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    toast.success('報告已複製！');
  };

  const handleDownload = () => {
    if (!report) return;
    
    // Use structured markdown generator for consistent download
    const parsed = parseReportContent(report);
    const markdown = generateReportMarkdown(parsed, groupNumber, verseReference);
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const filename = `第${groupNumber}組報告-${verseReference || 'export'}.md`;
    downloadBlob(blob, filename);
    
    toast.success('已下載！');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Show pending state with spinner when report is being generated
  if (isPending) {
    return (
      <Card className="border-muted">
        <CardContent className="py-8 text-center">
          <Loader2 className="w-10 h-10 text-secondary mx-auto mb-3 animate-spin" />
          <p className="text-foreground font-medium">
            正在生成小組報告...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            AI 正在整合組員的 insights，請稍候
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="border-muted">
        <CardContent className="py-8 text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            小組報告尚未生成
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            請等待教練生成 AI 分析報告
          </p>
        </CardContent>
      </Card>
    );
  }

  const parsed = parseReportContent(report);
  const hasStructuredContent = parsed.contributions || parsed.themes || parsed.observations || parsed.insights || parsed.applications;


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-secondary" />
            第 {groupNumber} 組 AI 分析報告
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-1" />
              分享
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {reportDate && (
          <p className="text-xs text-muted-foreground">
            生成於 {reportDate.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Group Meta Info */}
        {(parsed.members || parsed.verse) && (
          <div className="bg-gradient-to-r from-muted/60 to-muted/30 p-4 rounded-lg">
            {parsed.members && (
              <p className="text-sm flex items-start gap-2">
                <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="font-medium shrink-0">組員：</span> 
                <span>
                  {parsed.members.split(/[,，、]/).map((name, idx, arr) => (
                    <span key={idx}>
                      <span className="font-medium text-primary">{name.trim()}</span>
                      {idx < arr.length - 1 && <span className="text-muted-foreground">、</span>}
                    </span>
                  ))}
                </span>
              </p>
            )}
            {parsed.verse && (
              <p className="text-sm flex items-start gap-2 mt-2">
                <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="font-medium shrink-0">經文：</span>
                <span className="text-muted-foreground italic">{parsed.verse}</span>
              </p>
            )}
          </div>
        )}

        {/* Structured Sections */}
        {hasStructuredContent ? (
          <div className="space-y-5">
            {parsed.themes && (
              <EnhancedSection type="themes" content={parsed.themes} showKeywords={false} />
            )}
            
            {parsed.observations && (
              <EnhancedSection type="observations" content={parsed.observations} showKeywords={false} />
            )}
            
            {parsed.insights && (
              <EnhancedSection type="insights" content={parsed.insights} showQuotes={true} showKeywords={false} />
            )}
            
            {parsed.applications && (
              <EnhancedSection type="applications" content={parsed.applications} showKeywords={false} />
            )}
            
            {/* Personal Contributions Section - at the bottom */}
            {parsed.contributions && (
              <ContributionsSectionUser contributions={parsed.contributions} />
            )}
          </div>
        ) : (
          <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
            <div className="text-sm text-foreground whitespace-pre-wrap leading-7">
              {parsed.raw}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Separate component for contributions with name highlighting
const ContributionsSectionUser: React.FC<{ contributions: string }> = ({ contributions }) => {
  const formatContributions = (text: string): React.ReactNode => {
    const lines = text.split('\n').filter(l => l.trim());
    
    return lines.map((line, idx) => {
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
