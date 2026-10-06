import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useChurchLoginSummary } from '@/hooks/useChurchOnboarding';

export function NotificationBell() {
  const { user } = useAuth();
  const query = useNotifications();
  const management = useChurchLoginSummary();
  if (!user) return null;
  const count = (query.isError ? 0 : query.data?.unreadCount || 0) + (management.isError || !management.data?.canManage ? 0 : management.data.total);
  const unavailable = query.isError || management.isError;
  return <Link to="/notifications" className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    title="通知" aria-label={unavailable ? '通知，暫時無法取得完整待處理數' : `通知${count ? `，${count} 則未讀` : ''}`}>
    <Bell className="h-[22px] w-[22px]" aria-hidden="true" />
    {count > 0 && <span aria-hidden="true" className="absolute right-0 top-0 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-destructive px-[4px] text-[12px] font-semibold leading-[20px] text-destructive-foreground">{count > 99 ? '99+' : count}</span>}
  </Link>;
}
