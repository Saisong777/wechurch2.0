import React, { useState, useEffect } from 'react';
// Force clean rebuild for HMR cache issue
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { AuthForm } from '@/components/auth/AuthForm';
import { SessionHistory } from '@/components/admin/SessionHistory';
import { CreateSession } from '@/components/admin/CreateSession';
import { AdminWaitingRoom } from '@/components/admin/AdminWaitingRoom';
import { AdminMonitor } from '@/components/admin/AdminMonitor';
import { HistoryBrowser } from '@/components/admin/HistoryBrowser';
import { CardQuestionManager } from '@/components/admin/CardQuestionManager';
import { MessageCardManager } from '@/components/admin/MessageCardManager';
import { FeatureToggleManager } from '@/components/admin/FeatureToggleManager';
import { QuickShareMessageCard } from '@/components/admin/QuickShareMessageCard';
import { PrayerMeetingAdmin } from '@/components/admin/PrayerMeetingAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, ChevronLeft, Loader2, Home, Users, History, Sparkles, Image, ToggleLeft, Crown } from 'lucide-react';
import { WeChurchIcon } from '@/components/icons/WeChurchLogo';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

type AdminStep = 'auth' | 'dashboard' | 'history' | 'cards' | 'message-cards' | 'feature-toggles' | 'prayer-meeting' | 'create' | 'waiting' | 'monitor';

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
    try {
      // Load session data
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`);
      if (!sessionResponse.ok) throw new Error('Failed to fetch session');
      const sessionData = await sessionResponse.json();

      // Load participants
      const participantsResponse = await fetch(`/api/sessions/${sessionId}/participants`);
      const participants = participantsResponse.ok ? await participantsResponse.json() : [];

      // Load submissions
      const submissionsResponse = await fetch(`/api/sessions/${sessionId}/submissions`);
      const submissions = submissionsResponse.ok ? await submissionsResponse.json() : [];

      setCurrentSession({
        id: sessionData.id,
        shortCode: sessionData.shortCode,
        bibleVerse: '',
        verseReference: sessionData.verseReference,
        status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
        createdAt: new Date(sessionData.createdAt),
        groups: [],
        allowLatecomers: sessionData.allowLatecomers,
        icebreakerEnabled: sessionData.icebreakerEnabled,
      });
      setIsAdmin(true);
      setUsers(participants);
      setSubmissions(submissions);

      // Determine which step to show based on session status
      if (sessionData.status === 'waiting') {
        setStep('waiting');
      } else {
        // Rebuild groups from participants
        const groupNumbers = [...new Set(participants.filter((p: any) => p.groupNumber).map((p: any) => p.groupNumber))];
        const groups = groupNumbers.map((num: number) => ({
          id: `group-${num}`,
          number: num,
          members: participants.filter((p: any) => p.groupNumber === num),
        }));
        
        const updatedSession = {
          id: sessionData.id,
          shortCode: sessionData.shortCode,
          bibleVerse: '',
          verseReference: sessionData.verseReference,
          status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
          createdAt: new Date(sessionData.createdAt),
          groups,
          allowLatecomers: sessionData.allowLatecomers,
          icebreakerEnabled: sessionData.icebreakerEnabled,
        };
        setCurrentSession(updatedSession);
        setStep('monitor');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error('無法載入課程資料');
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
                <WeChurchIcon size={28} className="text-primary" />
                <h2 className="text-xl sm:text-2xl font-semibold font-display">課程管理</h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={() => setStep('history')}
                  className="gap-2 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
                >
                  <History className="w-5 h-5 sm:w-4 sm:h-4" />
                  歷史資料
                </Button>
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={() => setStep('cards')}
                  className="gap-2 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
                >
                  <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" />
                  破冰題庫
                </Button>
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={() => setStep('message-cards')}
                  className="gap-2 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
                >
                  <Image className="w-5 h-5 sm:w-4 sm:h-4" />
                  信息卡片
                </Button>
                <Button 
                  variant="default" 
                  size="default"
                  onClick={() => navigate('/admin/crm')}
                  className="gap-2 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
                >
                  <Users className="w-5 h-5 sm:w-4 sm:h-4" />
                  會員管理系統
                </Button>
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={() => setStep('feature-toggles')}
                  className="gap-2 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
                >
                  <ToggleLeft className="w-5 h-5 sm:w-4 sm:h-4" />
                  功能開關
                </Button>
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={() => setStep('prayer-meeting')}
                  className="gap-2 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
                  data-testid="button-prayer-meeting-admin"
                >
                  <Crown className="w-5 h-5 sm:w-4 sm:h-4" />
                  禱告會管理
                </Button>
              </div>
            </div>

            {/* Quick Share Message Card */}
            <div className="mb-6">
              <QuickShareMessageCard onManageCards={() => setStep('message-cards')} />
            </div>

            <SessionHistory 
              onCreateNew={() => setStep('create')} 
              onSelectSession={handleSelectSession}
            />
          </div>
        );
      case 'history':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <HistoryBrowser />
          </div>
        );
      case 'cards':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <CardQuestionManager />
          </div>
        );
      case 'message-cards':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <MessageCardManager onBack={handleBackToDashboard} />
          </div>
        );
      case 'feature-toggles':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <FeatureToggleManager onBack={handleBackToDashboard} />
          </div>
        );
      case 'prayer-meeting':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <PrayerMeetingAdmin onBack={handleBackToDashboard} />
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
      <div className="gradient-sky text-white py-2 sm:py-3 px-3 sm:px-4">
        <div className="container mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {step !== 'auth' && step !== 'dashboard' ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/10 px-2 sm:px-3"
                onClick={handleBackToDashboard}
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">返回</span>
              </Button>
            ) : (
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 px-2 sm:px-3">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">首頁</span>
                </Button>
              </Link>
            )}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <Home className="w-4 h-4 sm:w-5 sm:h-5 text-coral flex-shrink-0" />
              <span className="text-xs sm:text-sm opacity-90 truncate font-display">
                <span className="sm:hidden">控制台</span>
                <span className="hidden sm:inline">WeChurch 管理後台</span>
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
                <span className="text-xs sm:text-sm opacity-90 hidden lg:inline truncate max-w-32">
                  {user.email}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-white/10 p-2"
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


      <main className="container mx-auto max-w-7xl">
        {/* Progress indicator - only show during session flow */}
        {(step === 'create' || step === 'waiting' || step === 'monitor') && (
          <div className="flex items-center justify-center gap-2 py-4 sm:py-6">
            {(['create', 'waiting', 'monitor'] as AdminStep[]).map((s, index) => (
              <React.Fragment key={s}>
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                    step === s
                      ? 'gradient-coral text-white shadow-lg'
                      : ['create', 'waiting', 'monitor'].indexOf(step) > index
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 2 && (
                  <div
                    className={`w-8 sm:w-12 h-1 rounded ${
                      ['create', 'waiting', 'monitor'].indexOf(step) > index
                        ? 'bg-primary'
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
