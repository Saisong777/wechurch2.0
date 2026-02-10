import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminStudyResponses, ParticipantProgress } from '@/hooks/useAdminStudyResponses';
import { getProgressStatusLabel, INSIGHT_CATEGORIES, parseCategories, parseNotes } from '@/types/spiritual-fitness';
import { Eye, Users, Dumbbell, Sparkles, Loader2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudyProgressMonitorProps {
  sessionId: string;
}

export const StudyProgressMonitor: React.FC<StudyProgressMonitorProps> = ({ sessionId }) => {
  const { data: participants, isLoading } = useAdminStudyResponses({ sessionId });
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProgress | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Group by status for summary
  const statusCounts = {
    not_started: participants?.filter(p => p.progressStatus === 'not_started').length || 0,
    warming_up: participants?.filter(p => p.progressStatus === 'warming_up').length || 0,
    heavy_lifting: participants?.filter(p => p.progressStatus === 'heavy_lifting').length || 0,
    stretching: participants?.filter(p => p.progressStatus === 'stretching').length || 0,
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            靈命健身進度監控 Study Progress Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{statusCounts.not_started}</p>
              <p className="text-xs text-muted-foreground">尚未開始</p>
            </div>
            <div className="rounded-lg p-3 text-center border bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{statusCounts.warming_up}</p>
              <p className="text-xs text-green-600 dark:text-green-400">暖身中</p>
            </div>
            <div className="rounded-lg p-3 text-center border bg-yellow-50/50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{statusCounts.heavy_lifting}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">重訓中</p>
            </div>
            <div className="rounded-lg p-3 text-center border bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{statusCounts.stretching}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">收操中</p>
            </div>
          </div>

          {/* Participant List */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">姓名</th>
                  <th className="text-center p-3 font-medium">組別</th>
                  <th className="text-center p-3 font-medium">進度</th>
                  <th className="text-right p-3 font-medium">動作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {participants?.map((p) => {
                  const status = getProgressStatusLabel(p.progressStatus);
                  return (
                    <tr key={p.participantId} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{p.participantName}</td>
                      <td className="p-3 text-center">
                        {p.groupNumber ? `#${p.groupNumber}` : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            p.progressStatus === 'warming_up' && "border-green-500 text-green-600 dark:text-green-400",
                            p.progressStatus === 'heavy_lifting' && "border-yellow-500 text-yellow-600 dark:text-yellow-400",
                            p.progressStatus === 'stretching' && "border-blue-500 text-blue-600 dark:text-blue-400",
                          )}
                        >
                          {status.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedParticipant(p)}
                          disabled={p.progressStatus === 'not_started'}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Peek
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Peek Modal */}
      <Dialog open={!!selectedParticipant} onOpenChange={() => setSelectedParticipant(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedParticipant?.participantName} 的健身筆記
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {selectedParticipant?.response && (
              <div className="space-y-4">
                {/* Phase 1 */}
                <div className="border-l-4 border-l-green-500 pl-4 space-y-2">
                  <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Phase 1: 暖身
                  </h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">標題分段:</span> {selectedParticipant.response.titlePhrase || selectedParticipant.response.title_phrase || '-'}</p>
                    <p><span className="text-muted-foreground">最感動的經文:</span> {selectedParticipant.response.heartbeatVerse || selectedParticipant.response.heartbeat_verse || '-'}</p>
                    <p><span className="text-muted-foreground">經文上的資訊:</span> {selectedParticipant.response.observation || '-'}</p>
                  </div>
                </div>

                {/* Phase 2 */}
                <div className="border-l-4 border-l-yellow-500 pl-4 space-y-2">
                  <h4 className="font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4" /> Phase 2: 重訓
                  </h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">思想神的話:</span>{' '}
                      {(() => {
                        const cats = parseCategories(selectedParticipant.response?.coreInsightCategory || selectedParticipant.response?.core_insight_category || null);
                        const nts = parseNotes(selectedParticipant.response?.coreInsightNote || selectedParticipant.response?.core_insight_note || null, cats);
                        return (
                          <>
                            {cats.map(catVal => {
                              const catInfo = INSIGHT_CATEGORIES.find(c => c.value === catVal);
                              return catInfo ? (
                                <Badge key={catVal} variant="outline" className="mr-1">
                                  {catInfo.emoji} {catInfo.label}
                                </Badge>
                              ) : null;
                            })}
                            {cats.length > 0 ? cats.map(catVal => {
                              const note = nts[catVal];
                              if (!note) return null;
                              const catInfo = INSIGHT_CATEGORIES.find(c => c.value === catVal);
                              return <span key={catVal} className="block">{catInfo ? `【${catInfo.label}】` : ''}{note}</span>;
                            }) : '-'}
                          </>
                        );
                      })()}
                    </p>
                    <p><span className="text-muted-foreground">注釋書或其他的參考資料:</span> {selectedParticipant.response.scholarsNote || selectedParticipant.response.scholars_note || '-'}</p>
                  </div>
                </div>

                {/* Phase 3 */}
                <div className="border-l-4 border-l-blue-500 pl-4 space-y-2">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Phase 3: 伸展
                  </h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">與神同行的行動:</span> {selectedParticipant.response.actionPlan || selectedParticipant.response.action_plan || '-'}</p>
                    <p><span className="text-muted-foreground">其他:</span> {selectedParticipant.response.coolDownNote || selectedParticipant.response.cool_down_note || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
