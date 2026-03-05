import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSession } from '@/contexts/SessionContext';
import { useRealtime } from '@/hooks/useRealtime';
import { fetchSubmissions, generateAIReport, exportSubmissionsAsCSV, exportStudyResponsesAsCSV, updateSessionStatus, fetchParticipants, updateSessionAllowLatecomers, updateSessionIcebreakerEnabled } from '@/lib/api-helpers';
import { forceVerifyAllParticipants, fetchParticipantsWithReadyStatus, calculateGroupReadyStatus, GroupReadyStatus, resetAllReadyStatus, clearAllGroupAssignments, regroupParticipants, endStudySession } from '@/lib/admin-helpers';
import { Users, FileText, CheckCircle, Clock, Sparkles, Download, Loader2, AlertCircle, Zap, MapPin, RotateCcw, RefreshCw, Shuffle, UserPlus, Dumbbell, Gamepad2, LogOut, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudyProgressMonitor } from './StudyProgressMonitor';
import { MockDataGenerator } from './MockDataGenerator';
import { AIReportViewer } from './AIReportViewer';
import { useAdminStudyResponses } from '@/hooks/useAdminStudyResponses';
import { useSessionAnalysis } from '@/hooks/useSessionAnalysis';

export const AdminMonitor: React.FC = () => {
  const navigate = useNavigate();
  const { currentSession, users, setUsers, submissions, setSubmissions, addSubmission, setCurrentSession } = useSession();
  const [isGeneratingGroup, setIsGeneratingGroup] = useState(false);
  const [isGeneratingOverall, setIsGeneratingOverall] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [isForceVerifying, setIsForceVerifying] = useState(false);
  const [isResettingReady, setIsResettingReady] = useState(false);
  const [isClearingGroups, setIsClearingGroups] = useState(false);
  const [isRegrouping, setIsRegrouping] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [groupReadyStatus, setGroupReadyStatus] = useState<GroupReadyStatus[]>([]);
  const [allowLatecomers, setAllowLatecomers] = useState(currentSession?.allowLatecomers || false);
  const [icebreakerEnabled, setIcebreakerEnabled] = useState(currentSession?.icebreakerEnabled || false);
  
  // AI generation options
  const [fastMode, setFastMode] = useState(true);  // Default to fast mode
  const [filledOnly, setFilledOnly] = useState(false);
  const [allSubmittedNotified, setAllSubmittedNotified] = useState(false);

  // Fetch study responses to check if we have data for AI analysis
  const { data: studyResponses } = useAdminStudyResponses({ 
    sessionId: currentSession?.id, 
    enabled: !!currentSession?.id 
  });

  // Fetch existing AI reports for viewing
  const { analyses: existingReports, refetch: refetchReports } = useSessionAnalysis({
    sessionId: currentSession?.id || '',
  });

  // Determine if we're in verification phase
  const isVerificationPhase = currentSession?.status === 'grouping';
  const isStudyingPhase = currentSession?.status === 'studying';
  
  // Check if we have any data for AI analysis (either submissions or study responses)
  const hasDataForAnalysis = submissions.length > 0 || (studyResponses && studyResponses.length > 0);
  
  // Calculate study progress - how many have started/completed
  const studyProgressStats = React.useMemo(() => {
    if (!studyResponses) return { notStarted: 0, inProgress: 0, completed: 0, total: 0 };
    
    const notStarted = studyResponses.filter(r => r.progressStatus === 'not_started').length;
    const inProgress = studyResponses.filter(r => 
      r.progressStatus === 'warming_up' || r.progressStatus === 'heavy_lifting'
    ).length;
    const completed = studyResponses.filter(r => r.progressStatus === 'stretching').length;
    
    return { notStarted, inProgress, completed, total: studyResponses.length };
  }, [studyResponses]);
  
  // Check if everyone has completed and show notification
  useEffect(() => {
    if (
      isStudyingPhase && 
      studyProgressStats.total > 0 && 
      studyProgressStats.completed === studyProgressStats.total &&
      !allSubmittedNotified
    ) {
      setAllSubmittedNotified(true);
      toast.success('🎉 全員交卷完成！', {
        description: `所有 ${studyProgressStats.total} 位參與者都已完成健身筆記`,
        duration: 10000,
      });
    }
  }, [isStudyingPhase, studyProgressStats, allSubmittedNotified]);

  // Reset notification flag when session changes
  useEffect(() => {
    setAllSubmittedNotified(false);
  }, [currentSession?.id]);
  
  // Sync allowLatecomers and icebreakerEnabled with session
  useEffect(() => {
    setAllowLatecomers(currentSession?.allowLatecomers || false);
    setIcebreakerEnabled(currentSession?.icebreakerEnabled || false);
  }, [currentSession?.allowLatecomers, currentSession?.icebreakerEnabled]);

  const handleToggleLatecomers = async (checked: boolean) => {
    if (!currentSession?.id) return;
    setAllowLatecomers(checked);
    const success = await updateSessionAllowLatecomers(currentSession.id, checked);
    if (success) {
      setCurrentSession({ ...currentSession, allowLatecomers: checked });
      toast.success(checked ? '已開啟遲到者加入功能' : '已關閉遲到者加入功能');
    } else {
      setAllowLatecomers(!checked); // Revert on failure
      toast.error('更新失敗');
    }
  };

  const handleToggleIcebreaker = async (checked: boolean) => {
    if (!currentSession?.id) return;
    setIcebreakerEnabled(checked);
    const success = await updateSessionIcebreakerEnabled(currentSession.id, checked);
    if (success) {
      setCurrentSession({ ...currentSession, icebreakerEnabled: checked });
      toast.success(checked ? '已開啟真心話不用冒險環節' : '已關閉真心話不用冒險環節');
    } else {
      setIcebreakerEnabled(!checked); // Revert on failure
      toast.error('更新失敗');
    }
  };

  // Refresh ready status
  const refreshReadyStatus = useCallback(async () => {
    if (!currentSession?.id) return;
    const participants = await fetchParticipantsWithReadyStatus(currentSession.id);
    const status = calculateGroupReadyStatus(participants);
    setGroupReadyStatus(status);
    
    // Check if all groups are ready - auto-transition to studying
    const allReady = status.length > 0 && status.every(g => g.allReady);
    if (allReady && isVerificationPhase) {
      await updateSessionStatus(currentSession.id, 'studying');
      setCurrentSession({ ...currentSession, status: 'studying' });
      toast.success('所有組員已確認，開始健身！', {
        description: 'All members verified! Study phase started.',
      });
    }
  }, [currentSession, setCurrentSession, isVerificationPhase]);

  // Real-time submission updates
  useRealtime({
    sessionId: currentSession?.id || null,
    onSubmissionAdded: (submission) => {
      addSubmission(submission);
      toast.success(`${submission.name} 已提交筆記！`);
    },
    onParticipantUpdated: () => {
      // Refresh ready status when any participant updates
      refreshReadyStatus();
    },
  });

  // Load existing data on mount
  useEffect(() => {
    const loadData = async () => {
      if (currentSession?.id) {
        const subs = await fetchSubmissions(currentSession.id);
        setSubmissions(subs);
        await refreshReadyStatus();
        
        // Also refresh user list
        const participants = await fetchParticipants(currentSession.id);
        setUsers(participants);
      }
    };
    loadData();
  }, [currentSession?.id, setSubmissions, setUsers, refreshReadyStatus]);


  // Derive groups from users - more reliable than currentSession.groups
  const groupNumbers = [...new Set(users.filter(u => u.groupNumber).map(u => u.groupNumber))].sort((a, b) => (a || 0) - (b || 0));
  const groups = groupNumbers.map(num => ({
    id: `group-${num}`,
    number: num!,
    members: users.filter(u => u.groupNumber === num),
  }));
  const submittedCount = submissions.length;
  const totalCount = users.length;

  const handleForceVerifyAll = async () => {
    if (!currentSession?.id) return;
    
    setIsForceVerifying(true);
    const result = await forceVerifyAllParticipants(currentSession.id);
    
    if (result.success) {
      toast.success(`已強制確認 ${result.count} 位參與者！`, {
        description: 'All participants marked as ready.',
      });
      await refreshReadyStatus();
    } else {
      toast.error(`操作失敗: ${result.error}`);
    }
    
    setIsForceVerifying(false);
  };

  const handleResetAllReady = async () => {
    if (!currentSession?.id) return;

    setIsResettingReady(true);
    const result = await resetAllReadyStatus(currentSession.id);

    if (result.success) {
      toast.success(`已重置 ${result.count} 位參與者的確認狀態！`, {
        description: 'All ready statuses reset to false.',
      });
      await refreshReadyStatus();
    } else {
      toast.error(`操作失敗: ${result.error}`);
    }

    setIsResettingReady(false);
  };

  const handleClearAllGroups = async () => {
    if (!currentSession?.id) return;

    setIsClearingGroups(true);
    const result = await clearAllGroupAssignments(currentSession.id);

    if (result.success) {
      toast.success(`已清除 ${result.count} 位參與者的小組分配！`, {
        description: 'All group assignments cleared. You can now re-group.',
      });
      // Reset session status to waiting so admin can re-group
      await updateSessionStatus(currentSession.id, 'waiting');
      setCurrentSession({ ...currentSession, status: 'waiting', groups: [] });
      // Refresh participants list
      const participants = await fetchParticipants(currentSession.id);
      setUsers(participants);
      setGroupReadyStatus([]);
    } else {
      toast.error(`操作失敗: ${result.error}`);
    }

    setIsClearingGroups(false);
  };

  const handleRegroupOnly = async () => {
    if (!currentSession?.id) return;

    setIsRegrouping(true);
    const result = await regroupParticipants(currentSession.id);

    if (result.success) {
      toast.success(`已重置 ${result.count} 位參與者的分組！`, {
        description: 'Group assignments cleared. You can now re-group with new settings.',
      });
      // Reset session status to waiting so admin can re-group
      await updateSessionStatus(currentSession.id, 'waiting');
      setCurrentSession({ ...currentSession, status: 'waiting', groups: [] });
      // Refresh participants list
      const participants = await fetchParticipants(currentSession.id);
      setUsers(participants);
      setGroupReadyStatus([]);
    } else {
      toast.error(`操作失敗: ${result.error}`);
    }

    setIsRegrouping(false);
  };

  const handleEndSession = async () => {
    if (!currentSession?.id) return;

    setIsEndingSession(true);
    const result = await endStudySession(currentSession.id);

    if (result.success) {
      toast.success('🎉 查經已結束！', {
        description: '所有資料已封存，可在歷史資料中查看',
        duration: 3000,
      });
      // Clear local session state
      setCurrentSession(null);
      // Redirect host to homepage after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } else {
      toast.error(`操作失敗: ${result.error}`);
      setIsEndingSession(false);
    }
  };

  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const handleDeleteSession = async () => {
    if (!currentSession?.id) return;

    setIsDeletingSession(true);
    try {
      const response = await fetch(`/api/sessions/${currentSession.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete session');

      toast.success('活動已刪除');
      setCurrentSession(null);
      setTimeout(() => navigate('/'), 500);
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('刪除失敗，請重試');
      setIsDeletingSession(false);
    }
  };

  const handleGenerateGroupSummary = async () => {
    if (!currentSession?.id || groups.length === 0) return;
    
    setIsGeneratingGroup(true);
    setGenerationProgress({ current: 0, total: groups.length });
    
    const modeLabel = fastMode ? '快速模式' : '高品質模式';
    toast.info(`開始逐一生成 ${groups.length} 個小組報告 (${modeLabel})...`, {
      description: filledOnly ? '僅分析有填寫內容的成員' : 'AI 正在分析每組的讀經筆記...',
    });
    
    // Generate reports in batches of 2 for speed (Gemini each call ~10-15s, natural throttle)
    const CONCURRENCY = 2;
    const results: { groupNumber: number; result: { success: boolean; report?: string; error?: string } }[] = [];
    for (let i = 0; i < groups.length; i += CONCURRENCY) {
      const batch = groups.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(group => generateAIReport(currentSession.id, 'group', group.number, { fastMode, filledOnly }))
      );
      batchResults.forEach((result, j) => {
        setGenerationProgress(prev => ({ ...prev, current: prev.current + 1 }));
        results.push({ groupNumber: batch[j].number, result });
      });
    }
    
    // Sort by group number and combine
    results.sort((a, b) => a.groupNumber - b.groupNumber);
    
    let allReports = '';
    let successCount = 0;
    
    for (const { groupNumber, result } of results) {
      if (result.success && result.report) {
        allReports += `\n\n${'='.repeat(50)}\n第 ${groupNumber} 組報告\n${'='.repeat(50)}\n\n${result.report}`;
        successCount++;
      } else {
        toast.error(`第 ${groupNumber} 組生成失敗: ${result.error}`);
      }
    }
    
    if (allReports) {
      setReportContent(allReports);
      setShowReportDialog(true);
      toast.success(`成功生成 ${successCount}/${groups.length} 個小組報告！`, {
        description: '每位參與者現在可以在自己的頁面查看小組報告',
      });
      // Refetch reports list
      refetchReports();
    }
    
    setGenerationProgress({ current: 0, total: 0 });
    setIsGeneratingGroup(false);
  };

  const handleGenerateOverallInsight = async () => {
    if (!currentSession?.id) return;
    
    setIsGeneratingOverall(true);
    toast.info('正在生成整體洞察報告 (高品質模式)...', {
      description: filledOnly ? '僅分析有填寫內容的成員' : undefined,
    });
    
    // Overall always uses high-quality model (fastMode=false)
    const result = await generateAIReport(currentSession.id, 'overall', undefined, { fastMode: false, filledOnly });
    
    if (result.success && result.report) {
      setReportContent(result.report);
      setShowReportDialog(true);
      toast.success('整體洞察報告已生成！');
      // Refetch reports list
      refetchReports();
    } else {
      toast.error(`生成失敗: ${result.error}`);
    }
    
    setIsGeneratingOverall(false);
  };

  // Handler to view existing reports
  const handleViewExistingReports = () => {
    if (existingReports.length === 0) {
      toast.info('目前沒有已生成的報告');
      return;
    }
    
    // Combine all group reports for viewing
    const groupReports = existingReports.filter(r => r.reportType === 'group');
    const overallReports = existingReports.filter(r => r.reportType === 'overall');
    
    let combinedContent = '';
    
    // Add overall reports FIRST (so they appear at the top of the viewer)
    for (const report of overallReports) {
      // Use a recognizable format that parse.ts can handle: "第 0 組" pattern for overall
      combinedContent += `\n\n${'='.repeat(50)}\n📊 全會眾綜合分析報告\n組別：第 0 組（全體）\n${'='.repeat(50)}\n\n${report.content}`;
    }
    
    // Add group reports (sorted by group number)
    const sortedGroupReports = [...groupReports].sort((a, b) => 
      (a.groupNumber || 0) - (b.groupNumber || 0)
    );
    
    for (const report of sortedGroupReports) {
      combinedContent += `\n\n${'='.repeat(50)}\n第 ${report.groupNumber} 組報告\n${'='.repeat(50)}\n\n${report.content}`;
    }
    
    if (combinedContent) {
      setReportContent(combinedContent);
      setShowReportDialog(true);
    }
  };

  const handleExportCSV = () => {
    if (!hasDataForAnalysis) {
      toast.error('目前沒有提交資料可導出');
      return;
    }
    
    let csv = '';
    let filename = '';
    
    // Export study responses if available, otherwise fall back to submissions
    if (studyResponses && studyResponses.length > 0) {
      csv = exportStudyResponsesAsCSV(studyResponses);
      filename = `spiritual-fitness-${currentSession?.verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    } else if (submissions.length > 0) {
      csv = exportSubmissionsAsCSV(submissions);
      filename = `bible-study-${currentSession?.verseReference || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      toast.error('目前沒有提交資料可導出');
      return;
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
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

  // Calculate overall ready progress
  const totalReadyCount = groupReadyStatus.reduce((acc, g) => acc + g.readyCount, 0);
  const totalMemberCount = groupReadyStatus.reduce((acc, g) => acc + g.totalMembers, 0);
  const readyPercentage = totalMemberCount > 0 ? (totalReadyCount / totalMemberCount) * 100 : 0;

  // Calculate study phase submission progress
  const studySubmissionPercentage = studyProgressStats.total > 0 
    ? (studyProgressStats.completed / studyProgressStats.total) * 100 
    : 0;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Session Header */}
      <Card variant="highlight">
        <CardContent className="py-4 sm:py-6 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-sm text-muted-foreground">今日經文</p>
              <p className="font-serif text-lg sm:text-xl font-bold text-foreground">
                {currentSession?.verseReference}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <Badge variant={isVerificationPhase ? 'secondary' : isStudyingPhase ? 'default' : 'outline'} className="text-xs sm:text-sm">
                {isVerificationPhase ? '驗證中' : isStudyingPhase ? '健身中' : currentSession?.status}
              </Badge>
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-primary">
                  {isVerificationPhase 
                    ? `${totalReadyCount}/${totalMemberCount}` 
                    : isStudyingPhase 
                      ? `${studyProgressStats.completed}/${studyProgressStats.total}`
                      : `${submittedCount}/${totalCount}`
                  }
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {isVerificationPhase ? '已確認' : isStudyingPhase ? '已交卷' : '參與者'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Progress bar for verification phase */}
          {isVerificationPhase && (
            <div className="mt-4 space-y-2">
              <Progress value={readyPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {readyPercentage.toFixed(0)}% 的參與者已確認
              </p>
            </div>
          )}

          {/* Progress bar for study phase - show submission progress */}
          {isStudyingPhase && studyProgressStats.total > 0 && (
            <div className="mt-4 space-y-2">
              <Progress 
                value={studySubmissionPercentage} 
                className={`h-2 ${studyProgressStats.completed === studyProgressStats.total ? 'bg-accent/20' : ''}`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  🔴 尚未開始: {studyProgressStats.notStarted} | 
                  🟡 進行中: {studyProgressStats.inProgress} | 
                  🟢 已完成: {studyProgressStats.completed}
                </span>
                <span>{studySubmissionPercentage.toFixed(0)}%</span>
              </div>
              {studyProgressStats.completed === studyProgressStats.total && (
                <div className="text-center py-2 px-4 bg-accent/10 rounded-lg border border-accent/30">
                  <p className="text-sm font-medium text-accent">🎉 全員交卷完成！</p>
                </div>
              )}
            </div>
          )}

          {/* Session Settings Status - Read-only indicators */}
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <p className="text-xs font-medium text-muted-foreground">課程設定</p>
            
            {/* Icebreaker Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">真心話不用冒險</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                icebreakerEnabled 
                  ? 'bg-accent/20 text-accent' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {icebreakerEnabled ? '已啟用' : '未啟用'}
              </span>
            </div>
            
            {/* Latecomer Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="allow-latecomers" className="text-sm cursor-pointer">遲到加入</Label>
              </div>
              <Switch
                id="allow-latecomers"
                checked={allowLatecomers}
                onCheckedChange={handleToggleLatecomers}
              />
            </div>
            
            {/* End Study Session Button - only show during studying phase */}
            {isStudyingPhase && (
              <div className="pt-3 mt-3 border-t border-border">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="default"
                      className="w-full h-11 gap-2"
                      disabled={isEndingSession}
                    >
                      {isEndingSession ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      結束查經
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-lg">確定要結束查經嗎？</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>此操作將：</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          <li>解散所有 {users.length} 位參與者</li>
                          <li>封存所有查經筆記和報告</li>
                          <li>管理員可在「歷史資料」中查看封存資料</li>
                        </ul>
                        <p className="text-destructive font-medium mt-2">此操作無法復原！</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                      <AlertDialogCancel className="h-11 sm:h-10">取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEndSession} className="bg-destructive hover:bg-destructive/90 h-11 sm:h-10">
                        確定結束
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDeletingSession}
                      data-testid="button-delete-session"
                    >
                      {isDeletingSession ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      刪除活動
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-lg">確定要刪除此活動嗎？</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>此操作將永久刪除：</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          <li>所有參與者資料</li>
                          <li>所有查經筆記和回應</li>
                          <li>所有 AI 報告</li>
                        </ul>
                        <p className="text-destructive font-medium mt-2">此操作無法復原！資料將永久刪除。</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                      <AlertDialogCancel className="h-11 sm:h-10">取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive hover:bg-destructive/90 h-11 sm:h-10">
                        確定刪除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Rescue Tools */}
      {(isVerificationPhase || isStudyingPhase || groups.length > 0) && (
        <Card className="border-accent/50 bg-accent/5">
          <CardContent className="py-4 px-4 sm:px-6 space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground text-sm sm:text-base">管理員救援工具</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  現場出狀況時可快速救援
                </p>
              </div>
            </div>

            {/* Action Buttons - horizontal scroll on mobile */}
            <div className="flex flex-nowrap sm:flex-wrap gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
              {/* Force Verify All */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-accent text-accent hover:bg-accent/10 flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm"
                    disabled={isForceVerifying}
                  >
                    {isForceVerifying ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Zap className="w-4 h-4 mr-1.5" />
                    )}
                    強制確認
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg">確定要強制確認所有參與者嗎？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作會將所有 {totalMemberCount} 位參與者標記為「已確認」，並自動進入查經階段。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <AlertDialogCancel className="h-11 sm:h-10">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleForceVerifyAll} className="h-11 sm:h-10">
                      確定執行
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Reset All Ready Status */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm" 
                    className="border-destructive/70 text-destructive hover:bg-destructive/10 flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm"
                    disabled={isResettingReady}
                  >
                    {isResettingReady ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-1.5" />
                    )}
                    重置確認
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg">確定要重置所有參與者的確認狀態嗎？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作會將所有 {totalMemberCount} 位參與者的「已確認」狀態重置為「未確認」，讓他們需要重新進行組員確認。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <AlertDialogCancel className="h-11 sm:h-10">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetAllReady} className="bg-destructive hover:bg-destructive/90 h-11 sm:h-10">
                      確定重置
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Re-group Only (keep participants) */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm" 
                    className="border-secondary text-secondary hover:bg-secondary/10 flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm"
                    disabled={isRegrouping}
                  >
                    {isRegrouping ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Shuffle className="w-4 h-4 mr-1.5" />
                    )}
                    重新分組
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg">確定要重新分組嗎？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作會清除所有 {totalMemberCount} 位參與者的小組分配，但<strong>保留所有參與者</strong>。
                      <br /><br />
                      您可以使用新的分組設定重新分配小組，或讓新加入的人一起參與分組。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <AlertDialogCancel className="h-11 sm:h-10">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRegroupOnly} className="bg-secondary hover:bg-secondary/90 h-11 sm:h-10">
                      確定重新分組
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Clear All Groups & Re-group */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm" 
                    className="border-destructive text-destructive hover:bg-destructive/10 flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm"
                    disabled={isClearingGroups}
                  >
                    {isClearingGroups ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                    )}
                    清除重來
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg">⚠️ 確定要清除所有分組嗎？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作會清除所有 {totalMemberCount} 位參與者的小組分配，並將 Session 狀態重置為「等待中」，讓您可以重新分組。
                      <br /><br />
                      <strong className="text-destructive">注意：此操作無法復原！</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <AlertDialogCancel className="h-11 sm:h-10">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllGroups} className="bg-destructive hover:bg-destructive/90 h-11 sm:h-10">
                      確定清除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups Overview by Location */}
      {(() => {
        // Organize groups by location
        const groupsData = isVerificationPhase ? groupReadyStatus : groups;
        
        // Group by location
        const locationGroupsMap = new Map<string, typeof groupsData>();
        for (const group of groupsData) {
          const location = 'location' in group ? group.location : 
            (group as any).members?.[0]?.location || 'On-site';
          if (!locationGroupsMap.has(location)) {
            locationGroupsMap.set(location, []);
          }
          locationGroupsMap.get(location)!.push(group as any);
        }
        
        // Sort: On-site first, then others alphabetically
        const sortedLocations = Array.from(locationGroupsMap.keys()).sort((a, b) => {
          if (a === 'On-site') return -1;
          if (b === 'On-site') return 1;
          return a.localeCompare(b);
        });
        
        // Color themes for different locations
        const locationThemes = [
          { bg: 'bg-primary/5', border: 'border-primary/30', header: 'bg-primary/10', icon: 'text-primary' },
          { bg: 'bg-secondary/5', border: 'border-secondary/30', header: 'bg-secondary/10', icon: 'text-secondary' },
          { bg: 'bg-accent/5', border: 'border-accent/30', header: 'bg-accent/10', icon: 'text-accent' },
          { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', header: 'bg-emerald-500/10', icon: 'text-emerald-600' },
          { bg: 'bg-purple-500/5', border: 'border-purple-500/30', header: 'bg-purple-500/10', icon: 'text-purple-600' },
          { bg: 'bg-orange-500/5', border: 'border-orange-500/30', header: 'bg-orange-500/10', icon: 'text-orange-600' },
        ];
        
        return sortedLocations.map((location, locIndex) => {
          const locationGroups = locationGroupsMap.get(location) || [];
          const locationUserCount = locationGroups.reduce((acc, g) => {
            return acc + ('totalMembers' in g ? g.totalMembers : (g as any).members?.length || 0);
          }, 0);
          
          const theme = locationThemes[locIndex % locationThemes.length];
          
          return (
            <div key={location} className="space-y-3 sm:space-y-4">
              {/* Location Header */}
              <div className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg ${theme.header}`}>
                <div className="flex items-center gap-2 text-base sm:text-lg font-semibold flex-wrap">
                  <MapPin className={`w-4 h-4 sm:w-5 sm:h-5 ${theme.icon}`} />
                  {location === 'On-site' ? '📍 現場' : `📍 ${location}`}
                  <span className="text-muted-foreground font-normal text-sm">
                    ({locationUserCount} 人，{locationGroups.length} 組)
                  </span>
                </div>
              </div>
              
              {/* Groups Grid - responsive columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {locationGroups.map((group, localIndex) => {
                  const isGroupReady = 'allReady' in group ? group.allReady : false;
                  const members = 'members' in group ? group.members : (group as any).members || [];
                  const globalGroupNumber = 'groupNumber' in group ? group.groupNumber : (group as any).number;
                  const localGroupNumber = localIndex + 1; // Start from 1 for each location
                  const readyCount = 'readyCount' in group ? group.readyCount : 0;
                  const totalMembers = 'totalMembers' in group ? group.totalMembers : members.length;
                  
                  // For study phase, check submissions
                  const groupSubmissions = submissions.filter(s => s.groupNumber === globalGroupNumber);
                  const allSubmitted = !isVerificationPhase && groupSubmissions.length === members.length;

                  return (
                    <Card 
                      key={globalGroupNumber} 
                      className={`${theme.bg} ${theme.border} border-2 ${isGroupReady || allSubmitted ? 'ring-2 ring-accent' : ''}`}
                    >
                      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                            <Users className={`w-4 h-4 sm:w-5 sm:h-5 ${theme.icon}`} />
                            第 {localGroupNumber} 組
                          </CardTitle>
                          {isVerificationPhase ? (
                            isGroupReady ? (
                              <span className="flex items-center gap-1 text-xs sm:text-sm text-accent">
                                <CheckCircle className="w-4 h-4" />
                                就緒
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {readyCount}/{totalMembers}
                              </span>
                            )
                          ) : (
                            allSubmitted ? (
                              <span className="flex items-center gap-1 text-xs sm:text-sm text-accent">
                                <CheckCircle className="w-4 h-4" />
                                完成
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {groupSubmissions.length}/{members.length}
                              </span>
                            )
                          )}
                        </div>
                        
                        {/* Ready progress bar for verification phase */}
                        {isVerificationPhase && (
                          <Progress 
                            value={(readyCount / totalMembers) * 100} 
                            className="h-1.5 mt-2" 
                          />
                        )}
                      </CardHeader>
                      <CardContent className="px-3 sm:px-4">
                        <div className="space-y-1.5 sm:space-y-2">
                          {members.map((member: any) => {
                            const memberReady = 'readyConfirmed' in member ? member.readyConfirmed : false;
                            const hasSubmitted = !isVerificationPhase && submissions.some(s => s.userId === member.id);
                            const isComplete = isVerificationPhase ? memberReady : hasSubmitted;
                            
                            return (
                              <div
                                key={member.id}
                                className="flex items-center justify-between py-1.5 sm:py-2 border-b last:border-0 border-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full gradient-gold flex items-center justify-center text-secondary-foreground text-xs sm:text-sm font-bold">
                                    {member.name.charAt(0)}
                                  </div>
                                  <span className="text-sm font-medium">{member.name}</span>
                                </div>
                                {isComplete ? (
                                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                ) : (
                                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
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
              
              {/* Separator between locations */}
              {locIndex < sortedLocations.length - 1 && (
                <div className="border-t-2 border-dashed border-muted-foreground/20 my-6 sm:my-8" />
              )}
            </div>
          );
        });
      })()}

      {/* AI Analysis Actions (Show only in study phase) */}
      {isStudyingPhase && (
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Sparkles className="w-5 h-5 text-secondary" />
              AI 分析
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            {/* AI Options - stacked on mobile */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 p-3 bg-muted/30 rounded-lg border border-dashed">
              <div className="flex items-center gap-2">
                <Switch
                  id="fast-mode"
                  checked={fastMode}
                  onCheckedChange={setFastMode}
                />
                <Label htmlFor="fast-mode" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Zap className="w-4 h-4 text-accent" />
                  快速模式
                  <span className="text-xs text-muted-foreground hidden sm:inline">(較快模型)</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="filled-only"
                  checked={filledOnly}
                  onCheckedChange={setFilledOnly}
                />
                <Label htmlFor="filled-only" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Users className="w-4 h-4 text-secondary" />
                  僅分析有填寫者
                  <span className="text-xs text-muted-foreground hidden sm:inline">(降低 token)</span>
                </Label>
              </div>
            </div>

            {/* Progress indicator during generation */}
            {generationProgress.total > 0 && (
              <div className="space-y-2 p-3 sm:p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    生成報告中...
                  </span>
                  <span className="font-medium text-primary">
                    {generationProgress.current}/{generationProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(generationProgress.current / generationProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            )}
            
            {/* Action buttons - stack on mobile */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Button
                variant="navy"
                size="lg"
                className="w-full h-12 sm:h-11 text-xs sm:text-sm"
                onClick={handleGenerateGroupSummary}
                disabled={isGeneratingGroup || !hasDataForAnalysis}
              >
                {isGeneratingGroup ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span className="hidden sm:inline">生成中 ({generationProgress.current}/{generationProgress.total})</span>
                    <span className="sm:hidden">{generationProgress.current}/{generationProgress.total}</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">生成小組摘要</span>
                    <span className="sm:hidden">小組報告</span>
                  </>
                )}
              </Button>
              <Button
                variant="gold"
                size="lg"
                className="w-full h-12 sm:h-11 text-xs sm:text-sm"
                onClick={handleGenerateOverallInsight}
                disabled={isGeneratingOverall || !hasDataForAnalysis}
              >
                {isGeneratingOverall ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span className="hidden sm:inline">生成整體洞察</span>
                <span className="sm:hidden">整體報告</span>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full h-12 sm:h-11 text-xs sm:text-sm"
                onClick={handleViewExistingReports}
                disabled={existingReports.length === 0}
              >
                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">查閱報告</span>
                <span className="sm:hidden">查閱</span>
                {existingReports.length > 0 && (
                  <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4">
                    {existingReports.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 sm:h-11 text-xs sm:text-sm"
                onClick={handleExportCSV}
                disabled={!hasDataForAnalysis}
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">導出 CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spiritual Fitness Monitoring Section */}
      {isStudyingPhase && currentSession?.id && (
        <Tabs defaultValue="progress" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 sm:h-10">
            <TabsTrigger value="progress" className="gap-2 text-sm">
              <Dumbbell className="w-4 h-4" />
              進度監控
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2 text-sm">
              <Zap className="w-4 h-4" />
              開發工具
            </TabsTrigger>
          </TabsList>
          <TabsContent value="progress" className="mt-4">
            <StudyProgressMonitor sessionId={currentSession.id} />
          </TabsContent>
          <TabsContent value="tools" className="mt-4">
            <MockDataGenerator sessionId={currentSession.id} />
          </TabsContent>
        </Tabs>
      )}

      {/* AI Report Viewer */}
      <AIReportViewer
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        reportContent={reportContent}
        verseReference={currentSession?.verseReference}
      />
    </div>
  );
};
