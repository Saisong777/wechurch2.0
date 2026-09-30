import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  BookHeart,
  BookMarked,
  ChevronRight,
  Clock,
  HeartHandshake,
  MailCheck,
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
import { LineAccountLink } from '@/components/user/LineAccountLink';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDevotionalNotes } from '@/hooks/useDevotionalNotes';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';
import { AppearanceControl } from '@/components/theme/AppearanceControl';
import type { EmailProviderStatus } from '@shared/email';

interface EmailPreferences {
  userId: string;
  dailyFollowEnabled: boolean;
  dailyFollowTime: string;
  timezone: string;
  lastDailyFollowSentAt: string | null;
  dailyFollowConsentAt: string | null;
  lastReminderDelivery?: { status: 'claimed' | 'accepted' | 'unconfirmed'; day: string } | null;
}

const recordActions = [
  { id:'activity',title:'待回應',subtitle:'',href:'/me/activity',icon:MailCheck,tone:'border-border bg-card',iconTone:'bg-primary/10 text-primary',featureKeys:[] },
  { id:'sharing',title:'我的分享',subtitle:'',href:'/me/sharing',icon:Send,tone:'border-border bg-card',iconTone:'bg-primary/10 text-primary',featureKeys:[] },
  { id: 'support', title: '尋求陪伴', subtitle: '', href: '/support', icon: HeartHandshake, tone: 'border-border bg-card', iconTone: 'bg-primary/10 text-primary', featureKeys: [] },
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
    id: 'grace-record',
    title: '恩典記錄簿',
    subtitle: '蒙應允的禱告與生活中的恩典。',
    href: '/grace-record?view=grace',
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
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [reminderTimezone, setReminderTimezone] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: devotionalNotes, isError: notesError } = useDevotionalNotes(user?.id);
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
    mutationFn: async (preferences: Partial<Pick<EmailPreferences, 'dailyFollowEnabled' | 'dailyFollowTime' | 'timezone'>>) => {
      const res = await apiRequest('PATCH', '/api/email-preferences', preferences);
      return res.json() as Promise<EmailPreferences>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/email-preferences'], { ...data, lastReminderDelivery: emailPreferences?.lastReminderDelivery });
      setReminderTime(null);
      setReminderTimezone(null);
      toast.success(data.dailyFollowEnabled && data.dailyFollowConsentAt ? '每日提醒設定已儲存' : '每日提醒已關閉');
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
        toast.info(data.message || '已產生預覽，沒有寄出郵件。');
        return;
      }
      setEmailPreview(null);
      toast.success('測試信已交付寄信服務，請檢查收件匣');
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
      <Header title="個人設定" subtitle="你的紀錄與設定" variant="compact" />

      <main className="container mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
          <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">個人設定</p>
                <h1 className="truncate text-2xl font-bold text-foreground">{displayName}</h1>
              </div>
            </div>
          </section>

          <section aria-label="外觀" className="space-y-3 border-b border-border py-4">
            <h2 className="text-lg font-semibold">外觀</h2>
            <div className="max-w-sm"><AppearanceControl inline /></div>
          </section>

          <section aria-labelledby="my-records-title">
            <LineAccountLink />
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
                      className={`group flex min-h-16 items-center gap-3 border-b border-border py-3 transition-colors hover:bg-muted/40`}
                      data-testid={`link-me-${action.id}`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${action.iconTone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-foreground">{action.title}</h3>
                        {action.id === 'devotional-notes' && (notesError ? <p className="mt-1 text-sm text-muted-foreground">筆記尚未更新，點此重新載入</p> : devotionalNotes.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{devotionalNotes.length} 則筆記</p>)}
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
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
                        <h3 className="text-base font-bold text-foreground">每日 Email 提醒</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          只寄給自己，不包含私人筆記或代禱內容。
                        </p>
                        <p className="mt-1 break-all text-sm text-muted-foreground">{user?.email}</p>
                        {emailPreferences?.dailyFollowEnabled && !emailPreferences.dailyFollowConsentAt && <p className="mt-2 text-sm text-muted-foreground">先前只儲存測試偏好，請重新開啟以確認收信。</p>}
                        {emailProviderStatus && !emailProviderStatus.canSend && (
                          <p role="status" className="mt-2 text-sm leading-6 text-muted-foreground">
                            {emailProviderStatus.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(emailPreferences?.dailyFollowEnabled && emailPreferences.dailyFollowConsentAt)}
                      disabled={emailPreferencesLoading || updateEmailPreferences.isPending || (!emailProviderStatus?.remindersEnabled && !emailPreferences?.dailyFollowEnabled)}
                      onCheckedChange={(checked) => updateEmailPreferences.mutate({ dailyFollowEnabled: checked })}
                      aria-label="每日 Email 提醒"
                    />
                  </div>

                  <div className="mt-4 grid gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                    <label className="space-y-1"><span className="flex items-center gap-2"><Clock className="h-4 w-4" />寄送時間</span>
                      <input className="h-11 w-full min-w-0 rounded-md border bg-background px-3" type="time" value={reminderTime ?? emailPreferences?.dailyFollowTime ?? '07:00'} onChange={event => setReminderTime(event.target.value)} />
                    </label>
                    <label className="space-y-1"><span>時區</span>
                      <select className="h-11 w-full min-w-0 rounded-md border bg-background px-3" value={reminderTimezone ?? emailPreferences?.timezone ?? 'Asia/Taipei'} onChange={event => setReminderTimezone(event.target.value)}>
                        {[...new Set(['Asia/Taipei', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Australia/Sydney', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'UTC', emailPreferences?.timezone || 'Asia/Taipei'])].map(zone => <option key={zone} value={zone}>{zone}</option>)}
                      </select>
                    </label>
                    <Button variant="outline" disabled={updateEmailPreferences.isPending || (!reminderTime && !reminderTimezone)} onClick={() => updateEmailPreferences.mutate({ dailyFollowTime: reminderTime ?? emailPreferences?.dailyFollowTime ?? '07:00', timezone: reminderTimezone ?? emailPreferences?.timezone ?? 'Asia/Taipei' })}>儲存時間</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg gap-2 bg-card"
                      onClick={() => sendTestEmail.mutate()}
                      disabled={sendTestEmail.isPending}
                    >
                      <Send className="h-4 w-4" />
                      {emailProviderStatus?.canSend ? '寄一封給自己' : '預覽提醒信'}
                    </Button>
                  </div>

                  {emailPreferences?.lastReminderDelivery && <p role="status" className="mt-3 text-sm text-muted-foreground">
                    {emailPreferences.lastReminderDelivery.day}：{emailPreferences.lastReminderDelivery.status === 'accepted' ? '提醒已交付寄信服務，請確認收件匣。' : '寄送結果尚未確認，未自動重寄。'}
                  </p>}
                  {emailPreview && (
                    <div className="mt-4 rounded-lg border border-sky-100 bg-card p-4">
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
