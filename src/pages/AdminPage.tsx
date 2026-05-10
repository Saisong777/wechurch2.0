import React, { useState, useEffect, lazy, Suspense, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, ChevronLeft, Loader2, Home, Users, History, Sparkles, Image, ToggleLeft, Crown, Mail, Inbox, Plus, BookOpen, QrCode, Gauge } from 'lucide-react';
import { WeChurchIcon } from '@/components/icons/WeChurchLogo';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/queryClient';

type AdminStep = 'auth' | 'dashboard' | 'history' | 'cards' | 'message-cards' | 'feature-toggles' | 'prayer-meeting' | 'mail' | 'inbox' | 'create' | 'waiting' | 'monitor';

const hostFlowSteps: Array<{ step: AdminStep; label: string; hint: string }> = [
  { step: 'create', label: '建立聚會', hint: '設定經文' },
  { step: 'waiting', label: '邀請與分組', hint: 'QR、成員、分組' },
  { step: 'monitor', label: '主持查經', hint: '進度、AI、結束' },
];

const dashboardHostCards: Array<{
  step: AdminStep;
  title: string;
  description: string;
  icon: typeof Plus;
  tone: string;
  iconTone: string;
}> = [
  {
    step: 'create',
    title: '開一場查經',
    description: '設定經文、主題與查經流程',
    icon: Plus,
    tone: 'bg-primary/10 border-primary/20',
    iconTone: 'text-primary',
  },
  {
    step: 'waiting',
    title: '帶大家進場',
    description: 'QR Code、報名、分組與確認',
    icon: QrCode,
    tone: 'bg-secondary/10 border-secondary/20',
    iconTone: 'text-secondary',
  },
  {
    step: 'monitor',
    title: '看進度與 AI',
    description: '查經進度、資料品質、成果整理',
    icon: Gauge,
    tone: 'bg-emerald-500/10 border-emerald-500/20',
    iconTone: 'text-emerald-600',
  },
];

function lazyAdminComponent<T extends Record<string, unknown>>(
  factory: () => Promise<T>,
  name: keyof T
) {
  return lazy(() => factory().then((module) => ({ default: module[name] as ComponentType<any> })));
}

const SessionHistory = lazyAdminComponent(() => import('@/components/admin/SessionHistory'), 'SessionHistory');
const CreateSession = lazyAdminComponent(() => import('@/components/admin/CreateSession'), 'CreateSession');
const AdminWaitingRoom = lazyAdminComponent(() => import('@/components/admin/AdminWaitingRoom'), 'AdminWaitingRoom');
const AdminMonitor = lazyAdminComponent(() => import('@/components/admin/AdminMonitor'), 'AdminMonitor');
const HistoryBrowser = lazyAdminComponent(() => import('@/components/admin/HistoryBrowser'), 'HistoryBrowser');
const CardQuestionManager = lazyAdminComponent(() => import('@/components/admin/CardQuestionManager'), 'CardQuestionManager');
const MessageCardManager = lazyAdminComponent(() => import('@/components/admin/MessageCardManager'), 'MessageCardManager');
const FeatureToggleManager = lazyAdminComponent(() => import('@/components/admin/FeatureToggleManager'), 'FeatureToggleManager');
const PrayerMeetingAdmin = lazyAdminComponent(() => import('@/components/admin/PrayerMeetingAdmin'), 'PrayerMeetingAdmin');
const AdminMailComposer = lazyAdminComponent(() => import('@/components/admin/AdminMailComposer'), 'AdminMailComposer');
const AdminInbox = lazyAdminComponent(() => import('@/components/admin/AdminInbox'), 'AdminInbox');
const PlatformMaturityPanel = lazyAdminComponent(() => import('@/components/admin/PlatformMaturityPanel'), 'PlatformMaturityPanel');

const AdminSectionLoader = () => (
  <div className="flex min-h-[280px] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading, isAdmin, canCreateSession } = useUserRole();
  const { currentSession, setCurrentSession, setUsers, setSubmissions, setIsAdmin } = useSession();
  const [step, setStep] = useState<AdminStep>('auth');

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/inbox/unread-count'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/inbox/unread-count');
      return res.json();
    },
    enabled: step === 'dashboard' && !!user,
    refetchInterval: 60000,
  });

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
      const participantsResponse = await fetch(`/api/admin/sessions/${sessionId}/participants`);
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
                建立查經活動
              </Button>
            </div>

            <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">今晚主持台</p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">從開場到 AI 成果，一頁往前走</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    先建立查經，接著邀請與分組，最後在主持台看進度與整理成果。
                  </p>
                </div>
                <Button
                  onClick={() => setStep('create')}
                  className="h-11 gap-2 self-stretch sm:self-auto"
                  data-testid="button-dashboard-primary-create"
                >
                  <Plus className="h-4 w-4" />
                  立即開場
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {dashboardHostCards.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.step}
                      type="button"
                      onClick={() => {
                        if (card.step === 'create' || currentSession) {
                          setStep(card.step);
                          return;
                        }
                        toast.info('先選擇今日 SoulGym', {
                          description: '下方選擇一場活動後，就能進入等候室或主持台。',
                        });
                      }}
                      className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
                      data-testid={`button-host-card-${card.step}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/80">
                          <Icon className={`h-5 w-5 ${card.iconTone}`} />
                        </div>
                        <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{card.title}</h4>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <PlatformMaturityPanel />

            <div>
              <h3 className="text-base font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                今日 SoulGym
              </h3>
              <SessionHistory
                onCreateNew={() => setStep('create')}
                onSelectSession={handleSelectSession}
              />
            </div>

            <div className="pt-2">
              <h3 className="text-base font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                後台管理
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {([
                { icon: History, label: '歷史資料', desc: '查看過往活動', action: () => setStep('history'), testId: 'button-history' },
                { icon: Users, label: '會員管理', desc: '管理會員資料與角色', action: () => navigate('/admin/crm'), testId: 'button-crm' },
                { icon: Mail, label: '寄信', desc: '寄送郵件給會友', action: () => setStep('mail'), testId: 'button-mail-system' },
                { icon: Inbox, label: '收件匣', desc: '查看回信', action: () => setStep('inbox'), testId: 'button-inbox', badge: unreadData?.count },
                { icon: Crown, label: '禱告會管理', desc: '建立與管理禱告會', action: () => setStep('prayer-meeting'), testId: 'button-prayer-meeting-admin' },
                { icon: Sparkles, label: '真心話題庫', desc: '管理破冰遊戲題目', action: () => setStep('cards'), testId: 'button-cards' },
                { icon: Image, label: '信息卡片', desc: '上傳管理信息卡片', action: () => setStep('message-cards'), testId: 'button-message-cards' },
                { icon: ToggleLeft, label: '功能開關', desc: '啟用或停用系統功能', action: () => setStep('feature-toggles'), testId: 'button-feature-toggles' },
              ] as Array<{ icon: any; label: string; desc: string; action: () => void; testId: string; badge?: number }>).map(({ icon: Icon, label, desc, action, testId, badge }) => (
                <button
                  key={testId}
                  onClick={action}
                  className="relative flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl border bg-card text-card-foreground hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all duration-200 cursor-pointer group"
                  data-testid={testId}
                >
                  {badge && badge > 0 ? (
                    <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {badge}
                    </span>
                  ) : null}
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
      case 'inbox':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <AdminInbox onBack={handleBackToDashboard} />
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
          <div className="px-3 sm:px-4 py-4 sm:py-6">
            <div className="mx-auto max-w-3xl rounded-2xl border bg-card/80 p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">一頁式主持台</p>
                  <p className="text-xs text-muted-foreground">照著目前階段操作即可</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
            {hostFlowSteps.map(({ step: s, label, hint }, index) => (
              <React.Fragment key={s}>
                <div
                  className={`rounded-xl px-2 py-2 text-center transition-all ${
                    step === s
                      ? 'gradient-coral text-white shadow-lg'
                      : hostFlowSteps.findIndex(item => item.step === step) > index
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <p className="text-xs font-bold sm:text-sm">{index + 1}. {label}</p>
                  <p className="mt-0.5 hidden text-[11px] opacity-80 sm:block">{hint}</p>
                </div>
              </React.Fragment>
            ))}
              </div>
            </div>
          </div>
        )}

        <Suspense fallback={<AdminSectionLoader />}>
          {renderStep()}
        </Suspense>
      </main>
    </div>
  );
};
