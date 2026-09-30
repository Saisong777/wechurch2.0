import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import type { EmailProviderStatus } from '@shared/email';
import { toast } from 'sonner';

interface Preferences { interactionEmailEnabled:boolean; interactionEmailConsentAt:string | null }
export function NotificationEmailSettings() {
  const { user } = useAuth(); const client = useQueryClient();
  const key = ['/api/email-preferences',user?.id];
  const prefs = useQuery<Preferences>({queryKey:key,enabled:!!user,retry:false,queryFn:async() => (await apiRequest('GET','/api/email-preferences')).json()});
  const status = useQuery<EmailProviderStatus>({queryKey:['/api/email-provider-status',user?.id],enabled:!!user,retry:false,queryFn:async() => (await apiRequest('GET','/api/email-provider-status')).json()});
  const enabled = !!(prefs.data?.interactionEmailEnabled && prefs.data?.interactionEmailConsentAt);
  const update = useMutation({mutationFn:async(interactionEmailEnabled:boolean) => (await apiRequest('PATCH','/api/email-preferences',{interactionEmailEnabled})).json(),
    onSuccess:async(data) => { client.setQueryData(key,data); await client.invalidateQueries({queryKey:['/api/email-preferences']}); toast.success(data.interactionEmailEnabled ? '已開啟 Email 通知' : '已關閉 Email 通知'); },
    onError:() => toast.error('設定尚未儲存，請重試')});
  return <section id="email-settings" aria-labelledby="notification-email-title" className="mt-8 scroll-mt-28 border-t py-6">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 id="notification-email-title" className="flex items-center gap-2 text-lg font-semibold"><Mail className="h-5 w-5 shrink-0" />Email 通知</h2>
      <p className="mt-2 leading-7 text-muted-foreground">有新回應還沒閱讀時，用 Email 提醒我。</p></div>
      <Switch aria-label="Email 互動通知" checked={enabled} disabled={prefs.isPending || status.isPending || prefs.isError || status.isError || update.isPending || (!enabled && !status.data?.interactionNotificationsEnabled)} onCheckedChange={value => update.mutate(value)} className="mt-1 shrink-0" />
    </div>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">預設關閉；不寄出禱告或留言內容。新回應會合併提醒，每小時最多一封。</p>
    {status.data && !status.data.interactionNotificationsEnabled && <p role="status" className="mt-2 text-sm text-muted-foreground">互動 Email 尚未啟用；站內通知照常使用。</p>}
    {(prefs.isError || status.isError) && <div role="alert" className="mt-3"><p>通知設定暫時無法載入。</p><Button variant="outline" className="mt-2" onClick={() => { void prefs.refetch(); void status.refetch(); }}>重新載入設定</Button></div>}
  </section>;
}
