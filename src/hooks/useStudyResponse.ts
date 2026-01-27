import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StudyResponse, StudyResponseFormData, emptyFormData, InsightCategory } from '@/types/spiritual-fitness';
import { toast } from 'sonner';

const POLLING_INTERVAL = 4000; // 4 seconds
const DEBOUNCE_DELAY = 1000; // 1 second

interface UseStudyResponseOptions {
  sessionId: string | undefined;
  userId: string | undefined;
  userEmail?: string | undefined;
  enabled?: boolean;
}

export function useStudyResponse({ sessionId, userId, userEmail, enabled = true }: UseStudyResponseOptions) {
  const queryClient = useQueryClient();
  const [localFormData, setLocalFormData] = useState<StudyResponseFormData>(emptyFormData);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  // Get email from localStorage if not provided
  const participantEmail = userEmail || localStorage.getItem('bible_study_guest_email') || '';

  // Query for existing response (use edge function for reliability)
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['study_response', sessionId, userId],
    queryFn: async () => {
      if (!sessionId || !userId) return null;
      
      // Try direct query first (works for authenticated users)
      const { data, error } = await supabase
        .from('study_responses')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

      // If RLS blocks us, the error will be caught but data will be null
      if (error) {
        console.log('[useStudyResponse] Direct query failed, may need edge function:', error.message);
      }
      return data as StudyResponse | null;
    },
    enabled: enabled && !!sessionId && !!userId,
    refetchInterval: POLLING_INTERVAL,
    staleTime: POLLING_INTERVAL - 500,
  });

  // Sync server data to local state (only when not dirty and on initial load)
  useEffect(() => {
    if (response && !isDirty && !isInitialized.current) {
      setLocalFormData({
        title_phrase: response.title_phrase || '',
        heartbeat_verse: response.heartbeat_verse || '',
        observation: response.observation || '',
        core_insight_category: response.core_insight_category as InsightCategory | null,
        core_insight_note: response.core_insight_note || '',
        scholars_note: response.scholars_note || '',
        action_plan: response.action_plan || '',
        cool_down_note: response.cool_down_note || '',
      });
      isInitialized.current = true;
    }
  }, [response, isDirty]);

  // Upsert mutation - use Edge Function to bypass RLS
  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<StudyResponseFormData>) => {
      if (!sessionId || !userId) throw new Error('Missing session or user ID');
      if (!participantEmail) throw new Error('Missing participant email');

      // Use Edge Function for reliable writes
      const { data: result, error } = await supabase.functions.invoke('save-study-response', {
        body: {
          sessionId,
          participantId: userId,
          participantEmail,
          formData: data,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      return result.data;
    },
    onSuccess: () => {
      setIsDirty(false);
      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ['study_response', sessionId, userId] });
    },
    onError: (error) => {
      console.error('Failed to save study response:', error);
      setIsSaving(false);
      toast.error('儲存失敗，請稍後再試');
    },
  });

  // Debounced save function
  const debouncedSave = useCallback((data: StudyResponseFormData) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      upsertMutation.mutate(data);
    }, DEBOUNCE_DELAY);
  }, [upsertMutation]);

  // Update a single field
  const updateField = useCallback(<K extends keyof StudyResponseFormData>(
    field: K,
    value: StudyResponseFormData[K]
  ) => {
    setLocalFormData(prev => {
      const updated = { ...prev, [field]: value };
      setIsDirty(true);
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  // Immediate save (for blur events)
  const saveNow = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (isDirty) {
      setIsSaving(true);
      upsertMutation.mutate(localFormData);
    }
  }, [isDirty, localFormData, upsertMutation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    formData: localFormData,
    response,
    isLoading,
    isSaving: isSaving || upsertMutation.isPending,
    isDirty,
    error,
    updateField,
    saveNow,
    reset: () => {
      setLocalFormData(emptyFormData);
      setIsDirty(false);
      isInitialized.current = false;
    },
  };
}
