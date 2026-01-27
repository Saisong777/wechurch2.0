import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Users, BookOpen, Search, Lightbulb, Target, Share2, Download } from 'lucide-react';
import { fetchAIReports } from '@/lib/supabase-helpers';
import { toast } from 'sonner';
import { 
  EnhancedSection, 
  extractKeywords,
  KeywordTagCloud 
} from '@/components/admin/ReportVisualElements';

interface GroupReportViewerProps {
  sessionId: string;
  groupNumber: number;
  verseReference?: string;
}

interface ParsedReport {
  members?: string;
  verse?: string;
  themes?: string;
  observations?: string;
  insights?: string;
  applications?: string;
  raw: string;
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

function parseReportContent(content: string): ParsedReport {
  const result: ParsedReport = { raw: cleanMarkdown(content) };
  
  // Extract members
  const membersMatch = content.match(/(?:\*\*)?組員(?:\*\*)?[：:]\s*([^\n]+)/);
  if (membersMatch) result.members = cleanMarkdown(membersMatch[1]);
  
  // Extract verse
  const verseMatch = content.match(/(?:\*\*)?查經經文(?:\*\*)?[：:]\s*([^\n]+)/);
  if (verseMatch) result.verse = cleanMarkdown(verseMatch[1]);
  
  // Extract themes - handle formats like "**📖 主題（Themes）：**" or "📖 主題 Themes："
  const themesMatch = content.match(/(?:\*\*)?📖?\s*主題[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?🔍|(?:\*\*)?💡|(?:\*\*)?🎯|---|ℹ️|$)/i);
  if (themesMatch) result.themes = cleanMarkdown(themesMatch[1]);
  
  // Extract observations - handle formats like "**🔍 事實發現（Observations）：**"
  const obsMatch = content.match(/(?:\*\*)?🔍?\s*事實發現[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?💡|(?:\*\*)?🎯|---|ℹ️|$)/i);
  if (obsMatch) result.observations = cleanMarkdown(obsMatch[1]);
  
  // Extract insights - handle formats like "**💡 獨特亮光（Unique Insights）：**"
  const insightsMatch = content.match(/(?:\*\*)?💡?\s*獨特亮光[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?🎯|---|ℹ️|$)/i);
  if (insightsMatch) result.insights = cleanMarkdown(insightsMatch[1]);
  
  // Extract applications - handle formats like "**🎯 如何應用（Applications）：**"
  const appMatch = content.match(/(?:\*\*)?🎯?\s*如何應用[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=---|ℹ️|$)/i);
  if (appMatch) result.applications = cleanMarkdown(appMatch[1]);
  
  return result;
}

// Generate structured Markdown from a parsed report (for downloads)
function generateReportMarkdown(parsed: ParsedReport, groupNumber: number, verseReference?: string): string {
  const lines: string[] = [];
  
  lines.push('### 小組查經整合文件\n');
  lines.push(`**組別：** 第 ${groupNumber} 組\n`);
  
  if (parsed.members) {
    lines.push(`**組員：** ${parsed.members}\n`);
  }
  
  if (parsed.verse || verseReference) {
    lines.push(`**查經經文：** ${parsed.verse || verseReference}\n`);
  }
  
  lines.push('---\n');
  
  if (parsed.themes) {
    lines.push(`**📖 主題（Themes）：**\n${parsed.themes}\n`);
  }
  
  if (parsed.observations) {
    lines.push(`**🔍 事實發現（Observations）：**\n${parsed.observations}\n`);
  }
  
  if (parsed.insights) {
    lines.push(`**💡 獨特亮光（Unique Insights）：**\n${parsed.insights}\n`);
  }
  
  if (parsed.applications) {
    lines.push(`**🎯 如何應用（Applications）：**\n${parsed.applications}\n`);
  }
  
  // If no structured content, fall back to raw
  const hasStructured = parsed.themes || parsed.observations || parsed.insights || parsed.applications;
  if (!hasStructured && parsed.raw) {
    lines.push(parsed.raw);
  }
  
  return lines.join('\n');
}

export const GroupReportViewer: React.FC<GroupReportViewerProps> = ({
  sessionId,
  groupNumber,
  verseReference,
}) => {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      const reports = await fetchAIReports(sessionId, groupNumber);
      
      if (reports.length > 0) {
        setReport(reports[0].content);
        setReportDate(reports[0].createdAt);
      } else {
        setReport(null);
      }
      setLoading(false);
    };
    
    loadReport();
  }, [sessionId, groupNumber]);

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
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `第${groupNumber}組報告-${verseReference || 'export'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('已下載！');
  };

  if (loading) {
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
  const hasStructuredContent = parsed.themes || parsed.observations || parsed.insights || parsed.applications;

  // Extract unique keywords - deduplicate
  const themeKeywords = extractKeywords(parsed.themes || '');
  const observationKeywords = extractKeywords(parsed.observations || '');
  const combinedKeywords = [...new Set([...themeKeywords, ...observationKeywords])].slice(0, 5);

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
        
        {/* Summary keyword cloud at top - deduplicated */}
        {combinedKeywords.length > 0 && (
          <div className="mt-3">
            <KeywordTagCloud keywords={combinedKeywords} variant="themes" />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Group Meta Info */}
        {(parsed.members || parsed.verse) && (
          <div className="bg-muted/50 p-4 rounded-lg">
            {parsed.members && (
              <p className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-medium">組員：</span> 
                <span className="text-muted-foreground">{parsed.members}</span>
              </p>
            )}
            {parsed.verse && (
              <p className="text-sm flex items-center gap-2 mt-1">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="font-medium">經文：</span>
                <span className="text-muted-foreground">{parsed.verse}</span>
              </p>
            )}
          </div>
        )}

        {/* Structured Sections - don't show keywords again since we have summary at top */}
        {hasStructuredContent ? (
          <div className="space-y-4">
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
          </div>
        ) : (
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {parsed.raw}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
