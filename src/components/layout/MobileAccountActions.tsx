import { usePastoralAccess } from '@/hooks/usePastoralAccess';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Shield, Settings2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export function MobileAccountActions({ close }: { close: () => void }) {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, isLeader } = useUserRole();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const style = 'mobile-menu-utility';
  const pastoralAccess = usePastoralAccess();
  if (loading) return null;
  return <div className="mobile-menu-account" data-testid="mobile-account-actions">
    {!user ? <Link className={`${style} mobile-menu-login`} to="/login" onClick={close}><LogIn className="h-4 w-4" aria-hidden="true" />登入</Link> : <>
      {(isAdmin || isLeader || (!pastoralAccess.isError && pastoralAccess.data?.available)) && <section aria-label="同工管理"><h2 className="mobile-menu-label">同工管理</h2><div className="mobile-menu-staff"><Link className={style} to="/work" onClick={close}><Shield className="h-4 w-4" aria-hidden="true" />同工工作區</Link>{(isAdmin || isLeader) && <Link className={style} to="/admin" onClick={close}><Settings2 className="h-4 w-4" aria-hidden="true" />管理後台</Link>}</div></section>}
      <button className={`${style} mobile-menu-signout`} type="button" disabled={busy} onClick={async () => {
        if (!window.confirm('要登出嗎？請先儲存尚未完成的內容。')) return;
        setBusy(true);
        try { await signOut(); close(); navigate('/'); }
        catch { toast.error('登出失敗，請再試一次。'); }
        finally { setBusy(false); }
      }}><LogOut className="h-4 w-4" aria-hidden="true" />{busy ? '登出中...' : '登出'}</button>
    </>}
  </div>;
}
