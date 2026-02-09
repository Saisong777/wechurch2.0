import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Globe, BookOpen, Share2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { EnhancedSection } from '@/components/admin/report-elements';
import {
  parseReportContent as parseReportContentFull,
  generateSectionMarkdown,
  downloadBlob,
  GroupReport,
} from '@/components/admin/report-viewer';
import { useSessionAnalysis } from '@/hooks/useSessionAnalysis';

interface OverallReportViewerProps {
  sessionId: string;
  verseReference?: string;
}

interface ParsedOverallReport {
  members?: string;
  verse?: string;
  contributions?: string;
  themes?: string;
  observations?: string;
  insights?: string;
  applications?: string;
  raw: string;
}

function parseOverallReport(content: string): ParsedOverallReport {
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

export const OverallReportViewer: React.FC<OverallReportViewerProps> = ({
  sessionId,
  verseReference,
}) => {
  const {
    latestAnalysis,
    isLoading,
    isPending,
    isCompleted,
  } = useSessionAnalysis({
    sessionId,
    reportType: 'overall',
    isParticipant: true,
  });

  const report = isCompleted && latestAnalysis ? latestAnalysis.content : null;
  const reportDate = latestAnalysis?.createdAt || null;

  const handleShare = async () => {
    if (!report) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '全體查經報告',
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

    const parsed = parseOverallReport(report);
    const section: GroupReport = {
      groupNumber: 0,
      groupInfo: '全體綜合分析',
      members: parsed.members,
      verse: parsed.verse,
      contributions: parsed.contributions,
      themes: parsed.themes,
      observations: parsed.observations,
      insights: parsed.insights,
      applications: parsed.applications,
      raw: parsed.raw,
    };
    const markdown = generateSectionMarkdown(section, verseReference);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const filename = `全體報告-${verseReference || 'export'}.md`;
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

  if (isPending) {
    return (
      <Card className="border-muted">
        <CardContent className="py-8 text-center">
          <Loader2 className="w-10 h-10 text-secondary mx-auto mb-3 animate-spin" />
          <p className="text-foreground font-medium">
            正在生成全體報告...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            AI 正在綜合所有參與者的回應，請稍候
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="border-muted">
        <CardContent className="py-8 text-center">
          <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            全體報告尚未生成
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            請等待教練生成 AI 全體分析報告
          </p>
        </CardContent>
      </Card>
    );
  }

  const parsed = parseOverallReport(report);
  const hasStructuredContent = parsed.contributions || parsed.themes || parsed.observations || parsed.insights || parsed.applications;

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <span className="truncate">全體 AI 綜合報告</span>
          </CardTitle>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleShare} className="h-8 px-2 sm:px-3" data-testid="button-share-overall">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">分享</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 w-8 p-0 sm:w-auto sm:px-3" data-testid="button-download-overall">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {reportDate && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            生成於 {reportDate.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-5 p-4 sm:p-6 pt-0 sm:pt-0">
        {verseReference && (
          <div className="bg-gradient-to-r from-muted/60 to-muted/30 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm flex items-start gap-1 sm:gap-2">
              <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span className="font-medium shrink-0">經文：</span>
              <span className="text-muted-foreground italic">{verseReference}</span>
            </p>
            {parsed.members && (
              <p className="text-xs sm:text-sm flex items-start gap-1 sm:gap-2 mt-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="font-medium shrink-0">參與者：</span>
                <span>{parsed.members}</span>
              </p>
            )}
          </div>
        )}

        {hasStructuredContent ? (
          <div className="space-y-4 sm:space-y-5">
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

            {parsed.contributions && (
              <div className="p-3 sm:p-5 border-l-4 rounded-r-lg bg-gradient-to-r from-primary/10 to-primary/5 border-primary shadow-sm">
                <h3 className="flex items-center gap-2 font-bold text-sm sm:text-base mb-3 sm:mb-4 text-primary">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  共同領受 Collective Insights
                </h3>
                <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {parsed.contributions}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 sm:p-4 bg-card border border-border rounded-lg shadow-sm">
            <div className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-6 sm:leading-7">
              {parsed.raw}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
