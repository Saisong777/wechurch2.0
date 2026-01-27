import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSessionAnalysis } from '@/hooks/useSessionAnalysis';
import { useUserRole } from '@/hooks/useUserRole';
import { Brain, RefreshCw, Users, Globe, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { parseReportContent, GroupReport } from './report-viewer';
import { EnhancedSection } from './report-elements';

interface AnalysisDashboardProps {
  sessionId: string;
  groups: { number: number; memberCount: number }[];
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ 
  sessionId, 
  groups 
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedGroup, setSelectedGroup] = useState<number | null>(groups[0]?.number || null);
  const { isAdmin, canCreateSession } = useUserRole();

  // Get analysis for current view
  const isGroupView = activeTab !== 'overview';
  const currentGroupNumber = isGroupView ? selectedGroup : undefined;
  const reportType = isGroupView ? 'group' : 'overall';

  const {
    latestAnalysis,
    isLoading,
    isPending,
    isCompleted,
    isFailed,
    isGenerating,
    generateAnalysis,
  } = useSessionAnalysis({
    sessionId,
    groupNumber: currentGroupNumber ?? undefined,
    reportType,
  });

  const handleGenerate = async () => {
    try {
      await generateAnalysis(reportType, currentGroupNumber ?? undefined);
      toast.success('分析報告生成中 Generating analysis...');
    } catch (error) {
      console.error('Generate error:', error);
      toast.error('生成失敗 Generation failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const canRegenerate = isAdmin || canCreateSession;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI 分析儀表板 Analysis Dashboard
          </div>
          {canRegenerate && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating || isPending}
              className="gap-2"
            >
              {isGenerating || isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {latestAnalysis ? '重新生成' : '生成分析'}
                </>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="overview" className="gap-2">
              <Globe className="w-4 h-4" />
              全體報告
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-2">
              <Users className="w-4 h-4" />
              小組報告
            </TabsTrigger>
          </TabsList>

          {/* Group selector when in group view */}
          {activeTab === 'group' && groups.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {groups.map((group) => (
                <Button
                  key={group.number}
                  size="sm"
                  variant={selectedGroup === group.number ? 'default' : 'outline'}
                  onClick={() => setSelectedGroup(group.number)}
                  className="gap-1"
                >
                  第 {group.number} 組
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {group.memberCount}
                  </Badge>
                </Button>
              ))}
            </div>
          )}

          <TabsContent value="overview">
            <AnalysisContent
              analysis={latestAnalysis}
              isLoading={isLoading}
              isPending={isPending}
              isFailed={isFailed}
              isCompleted={isCompleted}
              onGenerate={handleGenerate}
              canGenerate={canRegenerate}
              isGenerating={isGenerating}
            />
          </TabsContent>

          <TabsContent value="group">
            {selectedGroup ? (
              <GroupAnalysisContent
                sessionId={sessionId}
                groupNumber={selectedGroup}
                canGenerate={canRegenerate}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                請選擇一個小組 Select a group
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Separate component for group analysis to manage its own state
const GroupAnalysisContent: React.FC<{
  sessionId: string;
  groupNumber: number;
  canGenerate: boolean;
}> = ({ sessionId, groupNumber, canGenerate }) => {
  const {
    latestAnalysis,
    isLoading,
    isPending,
    isCompleted,
    isFailed,
    isGenerating,
    generateAnalysis,
  } = useSessionAnalysis({
    sessionId,
    groupNumber,
    reportType: 'group',
  });

  const handleGenerate = async () => {
    try {
      await generateAnalysis('group', groupNumber);
      toast.success('小組分析報告生成中...');
    } catch (error) {
      console.error('Generate error:', error);
      toast.error('生成失敗', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <AnalysisContent
      analysis={latestAnalysis}
      isLoading={isLoading}
      isPending={isPending}
      isFailed={isFailed}
      isCompleted={isCompleted}
      onGenerate={handleGenerate}
      canGenerate={canGenerate}
      isGenerating={isGenerating}
    />
  );
};

// Shared analysis content component
const AnalysisContent: React.FC<{
  analysis: { content: string; status: string; createdAt: Date } | null;
  isLoading: boolean;
  isPending: boolean;
  isFailed: boolean;
  isCompleted: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
}> = ({
  analysis,
  isLoading,
  isPending,
  isFailed,
  isCompleted,
  onGenerate,
  canGenerate,
  isGenerating,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="text-center py-12 space-y-4">
        <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
        <div>
          <p className="text-lg font-medium">正在合成小組洞察...</p>
          <p className="text-sm text-muted-foreground">Synthesizing group insights...</p>
        </div>
        <div className="flex justify-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="text-center py-8 space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
        <div>
          <p className="text-lg font-medium text-destructive">生成失敗</p>
          <p className="text-sm text-muted-foreground">{analysis?.content || 'Unknown error'}</p>
        </div>
        {canGenerate && (
          <Button onClick={onGenerate} disabled={isGenerating} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            重試 Retry
          </Button>
        )}
      </div>
    );
  }

  if (!analysis || !isCompleted) {
    return (
      <div className="text-center py-12 space-y-4">
        <Brain className="w-12 h-12 mx-auto text-muted-foreground" />
        <div>
          <p className="text-lg font-medium">尚未生成分析報告</p>
          <p className="text-sm text-muted-foreground">No analysis generated yet</p>
        </div>
        {canGenerate && (
          <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            生成 AI 分析報告
          </Button>
        )}
      </div>
    );
  }

  // Parse report content for display
  const sections = parseReportContent(analysis.content);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-accent" />
          <span>已完成</span>
        </div>
        <span>
          {analysis.createdAt.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      
      {/* Render parsed report content */}
      <ScrollArea className="h-[500px] rounded-md border p-4">
        {sections.length > 0 ? (
          <div className="space-y-6">
            {sections.map((section, idx) => (
              <SimpleGroupSection key={idx} section={section} />
            ))}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {analysis.content}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

// Simple group section renderer for inline display
const SimpleGroupSection: React.FC<{ section: GroupReport }> = ({ section }) => {
  const hasStructuredContent = section.contributions || section.themes || section.observations || section.insights || section.applications;
  
  return (
    <div className="space-y-4">
      {/* Group Header */}
      {section.groupInfo && (
        <div className="rounded-lg bg-primary/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="font-semibold">第 {section.groupNumber} 組</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {section.members && (
              <span>組員：{section.members}</span>
            )}
          </div>
        </div>
      )}

      {/* Structured Content */}
      {hasStructuredContent ? (
        <div className="space-y-4">
          {section.themes && (
            <EnhancedSection type="themes" content={section.themes} />
          )}
          {section.observations && (
            <EnhancedSection type="observations" content={section.observations} />
          )}
          {section.insights && (
            <EnhancedSection type="insights" content={section.insights} />
          )}
          {section.applications && (
            <EnhancedSection type="applications" content={section.applications} />
          )}
          {section.contributions && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                👤 個人貢獻摘要 Personal Contributions
              </h4>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {section.contributions}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {section.raw}
        </div>
      )}
    </div>
  );
};