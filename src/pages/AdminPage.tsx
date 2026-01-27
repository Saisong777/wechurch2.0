import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { AuthForm } from '@/components/auth/AuthForm';
import { SessionHistory } from '@/components/admin/SessionHistory';
import { CreateSession } from '@/components/admin/CreateSession';
import { AdminWaitingRoom } from '@/components/admin/AdminWaitingRoom';
import { AdminMonitor } from '@/components/admin/AdminMonitor';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, ChevronLeft, Loader2, Dumbbell, Flame, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchParticipants, fetchSubmissions } from '@/lib/supabase-helpers';
import { toast } from 'sonner';

type AdminStep = 'auth' | 'dashboard' | 'create' | 'waiting' | 'monitor';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading, isAdmin, canCreateSession } = useUserRole();
  const { currentSession, setCurrentSession, setUsers, setSubmissions, setIsAdmin } = useSession();
  const [step, setStep] = useState<AdminStep>('auth');

  const loading = authLoading || roleLoading;

  // Authorization check
  useEffect(() => {
    if (!loading) {
      if (!user) {
        setStep('auth');
      } else if (!canCreateSession) {
        // User is logged in but doesn't have permission
        toast.error('您沒有權限存取管理後台', {
          description: 'Unauthorized access. Only leaders and admins can access this page.',
        });
        navigate('/');
      } else {
        setStep('dashboard');
      }
    }
  }, [user, loading, canCreateSession, navigate]);

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
        shortCode: sessionData.short_code,
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
          shortCode: sessionData.short_code,
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

  const handleBackToDashboard = () => {
    setCurrentSession(null);
    setUsers([]);
    setSubmissions([]);
    setStep('dashboard');
  };

  const renderStep = () => {
    switch (step) {
      case 'auth':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <AuthForm onSuccess={() => setStep('dashboard')} />
          </div>
        );
      case 'dashboard':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                <h2 className="text-xl sm:text-2xl font-semibold">課程管理</h2>
              </div>
              <Button 
                variant="default" 
                size="default"
                onClick={() => navigate('/admin/crm')}
                className="gap-2 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
              >
                <Users className="w-5 h-5 sm:w-4 sm:h-4" />
                會員管理系統
              </Button>
            </div>
            <SessionHistory 
              onCreateNew={() => setStep('create')} 
              onSelectSession={handleSelectSession}
            />
          </div>
        );
      case 'create':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <CreateSession onCreated={() => setStep('waiting')} />
          </div>
        );
      case 'waiting':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <AdminWaitingRoom onGroupingComplete={() => setStep('monitor')} />
          </div>
        );
      case 'monitor':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
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
      {/* Top navbar - responsive */}
      <div className="gradient-navy text-primary-foreground py-2 sm:py-3 px-3 sm:px-4">
        <div className="container mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {step !== 'auth' && step !== 'dashboard' ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-white/10 px-2 sm:px-3"
                onClick={handleBackToDashboard}
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">返回</span>
              </Button>
            ) : (
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 px-2 sm:px-3">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">首頁</span>
                </Button>
              </Link>
            )}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-secondary flex-shrink-0" />
              <span className="text-xs sm:text-sm opacity-80 truncate">
                <span className="sm:hidden">控制台</span>
                <span className="hidden sm:inline">教練控制台 Coach Dashboard</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {user && (
              <>
                {role && (
                  <span className="text-xs bg-white/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hidden md:inline">
                    {role === 'admin' ? '管理員' : role === 'leader' ? '小組長' : '儲備'}
                  </span>
                )}
                <span className="text-xs sm:text-sm opacity-80 hidden lg:inline truncate max-w-32">
                  {user.email}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary-foreground hover:bg-white/10 p-2"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </>
            )}
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" />
          </div>
        </div>
      </div>

      {/* Header - hide on mobile to save space */}
      <div className="hidden sm:block">
        <Header 
          variant="compact" 
          title="教練控制台"
          subtitle="Coach Dashboard"
        />
      </div>

      <main className="container mx-auto max-w-7xl">
        {/* Progress indicator - only show during session flow */}
        {(step === 'create' || step === 'waiting' || step === 'monitor') && (
          <div className="flex items-center justify-center gap-2 py-4 sm:py-6">
            {(['create', 'waiting', 'monitor'] as AdminStep[]).map((s, index) => (
              <React.Fragment key={s}>
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
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
                    className={`w-8 sm:w-12 h-1 rounded ${
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
