import { CheckCircle2, Copy, ExternalLink, MessageCircle, Shield, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLineLoginConfig, useLineLoginUrl } from '@/hooks/useLineIntegration';

export function LineIntegrationPanel() {
  const configQuery = useLineLoginConfig();
  const loginUrlMutation = useLineLoginUrl();
  const config = configQuery.data;

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch (error) {
      console.error(error);
      toast.error('複製失敗');
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await loginUrlMutation.mutateAsync('/admin/crm');
      await handleCopy(result.url, 'LINE 登入連結已複製');
    } catch (error) {
      console.error(error);
      toast.error('LINE Login 尚未設定完成');
    }
  };

  if (configQuery.isLoading) {
    return <Skeleton className="h-56" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">LINE@ 入口整合</h2>
          <p className="text-sm text-muted-foreground">讓同工用既有 LINE 帳號登入，系統再綁定到 WeChurch 使用者與牧養主檔。</p>
        </div>
        <Badge variant={config?.configured ? 'default' : 'secondary'} className="w-fit gap-1">
          {config?.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {config?.configured ? '已設定' : '待設定'}
        </Badge>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              登入流程
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['1', '同工從 LINE@ 或 LIFF 打開 WeChurch'],
              ['2', 'LINE Login 回傳 LINE userId / profile'],
              ['3', '後端驗證 ID token，不信任前端資料'],
              ['4', '建立或綁定 users、persons、line_accounts'],
              ['5', '沿用現有 CRM 角色與教會權限'],
            ].map(([step, label]) => (
              <div key={step} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {step}
                </span>
                <p className="text-sm leading-6">{label}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              設定狀態
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Channel ID</p>
              <p className="mt-1 break-all text-sm font-medium">{config?.channelId || '尚未設定 LINE_CHANNEL_ID'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">LIFF ID</p>
              <p className="mt-1 break-all text-sm font-medium">{config?.liffId || '尚未設定 LINE_LIFF_ID'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Callback URL</p>
              <p className="mt-1 break-all text-sm font-medium">{config?.callbackUrl || '-'}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="gap-2" disabled={!config?.configured} onClick={handleGenerate}>
                <Copy className="h-4 w-4" />
                複製登入連結
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={!config?.configured}
                onClick={async () => {
                  const result = await loginUrlMutation.mutateAsync('/admin/crm');
                  window.open(result.url, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink className="h-4 w-4" />
                測試登入
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {!config?.configured && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="p-4">
            <p className="font-semibold text-amber-900">要正式啟用還需要 LINE Developers 設定</p>
            <p className="mt-2 text-sm leading-6 text-amber-900/80">
              需要在環境變數加入 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`，並把 LINE Login channel 的 callback 設為上方 Callback URL。若要放在 LINE@ 選單內，建議再設定 LIFF ID。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
