import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PrayerComment {
  id: string;
  prayer_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
  is_owner: boolean;
}

export const usePrayerComments = (prayerId: string) => {
  return useQuery({
    queryKey: ['prayer-comments', prayerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_prayer_comments')
        .select('*')
        .eq('prayer_id', prayerId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PrayerComment[];
    },
    enabled: !!prayerId,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ prayerId, content }: { prayerId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('prayer_comments')
        .insert({
          prayer_id: prayerId,
          user_id: user.id,
          content: content.trim(),
        });

      if (error) throw error;
    },
    onSuccess: (_, { prayerId }) => {
      queryClient.invalidateQueries({ queryKey: ['prayer-comments', prayerId] });
      toast.success('留言已發布');
    },
    onError: (error) => {
      console.error('Error creating comment:', error);
      toast.error('留言失敗');
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, prayerId }: { commentId: string; prayerId: string }) => {
      const { error } = await supabase
        .from('prayer_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return prayerId;
    },
    onSuccess: (prayerId) => {
      queryClient.invalidateQueries({ queryKey: ['prayer-comments', prayerId] });
      toast.success('留言已刪除');
    },
    onError: (error) => {
      console.error('Error deleting comment:', error);
      toast.error('刪除失敗');
    },
  });
};
