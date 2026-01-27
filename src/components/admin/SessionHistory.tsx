import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, Calendar, Users, ChevronRight, Trash2, QrCode, Download, Copy, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
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
import { getSessionJoinUrl } from '@/lib/url-helpers';

interface PastSession {
  id: string;
  verse_reference: string;
  status: string;
  created_at: string;
  participant_count?: number;
}

interface SessionHistoryProps {
  onCreateNew: () => void;
  onSelectSession: (sessionId: string) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ 
  onCreateNew, 
  onSelectSession 
}) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PastSession | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user) return;

      // First get sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, verse_reference, status, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (sessionsError || !sessionsData) {
        setIsLoading(false);
        return;
      }

      // Then get participant counts for each session
      const sessionsWithCounts = await Promise.all(
        sessionsData.map(async (session) => {
          const { count } = await supabase
            .from('participants')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);
          
          return {
            ...session,
            participant_count: count || 0,
          };
        })
      );

      setSessions(sessionsWithCounts);
      setIsLoading(false);
    };

    loadSessions();
  }, [user]);

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    try {
      // Delete related data first (due to foreign key constraints)
      await supabase.from('ai_reports').delete().eq('session_id', sessionId);
      await supabase.from('submissions').delete().eq('session_id', sessionId);
      await supabase.from('participants').delete().eq('session_id', sessionId);
      
      // Delete the session
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      
      if (error) throw error;
      
      setSessions(sessions.filter(s => s.id !== sessionId));
      toast.success('聚會已刪除');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('刪除失敗，請重試');
    }
  };

  const handleShowQR = (session: PastSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSession(session);
    setIsExpanded(false);
    setQrModalOpen(true);
  };

  const handleCopyId = () => {
    if (!selectedSession) return;
    navigator.clipboard.writeText(selectedSession.id);
    toast.success('Session ID 已複製！');
  };

  const handleDownloadQR = () => {
    if (!selectedSession) return;
    const svg = document.getElementById('session-history-qr');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `bible-study-${selectedSession.id.slice(0, 8)}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      waiting: 'bg-secondary/20 text-secondary-foreground',
      studying: 'bg-accent/20 text-accent',
      completed: 'bg-muted text-muted-foreground',
    };
    const labels: Record<string, string> = {
      waiting: '等待中',
      studying: '進行中',
      completed: '已完成',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.waiting}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <>
      <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground">
            我的健身課程
          </h2>
          <Button variant="gold" onClick={onCreateNew} className="w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm">
            <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
            建立新課程
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-base sm:text-sm">
            載入中...
          </div>
        ) : sessions.length === 0 ? (
          <Card variant="highlight" className="text-center">
            <CardContent className="py-10 sm:py-12">
              <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-semibold mb-2">
                還沒有健身課程
              </h3>
              <p className="text-muted-foreground text-base sm:text-sm mb-6">
                建立您的第一個健身課程
              </p>
              <Button variant="gold" onClick={onCreateNew} className="w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm">
                <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
                建立新課程
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card 
                key={session.id} 
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                onClick={() => onSelectSession(session.id)}
              >
                <CardContent className="py-4 sm:py-5 px-4 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                        <p className="font-serif text-base sm:text-lg font-semibold truncate">
                          {session.verse_reference}
                        </p>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(session.created_at), 'yyyy/MM/dd')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {session.participant_count} 人
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* QR Code Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary h-10 w-10 sm:h-9 sm:w-9"
                        onClick={(e) => handleShowQR(session, e)}
                        title="顯示 QR Code"
                      >
                        <QrCode className="w-5 h-5 sm:w-4 sm:h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-10 w-10 sm:h-9 sm:w-9"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-lg sm:text-xl">確定刪除此聚會？</AlertDialogTitle>
                            <AlertDialogDescription className="text-base sm:text-sm">
                              刪除後將無法恢復，包括所有參與者資料和筆記都會被刪除。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                            <AlertDialogCancel className="h-11 sm:h-10">取消</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-11 sm:h-10"
                              onClick={(e) => handleDeleteSession(session.id, e)}
                            >
                              刪除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <ChevronRight className="w-5 h-5 text-muted-foreground hidden sm:block" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className={isExpanded ? "max-w-2xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle className="text-center">
              {selectedSession?.verse_reference || '查經聚會'}
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="flex flex-col items-center py-4 space-y-4">
              {/* QR Code */}
              <div 
                className="p-4 bg-white rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-105"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <QRCodeSVG
                  id="session-history-qr"
                  value={getSessionJoinUrl(selectedSession.id)}
                  size={isExpanded ? 350 : 200}
                  level="H"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#1a1a2e"
                />
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                {isExpanded ? '點擊縮小' : '點擊放大 QR Code'}
              </p>
              
              {/* Session ID with copy */}
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                <span className="text-sm font-mono text-muted-foreground">
                  ID: {selectedSession.id.slice(0, 8)}...
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyId}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setIsExpanded(!isExpanded)}>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  {isExpanded ? '縮小' : '放大'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleDownloadQR}>
                  <Download className="w-4 h-4 mr-2" />
                  下載
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
