import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudyResponse, StudyResponseFormData, emptyFormData, parseCategories, parseNotes, serializeCategories, serializeNotes } from '@/types/spiritual-fitness';
import { toast } from 'sonner';
import { HIGH_CONCURRENCY_CONFIG, getPollingInterval } from '@/lib/retry-utils';

const POLLING_INTERVAL = getPollingInterval(HIGH_CONCURRENCY_CONFIG.STUDY_RESPONSE_POLL_MS);
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
  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);

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
    refetchInterval: () => {
      if (isDirtyRef.current || isSavingRef.current) {
        return false;
      }
      return POLLING_INTERVAL;
    },
    staleTime: POLLING_INTERVAL - 500,
  });

  useEffect(() => {
    if (response && !isDirty && !isSaving && !isInitialized.current) {
      const coreCategory = response.coreInsightCategory || response.core_insight_category || null;
      const coreNote = response.coreInsightNote || response.core_insight_note || null;
      const parsedCategories = parseCategories(coreCategory);
      setLocalFormData({
        title_phrase: response.titlePhrase || response.title_phrase || '',
        heartbeat_verse: response.heartbeatVerse || response.heartbeat_verse || '',
        observation: response.observation || '',
        core_insight_category: parsedCategories,
        core_insight_note: parseNotes(coreNote, parsedCategories),
        scholars_note: response.scholarsNote || response.scholars_note || '',
        action_plan: response.actionPlan || response.action_plan || '',
        cool_down_note: response.coolDownNote || response.cool_down_note || '',
      });
      isInitialized.current = true;
    }
  }, [response, isDirty, isSaving]);

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

      const res = await fetch('/api/study-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed: ${res.status} ${text}`);
      }

      return await res.json();
    },
    onSuccess: (savedData) => {
      setIsDirty(false);
      setIsSaving(false);
      if (savedData && typeof savedData === 'object' && savedData.id) {
        queryClient.setQueryData(queryKey, savedData);
      }
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
