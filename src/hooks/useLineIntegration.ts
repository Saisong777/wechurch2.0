import { useMutation, useQuery } from '@tanstack/react-query';

export interface LineLoginConfig {
  configured: boolean;
  channelId: string | null;
  liffId: string | null;
  officialAccountId: string | null;
  callbackPath: string;
  callbackUrl: string;
  loginUrlPath: string;
}

export function useLineLoginConfig() {
  return useQuery<LineLoginConfig>({
    queryKey: ['line-login-config'],
    queryFn: async () => {
      const response = await fetch('/api/line-login/config', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch LINE Login config');
      return response.json();
    },
    retry: false,
  });
}

export function useLineLoginUrl() {
  return useMutation({
    mutationFn: async (redirectPath = '/admin/crm') => {
      const params = new URLSearchParams({ redirect: redirectPath });
      const response = await fetch(`/api/line-login/url?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<{ configured: boolean; url: string; redirectPath: string }>;
    },
  });
}
