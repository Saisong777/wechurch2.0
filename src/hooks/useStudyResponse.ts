import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudyResponse, StudyResponseFormData, emptyFormData, parseCategories, parseNotes, serializeCategories, serializeNotes } from '@/types/spiritual-fitness';
import { toast } from 'sonner';
import { HIGH_CONCURRENCY_CONFIG } from '@/lib/retry-utils';
import { apiRequest } from '@/lib/queryClient';

const POLLING_INTERVAL = HIGH_CONCURRENCY_CONFIG.STUDY_RESPONSE_POLL_MS;
const DEBOUNCE_DELAY = HIGH_CONCURRENCY_CONFIG.SAVE_DEBOUNCE_MS;

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

  const queryKey = ['study_response', sessionId, userId] as const;

  const participantEmail = userEmail || localStorage.getItem('bible_study_guest_email') || '';

  const { data: response, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!sessionId || !userId) return null;
      
      const res = await fetch(`/api/study-responses/${sessionId}/${userId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch study response');
      }
      const data = await res.json();
      return data as StudyResponse | null;
    },
    enabled: enabled && !!sessionId && !!userId,
    refetchInterval: POLLING_INTERVAL,
    staleTime: POLLING_INTERVAL - 500,
  });

  useEffect(() => {
    if (response && !isDirty && !isInitialized.current) {
      const parsedCategories = parseCategories(response.core_insight_category);
      setLocalFormData({
        title_phrase: response.title_phrase || '',
        heartbeat_verse: response.heartbeat_verse || '',
        observation: response.observation || '',
        core_insight_category: parsedCategories,
        core_insight_note: parseNotes(response.core_insight_note, parsedCategories),
        scholars_note: response.scholars_note || '',
        action_plan: response.action_plan || '',
        cool_down_note: response.cool_down_note || '',
      });
      isInitialized.current = true;
    }
  }, [response, isDirty]);

  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<StudyResponseFormData>) => {
      if (!sessionId || !userId) throw new Error('Missing session or user ID');
      if (!participantEmail) throw new Error('Missing participant email');

      const { core_insight_category, core_insight_note, ...rest } = data;

      const payload = {
        sessionId,
        participantId: userId,
        participantEmail,
        ...rest,
        ...(core_insight_category !== undefined && {
          core_insight_category: serializeCategories(core_insight_category as any),
        }),
        ...(core_insight_note !== undefined && {
          core_insight_note: serializeNotes(core_insight_note as any),
        }),
      };

      const result = await apiRequest('POST', '/api/study-responses', payload);
      return result;
    },
    onSuccess: (saved) => {
      setIsDirty(false);
      setIsSaving(false);
      queryClient.setQueryData(queryKey, saved);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error('Failed to save study response:', error);
      setIsSaving(false);
      toast.error('儲存失敗，請稍後再試');
    },
  });

  const debouncedSave = useCallback((data: StudyResponseFormData) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      upsertMutation.mutate(data);
    }, DEBOUNCE_DELAY);
  }, [upsertMutation]);

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

  const saveNow = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (isDirty) {
      setIsSaving(true);
      try {
        await upsertMutation.mutateAsync(localFormData);
      } catch {
      }
    }
  }, [isDirty, localFormData, upsertMutation]);

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
