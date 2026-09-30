import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBell() {
  const { user } = useAuth();
  const query = useNotifications();
  if (!user) return null;
  const count = query.isError ? 0 : query.data?.unreadCount || 0;
  return <Link to="/notifications" className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    title="通知" aria-label={query.isError ? '通知，暫時無法取得未讀數' : `通知${count ? `，${count} 則未讀` : ''}`}>
    <Bell className="h-[22px] w-[22px]" aria-hidden="true" />
    {count > 0 && <span aria-hidden="true" className="absolute right-0 top-0 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-destructive px-[4px] text-[12px] font-semibold leading-[20px] text-destructive-foreground">{count > 99 ? '99+' : count}</span>}
  </Link>;
}
