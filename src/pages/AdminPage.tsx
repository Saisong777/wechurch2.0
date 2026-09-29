import React, { useState, useEffect, lazy, Suspense, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { AppearanceControl } from '@/components/theme/AppearanceControl';
import { Settings, LogOut, ChevronLeft, Loader2, Home, Users, Sparkles, Image, ToggleLeft, Crown, Mail, Inbox, BookOpen } from 'lucide-react';
import { WeChurchIcon } from '@/components/icons/WeChurchLogo';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/queryClient';
import { canComposeEmail } from '@shared/email';
import { useAccessControl } from '@/hooks/useAccessControl';

type AdminStep = 'auth' | 'dashboard' | 'cards' | 'message-cards' | 'feature-toggles' | 'mail' | 'inbox';

function lazyAdminComponent<T extends Record<string, unknown>>(
  factory: () => Promise<T>,
  name: keyof T
) {
  return lazy(() => factory().then((module) => ({ default: module[name] as ComponentType<any> })));
}

const CardQuestionManager = lazyAdminComponent(() => import('@/components/admin/CardQuestionManager'), 'CardQuestionManager');
const MessageCardManager = lazyAdminComponent(() => import('@/components/admin/MessageCardManager'), 'MessageCardManager');
const FeatureToggleManager = lazyAdminComponent(() => import('@/components/admin/FeatureToggleManager'), 'FeatureToggleManager');
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
  const isSystemAdmin = role === 'admin';
  const access = useAccessControl();
  const canEnterAdmin = canCreateSession || !!access.data?.canEnterAdmin;
  const canMail = canComposeEmail(role) || !!access.data?.permissions?.includes('email.send');
  const canDevotions = isAdmin || !!access.data?.permissions?.includes('devotions.manage');
  const [step, setStep] = useState<AdminStep>('auth');
  const [recordsOpen, setRecordsOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/inbox/unread-count'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/inbox/unread-count');
      return res.json();
    },
    enabled: step === 'dashboard' && !!user && isSystemAdmin,
    refetchInterval: 60000,
  });

  const loading = authLoading || roleLoading || (!!user && !canCreateSession && access.isPending);

  // Authorization check
  useEffect(() => {
    if (!loading) {
      if (!user) {
        setStep('auth');
      } else if (!canEnterAdmin) {
        // User is logged in but doesn't have permission
        toast.error('您沒有權限存取管理後台', {
          description: 'Unauthorized access. Only leaders and admins can access this page.',
        });
        navigate('/');
      } else {
        setStep('dashboard');
      }
    }
  }, [user, loading, canEnterAdmin, navigate]);

  const handleSignOut = async () => {
    await signOut();
    setStep('auth');
  };

  const handleBackToDashboard = () => {
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

            </div>


            <div className="pt-2">
              <h3 className="text-base font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                後台管理
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {([
                ...(isAdmin ? [{ icon: Settings, label: '角色與權限', desc: '職分、授權與管理範圍', action: () => navigate('/admin/access'), testId: 'button-access-control' }] : []),
                ...(canDevotions ? [{ icon: BookOpen, label: '每日靈修課表', desc: '課表、短文與發佈', action: () => navigate('/admin/church-devotions'), testId: 'button-church-devotions' }] : []),
                ...(canCreateSession || access.data?.canEnterCrm ? [{ icon: Users, label: '會員管理', desc: '管理會員資料與角色', action: () => navigate('/admin/crm'), testId: 'button-crm' }] : []),
                ...(access.data?.permissions?.includes('groups.manage') ? [{ icon: Users, label: '小家管理', desc: '小家成員與異動', action: () => navigate('/groups?manage=1'), testId: 'button-family-access' }] : []),
                ...(access.data?.permissions?.includes('visits.manage') ? [{ icon: Users, label: '探訪安排', desc: '探訪收件匣', action: () => navigate('/care?view=visits'), testId: 'button-visits-access' }] : []),
                ...(canMail ? [
                  { icon: Mail, label: '寄信', desc: '寄送郵件給會友', action: () => setStep('mail'), testId: 'button-mail-system' },
                ] : []),
                ...(isSystemAdmin ? [
                  { icon: Inbox, label: '收件匣', desc: '查看回信', action: () => setStep('inbox'), testId: 'button-inbox', badge: unreadData?.count },
                ] : []),
                { icon: Crown, label: '公共禱告牆', desc: '查看與分享代禱', action: () => navigate('/prayer-wall'), testId: 'button-prayer-meeting-admin' },
                ...(canCreateSession ? [{ icon: Sparkles, label: '真心話題庫', desc: '管理破冰遊戲題目', action: () => setStep('cards'), testId: 'button-cards' }] : []),
                ...(isSystemAdmin ? [
                  { icon: Image, label: '信息卡片', desc: '上傳管理信息卡片', action: () => setStep('message-cards'), testId: 'button-message-cards' },
                  { icon: ToggleLeft, label: '功能開關', desc: '啟用或停用系統功能', action: () => setStep('feature-toggles'), testId: 'button-feature-toggles' },
                ] : []),
              ] as Array<{ icon: any; label: string; desc: string; action: () => void; testId: string; badge?: number }>).map(({ icon: Icon, label, desc, action, testId, badge }) => (
                <button
                  key={testId}
                  onClick={action}
                  className="relative flex min-h-20 items-center gap-3 p-3 rounded-lg border bg-card text-card-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors cursor-pointer group"
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
                  <div className="min-w-0 text-left">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{desc}</div>
                  </div>
                </button>
              ))}
              </div>
            </div>
            {isSystemAdmin && <details className="border-t pt-3" onToggle={event => setRecordsOpen(event.currentTarget.open)}><summary className="cursor-pointer py-3 font-medium">系統紀錄</summary>{recordsOpen && <div className="space-y-5 py-4"><PlatformMaturityPanel /></div>}</details>}
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
      case 'mail':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            {canMail && <AdminMailComposer onBack={handleBackToDashboard} />}
          </div>
        );
      case 'inbox':
        return (
          <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8">
            <AdminInbox onBack={handleBackToDashboard} />
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
            <AppearanceControl />
            {user && (
              <>
                {role && (
                  <span className="text-xs bg-white/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hidden md:inline">
                    {role === 'admin'
                      ? '系統管理員'
                      : role === 'senior_pastor'
                        ? '主任牧師'
                        : role === 'pastor'
                          ? '牧師'
                          : role === 'minister'
                            ? '傳道人'
                            : role === 'group_leader' || role === 'leader'
                              ? '小家長'
                              : '儲備'}
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
        <Suspense fallback={<AdminSectionLoader />}>
          {renderStep()}
        </Suspense>
      </main>
    </div>
  );
};
