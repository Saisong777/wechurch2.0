import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { HIGH_CONCURRENCY_CONFIG, getPollingInterval } from '@/lib/retry-utils';

export interface PrayerNotification {
  id: string;
  prayer_id: string;
  type: 'amen' | 'comment';
  actor_name: string;
  is_read: boolean;
  created_at: string;
}

export const usePrayerNotifications = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['/api/prayer-notifications'],
    enabled: !!user,
    refetchInterval: getPollingInterval(HIGH_CONCURRENCY_CONFIG.PRAYER_NOTIFICATION_FULL_POLL_MS),
  });
};

export const useUnreadNotificationCount = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['/api/prayer-notifications/unread-count'],
    enabled: !!user,
    refetchInterval: getPollingInterval(HIGH_CONCURRENCY_CONFIG.PRAYER_NOTIFICATION_POLL_MS),
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest('PATCH', `/api/prayer-notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-notifications/unread-count'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/prayer-notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-notifications/unread-count'] });
    },
  });
};

export const useClearAllNotifications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/prayer-notifications');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prayer-notifications/unread-count'] });
    },
  });
};
