import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  BookHeart,
  BookMarked,
  ChevronRight,
  Clock,
  HeartHandshake,
  MailCheck,
  NotebookTabs,
  Send,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileSettingsDialog } from '@/components/user/ProfileSettingsDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mergeLocalDevotionalNotes, type LocalDevotionalNote } from '@/lib/localDevotionalNotes';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';

interface EmailPreferences {
  userId: string;
  dailyFollowEnabled: boolean;
  dailyFollowTime: string;
  timezone: string;
  lastDailyFollowSentAt: string | null;
}

interface EmailProviderStatus {
  configured: boolean;
  mode: 'resend_api_key' | 'replit_connector' | 'preview_only';
}

const recordActions = [
  {
    id: 'devotional-notes',
    title: '讀經與靈修筆記',
    subtitle: '回看經文亮光、每日靈修與個人默想。',
    href: '/learn/my-notes',
    icon: BookMarked,
    tone: 'border-sky-200 bg-sky-50/70',
    iconTone: 'bg-sky-500/10 text-sky-600',
    featureKeys: ['we_learn'],
  },
  {
    id: 'study-notebook',
    title: '查經筆記本',
    subtitle: '整理 SoulGym 查經、個人回答與小組成果。',
    href: '/user/notebook',
    icon: NotebookTabs,
    tone: 'border-violet-200 bg-violet-50/70',
    iconTone: 'bg-violet-500/10 text-violet-600',
    featureKeys: ['we_live'],
  },
  {
    id: 'grace-record',
    title: '恩典紀錄簿',
    subtitle: '記下禱告、等待，以及神如何回應。',
    href: '/grace-record',
    icon: BookHeart,
    tone: 'border-emerald-200 bg-emerald-50/70',
    iconTone: 'bg-emerald-500/10 text-emerald-600',
    featureKeys: ['we_share'],
  },
  {
    id: 'love-journey',
    title: '愛的旅程',
    subtitle: '查看 28 天同行、每日操練與自己的回應。',
    href: '/me/love-journey',
    icon: Sparkles,
    tone: 'border-amber-200 bg-amber-50/70',
    iconTone: 'bg-amber-500/10 text-amber-600',
    featureKeys: [],
  },
  {
    id: 'care-record',
    title: '關懷紀錄',
    subtitle: '回看正在關心的人、需要與下一步。',
    href: '/care',
    icon: HeartHandshake,
    tone: 'border-rose-200 bg-rose-50/70',
    iconTone: 'bg-rose-500/10 text-rose-600',
    featureKeys: ['care'],
  },
];

const MePage = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { isFeatureEnabled, loading: featuresLoading } = useFeatureToggles();
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; text: string } | null>(null);
  const queryClient = useQueryClient();
  const { data: devotionalNotes = [] } = useQuery<LocalDevotionalNote[]>({
    queryKey: ['/api/devotional-notes'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/devotional-notes', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch devotional notes');
        return mergeLocalDevotionalNotes((await res.json()) as LocalDevotionalNote[]);
      } catch {
        return mergeLocalDevotionalNotes<LocalDevotionalNote>([]);
      }
    },
    enabled: !!user,
  });
  const { data: emailPreferences, isLoading: emailPreferencesLoading } = useQuery<EmailPreferences>({
    queryKey: ['/api/email-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/email-preferences', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch email preferences');
      return res.json();
    },
    enabled: !!user,
  });
  const { data: emailProviderStatus } = useQuery<EmailProviderStatus>({
    queryKey: ['/api/email-provider-status'],
    queryFn: async () => {
      const res = await fetch('/api/email-provider-status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch email provider status');
      return res.json();
    },
    enabled: !!user,
  });
  const updateEmailPreferences = useMutation({
    mutationFn: async (dailyFollowEnabled: boolean) => {
      const res = await apiRequest('PATCH', '/api/email-preferences', {
        dailyFollowEnabled,
        dailyFollowTime: emailPreferences?.dailyFollowTime || '07:00',
        timezone: emailPreferences?.timezone || 'Asia/Taipei',
      });
      return res.json() as Promise<EmailPreferences>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/email-preferences'], data);
      toast.success(data.dailyFollowEnabled ? '每日同行信已開啟' : '每日同行信已關閉');
    },
    onError: () => {
      toast.error('設定沒有成功更新，請再試一次');
    },
  });
  const sendTestEmail = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/daily-follow-email/send-test');
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.previewOnly) {
        setEmailPreview({ subject: data.subject, text: data.text });
        toast.info('本機尚未連接寄信服務，已產生測試信預覽；正式部署後會真的寄出。');
        return;
      }
      setEmailPreview(null);
      toast.success('測試信已寄出');
    },
    onError: () => {
      toast.error('測試信寄送失敗，請確認帳號 email 與寄信設定');
    },
  });

  const displayName = profile?.display_name
    || user?.user_metadata?.display_name
    || user?.email?.split('@')[0]
    || '我的紀錄';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header title="個人管理" subtitle="你的紀錄與設定" variant="compact" />

      <main className="container mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
          <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">個人管理</p>
                <h1 className="truncate text-2xl font-bold text-foreground">{displayName}</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              這裡集中放你的個人紀錄；首頁只保留今天要面對的經文、禱告與關懷。
            </p>
          </section>

          <section aria-labelledby="my-records-title">
            <div className="mb-3 px-1">
              <h2 id="my-records-title" className="text-lg font-bold text-foreground">我的紀錄</h2>
            </div>

            {featuresLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 rounded-lg bg-primary/10" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recordActions.filter(action => action.featureKeys.every(isFeatureEnabled)).map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.id}
                      to={action.href}
                      className={`group flex min-h-28 gap-3 rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${action.tone}`}
                      data-testid={`link-me-${action.id}`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${action.iconTone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-foreground">{action.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {action.id === 'devotional-notes' && devotionalNotes.length > 0
                            ? `已保存 ${devotionalNotes.length} 則讀經與靈修筆記。`
                            : action.subtitle}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="my-settings-title">
            <div className="mb-3 px-1">
              <h2 id="my-settings-title" className="text-lg font-bold text-foreground">我的設定</h2>
            </div>

            <div className="space-y-3">
              <Card className="rounded-lg border-sky-200 bg-sky-50/60 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                        <MailCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-foreground">每日同行信</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          每天早上把今日靈修、禱告牆代求與關懷提醒整理成一封信。
                        </p>
                        {emailProviderStatus && !emailProviderStatus.configured && (
                          <p className="mt-2 text-sm leading-6 text-amber-700">
                            本機尚未連接寄信服務，目前只能預覽測試信。
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(emailPreferences?.dailyFollowEnabled)}
                      disabled={emailPreferencesLoading || updateEmailPreferences.isPending}
                      onCheckedChange={(checked) => updateEmailPreferences.mutate(checked)}
                      aria-label="每日同行信"
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-sky-100 bg-white/80 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-sky-600" />
                      <span>每天 {emailPreferences?.dailyFollowTime || '07:00'}（台灣時間）寄出</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg gap-2 bg-white"
                      onClick={() => sendTestEmail.mutate()}
                      disabled={sendTestEmail.isPending}
                    >
                      <Send className="h-4 w-4" />
                      {emailProviderStatus?.configured ? '寄測試信' : '預覽測試信'}
                    </Button>
                  </div>

                  {emailPreview && (
                    <div className="mt-4 rounded-lg border border-sky-100 bg-white p-4">
                      <p className="text-xs font-semibold text-sky-600">測試信預覽</p>
                      <h4 className="mt-1 text-base font-bold text-foreground">{emailPreview.subject}</h4>
                      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                        {emailPreview.text}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-lg shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <h3 className="text-base font-bold text-foreground">帳號與設定</h3>
                  <p className="mt-1 text-sm text-muted-foreground">更新名字、照片與個人資料。</p>
                </div>
                <Button
                  variant="outline"
                  className="h-10 rounded-lg gap-2"
                  onClick={() => setShowProfileSettings(true)}
                >
                  <Settings className="h-4 w-4" />
                  個人設定
                </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </main>

      <ProfileSettingsDialog
        open={showProfileSettings}
        onOpenChange={setShowProfileSettings}
      />
    </div>
  );
};

export default MePage;
