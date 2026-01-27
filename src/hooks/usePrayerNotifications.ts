import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    queryKey: ['prayer-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as PrayerNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30 seconds
  });
};

export const useUnreadNotificationCount = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['prayer-notifications-unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('prayer_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 15000, // Poll every 15 seconds
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('prayer_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['prayer-notifications-unread-count'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('prayer_notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['prayer-notifications-unread-count'] });
    },
  });
};

export const useClearAllNotifications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('prayer_notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['prayer-notifications-unread-count'] });
    },
  });
};
