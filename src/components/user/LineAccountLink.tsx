import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function LineAccountLink() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const config = useQuery({ queryKey: ['/api/line-login/config', user?.id], enabled: !!user, retry: false, queryFn: async () => {
    const r = await fetch('/api/line-login/config', { credentials: 'include' });
    return r.ok ? r.json() as Promise<{ configured: boolean }> : { configured: false };
  } });
  if (!user || !config.data?.configured) return null;
  return <div className="space-y-2"><Button variant="outline" disabled={busy} onClick={async () => {
    if (!window.confirm('將接下來授權的 LINE 帳號綁定到目前帳號？原本的登入方式與紀錄會保留。')) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/line-login/url?link=1&redirect=%2Fme', { credentials: 'include' });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || '無法啟動綁定。');
      const url = new URL(data.url); if (url.origin !== 'https://access.line.me') throw new Error('無效的 LINE 授權網址。');
      window.location.assign(url.toString());
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }}><Link2 className="mr-2 h-4 w-4" />綁定 LINE 帳號</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
