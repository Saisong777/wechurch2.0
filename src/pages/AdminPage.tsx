import React, { useState, useEffect, lazy, Suspense, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { AppearanceControl } from '@/components/theme/AppearanceControl';
import { Settings, LogOut, ChevronLeft, Loader2, Users, Sparkles, Image, ToggleLeft, Crown, Mail, Inbox, BookOpen, type LucideIcon } from 'lucide-react';
import { WeChurchIcon } from '@/components/icons/WeChurchLogo';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/queryClient';
import { canComposeEmail } from '@shared/email';
import { useAccessControl } from '@/hooks/useAccessControl';
import { crmRoleLabels } from '@/lib/crm-members';

type AdminStep = 'auth' | 'dashboard' | 'cards' | 'message-cards' | 'feature-toggles' | 'mail' | 'inbox';
const stepTitles: Record<AdminStep, string> = {
  auth: '管理員登入', dashboard: '管理後台', cards: '真心話題庫',
  'message-cards': '信息卡片', 'feature-toggles': '功能開關', mail: '寄送通知', inbox: '收件匣',
};
type AdminAction = { icon: LucideIcon; label: string; action: () => void; testId: string; badge?: number };

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
  <div role="status" className="flex min-h-[280px] items-center justify-center gap-2">
    <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-primary" />
    <span>載入中</span>
  </div>
);

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading, isAdmin, canCreateSession } = useUserRole();
  const isSystemAdmin = role === 'admin';
  const access = useAccessControl();
  const roleLabel = [...new Set([
    ...(role && role !== 'member' ? [crmRoleLabels[role]] : []),
    ...(access.data?.grants?.map(grant => grant.roleName) || []),
  ])].join('、') || '會友';
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
          description: '請聯絡教會管理員確認你的授權。',
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

  const actionGroups: Array<{ title: string; actions: AdminAction[] }> = [
    { title: '會友與牧養', actions: [
      ...(canCreateSession || access.data?.canEnterCrm ? [{ icon: Users, label: '會員與牧養', action: () => navigate('/admin/crm'), testId: 'button-crm' }] : []),
      ...(access.data?.permissions?.includes('groups.manage') ? [{ icon: Users, label: '小家管理', action: () => navigate('/groups?manage=1'), testId: 'button-family-access' }] : []),
      ...(access.data?.permissions?.includes('visits.manage') ? [{ icon: Users, label: '探訪安排', action: () => navigate('/care?view=visits'), testId: 'button-visits-access' }] : []),
      { icon: Crown, label: '禱告牆', action: () => navigate('/prayer-wall'), testId: 'button-prayer-meeting-admin' },
    ] },
    { title: '靈修與通知', actions: [
      ...(canDevotions ? [{ icon: BookOpen, label: '每日靈修課表', action: () => navigate('/admin/church-devotions'), testId: 'button-church-devotions' }] : []),
      ...(canMail ? [{ icon: Mail, label: '寄送通知', action: () => setStep('mail'), testId: 'button-mail-system' }] : []),
      ...(isSystemAdmin ? [{ icon: Inbox, label: '收件匣', action: () => setStep('inbox'), testId: 'button-inbox', badge: unreadData?.count }] : []),
    ] },
    { title: '工具與設定', actions: [
      ...(isAdmin ? [{ icon: Settings, label: '角色與權限', action: () => navigate('/admin/access'), testId: 'button-access-control' }] : []),
      ...(canCreateSession ? [{ icon: Sparkles, label: '真心話題庫', action: () => setStep('cards'), testId: 'button-cards' }] : []),
      ...(isSystemAdmin ? [
        { icon: Image, label: '信息卡片', action: () => setStep('message-cards'), testId: 'button-message-cards' },
        { icon: ToggleLeft, label: '功能開關', action: () => setStep('feature-toggles'), testId: 'button-feature-toggles' },
      ] : []),
    ] },
  ];

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
                <h1 className="text-xl sm:text-2xl font-semibold font-display">管理後台</h1>
              </div>

            </div>


            {actionGroups.filter(group => group.actions.length > 0).map(group => <section key={group.title} aria-label={group.title} className="border-t pt-5">
              <h2 className="mb-3 text-base font-semibold">{group.title}</h2>
              <div className="admin-action-grid grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.actions.map(({ icon: Icon, label, action, testId, badge }) => (
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
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon aria-hidden="true" className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-base font-medium break-words">{label}</div>
                  </div>
                </button>
              ))}
              </div>
            </section>)}
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
      <header className="border-b bg-card py-2 sm:py-3 px-3 sm:px-4">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {step !== 'auth' && step !== 'dashboard' ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="min-h-11 gap-1 px-2 sm:px-3"
                onClick={handleBackToDashboard}
                aria-label="返回管理後台"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>返回</span>
              </Button>
            ) : (
                <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1 px-2 sm:px-3">
                  <Link to="/" aria-label="返回首頁">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>首頁</span>
                  </Link>
                </Button>
            )}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <span className="text-sm font-semibold break-words">
                {stepTitles[step]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <AppearanceControl />
            {user && (
              <>
                {role && (
                  <span data-testid="admin-role-label" title={roleLabel} className="max-w-40 truncate text-xs bg-white/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hidden md:inline">
                    {roleLabel}
                  </span>
                )}
                <span className="text-xs sm:text-sm opacity-90 hidden lg:inline truncate max-w-32">
                  {user.email}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="min-h-11 min-w-11 p-2"
                  aria-label="登出"
                  title="登出"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </>
            )}
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" />
          </div>
        </div>
      </header>


      <main className="container mx-auto max-w-7xl">
        <Suspense fallback={<AdminSectionLoader />}>
          {renderStep()}
        </Suspense>
      </main>
    </div>
  );
};
