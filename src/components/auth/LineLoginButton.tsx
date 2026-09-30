import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SiLine } from 'react-icons/si';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { safeLoginReturn } from '@/lib/loginReturn';

export function LineLoginButton() {
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const config = useQuery({ queryKey: ['line-login-availability'], retry: false, queryFn: async () => {
    const response = await fetch('/api/line-login/config', { credentials: 'include' });
    return response.ok ? await response.json() as { configured: boolean } : { configured: false };
  } });
  if (!config.data?.configured) return null;
  return <div className="mb-4 space-y-2"><Button type="button" disabled={busy} className="h-12 w-full gap-3" onClick={async () => {
    setBusy(true); setError('');
    try {
      const redirect = safeLoginReturn(params.get('returnTo'));
      const response = await fetch(`/api/line-login/url?redirect=${encodeURIComponent(redirect)}`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'LINE 登入暫時無法使用');
      const url = new URL(data.url);
      if (url.origin !== 'https://access.line.me') throw new Error('LINE 登入網址無效');
      window.location.assign(url.href);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }}><SiLine className="h-5 w-5" />{busy ? '正在前往 LINE…' : '使用 LINE 登入'}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
