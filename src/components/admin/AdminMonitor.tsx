import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { useRealtime } from '@/hooks/useRealtime';
import { fetchSubmissions, generateAIReport, exportSubmissionsAsCSV } from '@/lib/supabase-helpers';
import { Users, FileText, CheckCircle, Clock, Sparkles, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export const AdminMonitor: React.FC = () => {
  const { currentSession, users, submissions, setSubmissions, addSubmission } = useSession();
  const [isGeneratingGroup, setIsGeneratingGroup] = useState(false);
  const [isGeneratingOverall, setIsGeneratingOverall] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Real-time submission updates
  useRealtime({
    sessionId: currentSession?.id || null,
    onSubmissionAdded: (submission) => {
      addSubmission(submission);
      toast.success(`${submission.name} 已提交筆記！`);
    },
  });

  // Load existing submissions on mount
  useEffect(() => {
    const loadSubmissions = async () => {
      if (currentSession?.id) {
        const subs = await fetchSubmissions(currentSession.id);
        setSubmissions(subs);
      }
    };
    loadSubmissions();
  }, [currentSession?.id, setSubmissions]);

  const groups = currentSession?.groups || [];
  const submittedCount = submissions.length;
  const totalCount = users.length;

  const handleGenerateGroupSummary = async () => {
    if (!currentSession?.id || groups.length === 0) return;
    
    setIsGeneratingGroup(true);
    let allReports = '';
    
    for (const group of groups) {
      toast.info(`正在生成第 ${group.number} 組摘要...`);
      const result = await generateAIReport(currentSession.id, 'group', group.number);
      
      if (result.success && result.report) {
        allReports += `\n\n${'='.repeat(50)}\n第 ${group.number} 組報告\n${'='.repeat(50)}\n\n${result.report}`;
      } else {
        toast.error(`第 ${group.number} 組生成失敗: ${result.error}`);
      }
    }
    
    if (allReports) {
      setReportContent(allReports);
      setShowReportDialog(true);
      toast.success('所有小組摘要已生成！');
    }
    
    setIsGeneratingGroup(false);
  };

  const handleGenerateOverallInsight = async () => {
    if (!currentSession?.id) return;
    
    setIsGeneratingOverall(true);
    toast.info('正在生成整體洞察報告...');
    
    const result = await generateAIReport(currentSession.id, 'overall');
    
    if (result.success && result.report) {
      setReportContent(result.report);
      setShowReportDialog(true);
      toast.success('整體洞察報告已生成！');
    } else {
      toast.error(`生成失敗: ${result.error}`);
    }
    
    setIsGeneratingOverall(false);
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) {
      toast.error('目前沒有提交資料可導出');
      return;
    }
    
    const csv = exportSubmissionsAsCSV(submissions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bible-study-${currentSession?.verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV 已導出！');
  };

  const handleCopyReport = () => {
    if (reportContent) {
      navigator.clipboard.writeText(reportContent);
      toast.success('報告已複製到剪貼簿！');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Session Header */}
      <Card variant="highlight">
        <CardContent className="py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground">今日經文</p>
              <p className="font-serif text-xl font-bold text-foreground">
                {currentSession?.verseReference}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{submittedCount}/{totalCount}</p>
                <p className="text-sm text-muted-foreground">已提交</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => {
          const groupSubmissions = submissions.filter(s => s.groupNumber === group.number);
          const allSubmitted = groupSubmissions.length === group.members.length;

          return (
            <Card key={group.id} className={allSubmitted ? 'border-accent' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-secondary" />
                    第 {group.number} 組
                  </CardTitle>
                  {allSubmitted ? (
                    <span className="flex items-center gap-1 text-sm text-accent">
                      <CheckCircle className="w-4 h-4" />
                      已完成
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {groupSubmissions.length}/{group.members.length}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.members.map((member) => {
                    const hasSubmitted = submissions.some(s => s.userId === member.id);
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-secondary-foreground text-sm font-bold">
                            {member.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{member.name}</span>
                        </div>
                        {hasSubmitted ? (
                          <CheckCircle className="w-5 h-5 text-accent" />
                        ) : (
                          <Clock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Analysis Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" />
            AI 分析 Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="navy"
              size="lg"
              className="w-full"
              onClick={handleGenerateGroupSummary}
              disabled={isGeneratingGroup || submissions.length === 0}
            >
              {isGeneratingGroup ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              生成小組摘要
            </Button>
            <Button
              variant="gold"
              size="lg"
              className="w-full"
              onClick={handleGenerateOverallInsight}
              disabled={isGeneratingOverall || submissions.length === 0}
            >
              {isGeneratingOverall ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              生成整體洞察
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleExportCSV}
              disabled={submissions.length === 0}
            >
              <Download className="w-5 h-5" />
              導出 CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              AI 分析報告
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {reportContent}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCopyReport}>
              複製報告
            </Button>
            <Button variant="gold" onClick={() => setShowReportDialog(false)}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
