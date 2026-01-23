import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AuthForm } from '@/components/auth/AuthForm';
import { SessionHistory } from '@/components/admin/SessionHistory';
import { CreateSession } from '@/components/admin/CreateSession';
import { AdminWaitingRoom } from '@/components/admin/AdminWaitingRoom';
import { AdminMonitor } from '@/components/admin/AdminMonitor';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, ChevronLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchParticipants, fetchSubmissions } from '@/lib/supabase-helpers';

type AdminStep = 'auth' | 'history' | 'create' | 'waiting' | 'monitor';

export const AdminPage: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const { currentSession, setCurrentSession, setUsers, setSubmissions, setIsAdmin } = useSession();
  const [step, setStep] = useState<AdminStep>('auth');

  // Set step based on auth state
  useEffect(() => {
    if (!loading) {
      if (user) {
        setStep('history');
      } else {
        setStep('auth');
      }
    }
  }, [user, loading]);

  const handleSelectSession = async (sessionId: string) => {
    // Load session data
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionData) {
      setCurrentSession({
        id: sessionData.id,
        bibleVerse: '',
        verseReference: sessionData.verse_reference,
        status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
        createdAt: new Date(sessionData.created_at),
        groups: [],
      });
      setIsAdmin(true);

      // Load participants and submissions
      const participants = await fetchParticipants(sessionId);
      setUsers(participants);

      const submissions = await fetchSubmissions(sessionId);
      setSubmissions(submissions);

      // Determine which step to show based on session status
      if (sessionData.status === 'waiting') {
        setStep('waiting');
      } else {
        // Rebuild groups from participants
        const groupNumbers = [...new Set(participants.filter(p => p.groupNumber).map(p => p.groupNumber))];
        const groups = groupNumbers.map(num => ({
          id: `group-${num}`,
          number: num!,
          members: participants.filter(p => p.groupNumber === num),
        }));
        
        const updatedSession = {
          id: sessionData.id,
          bibleVerse: '',
          verseReference: sessionData.verse_reference,
          status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
          createdAt: new Date(sessionData.created_at),
          groups,
        };
        setCurrentSession(updatedSession);
        setStep('monitor');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setStep('auth');
  };

  const handleBackToHistory = () => {
    setCurrentSession(null);
    setUsers([]);
    setSubmissions([]);
    setStep('history');
  };

  const renderStep = () => {
    switch (step) {
      case 'auth':
        return (
          <div className="px-4 py-8">
            <AuthForm onSuccess={() => setStep('history')} />
          </div>
        );
      case 'history':
        return (
          <div className="px-4 py-8">
            <SessionHistory 
              onCreateNew={() => setStep('create')} 
              onSelectSession={handleSelectSession}
            />
          </div>
        );
      case 'create':
        return (
          <div className="px-4 py-8">
            <CreateSession onCreated={() => setStep('waiting')} />
          </div>
        );
      case 'waiting':
        return (
          <div className="px-4 py-8">
            <AdminWaitingRoom onGroupingComplete={() => setStep('monitor')} />
          </div>
        );
      case 'monitor':
        return (
          <div className="px-4 py-8">
            <AdminMonitor />
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-navy text-primary-foreground py-3 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'auth' && step !== 'history' ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-white/10"
                onClick={handleBackToHistory}
              >
                <ChevronLeft className="w-4 h-4" />
                返回
              </Button>
            ) : (
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
                  <ChevronLeft className="w-4 h-4" />
                  首頁
                </Button>
              </Link>
            )}
            <span className="text-sm opacity-80">管理後台 Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <>
                <span className="text-sm opacity-80 hidden sm:inline">
                  {user.email}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary-foreground hover:bg-white/10"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            )}
            <Settings className="w-5 h-5" />
          </div>
        </div>
      </div>

      <Header 
        variant="compact" 
        title="查經管理後台"
        subtitle=""
      />

      <main className="container mx-auto">
        {/* Progress indicator - only show during session flow */}
        {(step === 'create' || step === 'waiting' || step === 'monitor') && (
          <div className="flex items-center justify-center gap-2 py-6">
            {(['create', 'waiting', 'monitor'] as AdminStep[]).map((s, index) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    step === s
                      ? 'gradient-gold text-secondary-foreground glow-gold'
                      : ['create', 'waiting', 'monitor'].indexOf(step) > index
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 2 && (
                  <div
                    className={`w-12 h-1 rounded ${
                      ['create', 'waiting', 'monitor'].indexOf(step) > index
                        ? 'bg-accent'
                        : 'bg-muted'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {renderStep()}
      </main>
    </div>
  );
};
