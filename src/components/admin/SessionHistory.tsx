import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { BookOpen, Plus, Calendar, Users, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

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

  useEffect(() => {
    const loadSessions = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          verse_reference,
          status,
          created_at,
          participants:participants(count)
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSessions(data.map(s => ({
          ...s,
          participant_count: (s.participants as any)?.[0]?.count || 0,
        })));
      }
      setIsLoading(false);
    };

    loadSessions();
  }, [user]);

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
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-foreground">
          我的查經聚會
        </h2>
        <Button variant="gold" onClick={onCreateNew}>
          <Plus className="w-5 h-5" />
          建立新聚會
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          載入中...
        </div>
      ) : sessions.length === 0 ? (
        <Card variant="highlight" className="text-center">
          <CardContent className="py-12">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2">
              還沒有查經聚會
            </h3>
            <p className="text-muted-foreground mb-6">
              建立您的第一個查經聚會
            </p>
            <Button variant="gold" onClick={onCreateNew}>
              <Plus className="w-5 h-5" />
              建立新聚會
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card 
              key={session.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectSession(session.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-serif text-lg font-semibold truncate">
                        {session.verse_reference}
                      </p>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
