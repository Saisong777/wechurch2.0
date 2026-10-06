import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchContext, useChurchScopeKey } from '@/contexts/ChurchContext';
import { churchFetch } from '@/lib/churchFetch';
import type { ChurchOnboardingStatus, ChurchLoginSummary, ChurchChoiceResult } from '@shared/churchOnboarding';
export type { ChurchOnboardingStatus, ChurchLoginSummary } from '@shared/churchOnboarding';

export const onboardingKey = '/api/me/church-onboarding';
export const loginSummaryKey = '/api/me/church-login-summary';
export const loginInboxKey = '/api/admin/church-login-inbox';

export async function churchOnboardingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const response = await churchFetch(path, {
    credentials: 'include', cache: 'no-store', ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
  if (!response.ok) {
    let message = '';
    try { const body = await response.json(); message = typeof body.error === 'string' ? body.error : ''; } catch { /* Keep the bounded fallback. */ }
    throw new Error(message || (response.status === 409 ? '資料已更新，請重新載入後確認。' : '暫時無法確認資料，請重試。'));
  }
  return response.json();
}

export function useChurchOnboarding() {
  const { user, loading } = useAuth();
  const church = useChurchContext();
  const scope = useChurchScopeKey();
  return useQuery<ChurchOnboardingStatus>({
    queryKey: [onboardingKey, user?.id, scope], enabled: !!user && !loading && !church?.loading,
    queryFn: ({ signal }) => churchOnboardingRequest(onboardingKey, { signal }), retry: false,
    staleTime: 10000, refetchInterval: 30000, refetchIntervalInBackground: false,
  });
}

export function useChooseInitialChurch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { churchId: string; requestId: string }) => churchOnboardingRequest<ChurchChoiceResult>(onboardingKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [onboardingKey] });
      await client.invalidateQueries({ queryKey: [loginSummaryKey] });
    },
  });
}

export function useChurchLoginSummary() {
  const { user, loading } = useAuth();
  const church = useChurchContext();
  const scope = useChurchScopeKey();
  return useQuery<ChurchLoginSummary>({
    queryKey: [loginSummaryKey, user?.id, scope], enabled: !!user && !loading && !church?.loading,
    queryFn: ({ signal }) => churchOnboardingRequest(loginSummaryKey, { signal }), retry: false,
    staleTime: 10000, refetchInterval: 30000, refetchIntervalInBackground: false,
  });
}
