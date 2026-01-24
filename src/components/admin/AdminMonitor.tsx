import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { useRealtime } from '@/hooks/useRealtime';
import { fetchSubmissions, generateAIReport, exportSubmissionsAsCSV, updateSessionStatus, fetchParticipants } from '@/lib/supabase-helpers';
import { forceVerifyAllParticipants, fetchParticipantsWithReadyStatus, calculateGroupReadyStatus, GroupReadyStatus } from '@/lib/admin-helpers';
import { Users, FileText, CheckCircle, Clock, Sparkles, Download, Loader2, AlertCircle, Zap, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export const AdminMonitor: React.FC = () => {
  const { currentSession, users, setUsers, submissions, setSubmissions, addSubmission, setCurrentSession } = useSession();
  const [isGeneratingGroup, setIsGeneratingGroup] = useState(false);
  const [isGeneratingOverall, setIsGeneratingOverall] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isForceVerifying, setIsForceVerifying] = useState(false);
  const [groupReadyStatus, setGroupReadyStatus] = useState<GroupReadyStatus[]>([]);

  // Determine if we're in verification phase
  const isVerificationPhase = currentSession?.status === 'grouping';
  const isStudyingPhase = currentSession?.status === 'studying';
  
  // Debug: Log current session status
  console.log('[AdminMonitor] Session status:', currentSession?.status, 'isVerificationPhase:', isVerificationPhase);

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
      toast.success('所有組員已確認，開始查經！', {
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

  // Poll for ready status during verification phase
  useEffect(() => {
    if (!isVerificationPhase || !currentSession?.id) return;
    
    const interval = setInterval(refreshReadyStatus, 3000);
    return () => clearInterval(interval);
  }, [isVerificationPhase, currentSession?.id, refreshReadyStatus]);

  const groups = currentSession?.groups || [];
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

  // Calculate overall ready progress
  const totalReadyCount = groupReadyStatus.reduce((acc, g) => acc + g.readyCount, 0);
  const totalMemberCount = groupReadyStatus.reduce((acc, g) => acc + g.totalMembers, 0);
  const readyPercentage = totalMemberCount > 0 ? (totalReadyCount / totalMemberCount) * 100 : 0;

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
              <Badge variant={isVerificationPhase ? 'secondary' : isStudyingPhase ? 'default' : 'outline'}>
                {isVerificationPhase ? '驗證階段 Verification' : isStudyingPhase ? '查經中 Studying' : currentSession?.status}
              </Badge>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {isVerificationPhase ? `${totalReadyCount}/${totalMemberCount}` : `${submittedCount}/${totalCount}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isVerificationPhase ? '已確認 Ready' : '已提交 Submitted'}
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
        </CardContent>
      </Card>

      {/* Force Verify Button (Verification Phase Only - or always show for testing) */}
      {(isVerificationPhase || (!isStudyingPhase && groups.length > 0)) && (
        <Card className="border-accent/50 bg-accent/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-medium text-foreground">測試模式工具</p>
                  <p className="text-sm text-muted-foreground">
                    模擬使用者無法點擊確認，使用此按鈕強制通過驗證
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="border-accent text-accent hover:bg-accent/10"
                    disabled={isForceVerifying}
                  >
                    {isForceVerifying ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    強制全員確認
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>確定要強制確認所有參與者嗎？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作會將所有 {totalMemberCount} 位參與者標記為「已確認」，並自動進入查經階段。
                      此功能僅供測試使用。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleForceVerifyAll}>
                      確定執行
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
            <div key={location} className="space-y-4">
              {/* Location Header */}
              <div className={`flex items-center gap-3 p-3 rounded-lg ${theme.header}`}>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin className={`w-5 h-5 ${theme.icon}`} />
                  {location === 'On-site' ? '📍 現場' : `📍 ${location}`}
                  <span className="text-muted-foreground font-normal">
                    ({locationUserCount} 人，{locationGroups.length} 組)
                  </span>
                </div>
              </div>
              
              {/* Groups Grid - Local numbering starts from 1 for each location */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Users className={`w-5 h-5 ${theme.icon}`} />
                            第 {localGroupNumber} 組
                          </CardTitle>
                          {isVerificationPhase ? (
                            isGroupReady ? (
                              <span className="flex items-center gap-1 text-sm text-accent">
                                <CheckCircle className="w-4 h-4" />
                                已就緒
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {readyCount}/{totalMembers} 確認
                              </span>
                            )
                          ) : (
                            allSubmitted ? (
                              <span className="flex items-center gap-1 text-sm text-accent">
                                <CheckCircle className="w-4 h-4" />
                                已完成
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
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
                      <CardContent>
                        <div className="space-y-2">
                          {members.map((member: any) => {
                            const memberReady = 'readyConfirmed' in member ? member.readyConfirmed : false;
                            const hasSubmitted = !isVerificationPhase && submissions.some(s => s.userId === member.id);
                            const isComplete = isVerificationPhase ? memberReady : hasSubmitted;
                            
                            return (
                              <div
                                key={member.id}
                                className="flex items-center justify-between py-2 border-b last:border-0 border-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-secondary-foreground text-sm font-bold">
                                    {member.name.charAt(0)}
                                  </div>
                                  <span className="text-sm font-medium">{member.name}</span>
                                </div>
                                {isComplete ? (
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
              
              {/* Separator between locations */}
              {locIndex < sortedLocations.length - 1 && (
                <div className="border-t-2 border-dashed border-muted-foreground/20 my-8" />
              )}
            </div>
          );
        });
      })()}

      {/* AI Analysis Actions (Show only in study phase) */}
      {isStudyingPhase && (
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
      )}

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
