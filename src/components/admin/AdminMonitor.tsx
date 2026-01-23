import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { Users, FileText, CheckCircle, Clock, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';

export const AdminMonitor: React.FC = () => {
  const { currentSession, users, submissions } = useSession();

  const groups = currentSession?.groups || [];
  const submittedCount = submissions.length;
  const totalCount = users.length;

  const handleGenerateGroupSummary = () => {
    toast.info('AI 正在生成小組摘要... AI generating group summaries...');
    setTimeout(() => {
      toast.success('小組摘要已生成！Group summaries generated!');
    }, 2000);
  };

  const handleGenerateOverallInsight = () => {
    toast.info('AI 正在生成整體洞察... AI generating overall insight...');
    setTimeout(() => {
      toast.success('整體洞察已生成！Overall insight generated!');
    }, 2000);
  };

  const handleExportCSV = () => {
    toast.success('正在導出 CSV... Exporting CSV...');
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
            >
              <FileText className="w-5 h-5" />
              生成小組摘要
            </Button>
            <Button
              variant="gold"
              size="lg"
              className="w-full"
              onClick={handleGenerateOverallInsight}
            >
              <Sparkles className="w-5 h-5" />
              生成整體洞察
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleExportCSV}
            >
              <Download className="w-5 h-5" />
              導出 CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
