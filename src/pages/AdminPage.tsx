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
import { PrayerMeetingAdmin } from '@/components/admin/PrayerMeetingAdmin';
import { AdminMailComposer } from '@/components/admin/AdminMailComposer';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, ChevronLeft, Loader2, Home, Users, History, Sparkles, Image, ToggleLeft, Crown, Mail, Plus, BookOpen } from 'lucide-react';
import { WeChurchIcon } from '@/components/icons/WeChurchLogo';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

type AdminStep = 'auth' | 'dashboard' | 'history' | 'cards' | 'message-cards' | 'feature-toggles' | 'prayer-meeting' | 'mail' | 'create' | 'waiting' | 'monitor';

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
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WeChurchIcon size={28} className="text-primary" />
                <h2 className="text-xl sm:text-2xl font-semibold font-display">管理後台</h2>
              </div>
              <Button 
                size="default"
                onClick={() => setStep('create')}
                className="gap-2 h-11 sm:h-10 text-base sm:text-sm gradient-coral text-white shadow-md hover:shadow-lg transition-shadow"
                data-testid="button-create-session"
              >
                <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
                開始新課程
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {([
                { icon: History, label: '歷史資料', desc: '查看過往課程', action: () => setStep('history'), testId: 'button-history' },
                { icon: Users, label: '會員管理', desc: '管理會員資料與角色', action: () => navigate('/admin/crm'), testId: 'button-crm' },
                { icon: Mail, label: '信件系統', desc: '寄送郵件給會友', action: () => setStep('mail'), testId: 'button-mail-system' },
                { icon: Crown, label: '禱告會管理', desc: '建立與管理禱告會', action: () => setStep('prayer-meeting'), testId: 'button-prayer-meeting-admin' },
                { icon: Sparkles, label: '真心話題庫', desc: '管理破冰遊戲題目', action: () => setStep('cards'), testId: 'button-cards' },
                { icon: Image, label: '信息卡片', desc: '上傳管理信息卡片', action: () => setStep('message-cards'), testId: 'button-message-cards' },
                { icon: ToggleLeft, label: '功能開關', desc: '啟用或停用系統功能', action: () => setStep('feature-toggles'), testId: 'button-feature-toggles' },
              ] as const).map(({ icon: Icon, label, desc, action, testId }) => (
                <button
                  key={testId}
                  onClick={action}
                  className="flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl border bg-card text-card-foreground hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all duration-200 cursor-pointer group"
                  data-testid={testId}
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-primary" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <h3 className="text-base font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                進行中的課程
              </h3>
              <SessionHistory 
                onCreateNew={() => setStep('create')} 
                onSelectSession={handleSelectSession}
              />
            </div>
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
      case 'mail':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <AdminMailComposer onBack={handleBackToDashboard} />
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
