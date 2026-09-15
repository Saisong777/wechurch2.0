import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export function MobileAccountActions({ close }: { close: () => void }) {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, isLeader } = useUserRole();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const style = 'flex min-h-12 items-center justify-center gap-2 rounded-md px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring';
  if (loading) return null;
  return <div className="mx-auto flex max-w-xl flex-wrap justify-end gap-1 border-t border-border px-2 py-1" data-testid="mobile-account-actions">
    {!user ? <Link className={style} to="/login" onClick={close}><LogIn className="h-4 w-4" />登入</Link> : <>
      {(isAdmin || isLeader) && <><Link className={style} to="/work" onClick={close}><Shield className="h-4 w-4" />同工工作區</Link><Link className={style} to="/admin" onClick={close}>管理後台</Link></>}
      <button className={style} type="button" disabled={busy} onClick={async () => {
        if (!window.confirm('要登出嗎？請先儲存尚未完成的內容。')) return;
        setBusy(true);
        try { await signOut(); close(); navigate('/'); }
        catch { toast.error('登出失敗，請再試一次。'); }
        finally { setBusy(false); }
      }}><LogOut className="h-4 w-4" />{busy ? '登出中...' : '登出'}</button>
    </>}
  </div>;
}
