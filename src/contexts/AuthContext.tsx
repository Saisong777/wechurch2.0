import * as React from 'react';
import { useState, useEffect, useRef, useCallback, createContext, useContext, ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';

interface AuthUser {
  id: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  legacyUserId?: string;
  displayName?: string;
  role?: string;
  church?: string | null;
  user_metadata?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface AuthContextType {
  session: { user: AuthUser } | null;
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000;
const AUTH_FAILURE_THRESHOLD = 5; // 5 × 5min = 25min tolerance (handles deploys/network blips)

function mapUserData(userData: AuthUser): AuthUser {
  if (!userData || typeof (userData.legacyUserId || userData.id) !== 'string' || !(userData.legacyUserId || userData.id)) {
    throw new Error('Invalid session response');
  }
  return {
    id: userData.legacyUserId || userData.id,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    profileImageUrl: userData.profileImageUrl,
    legacyUserId: userData.legacyUserId,
    displayName: userData.displayName,
    role: userData.role,
    church: userData.church,
    user_metadata: {
      display_name: userData.displayName || (userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : undefined),
      avatar_url: userData.profileImageUrl || undefined,
    },
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, updateUser] = useState<AuthUser | null>(null);
  const accountRef = useRef<string | null>(null);
  const setUser = useCallback((next: AuthUser | null) => {
    const account = next?.id || null;
    if (accountRef.current !== account) queryClient.clear();
    accountRef.current = account;
    updateUser(next);
  }, []);
  const [loading, setLoading] = useState(true);
  const failureCountRef = useRef(0);
  const hadUserRef = useRef(false);
  const requestRef = useRef(0);
  const controllerRef = useRef<AbortController>();
  const authAttemptRef = useRef(0);
  const changingAuthRef = useRef(false);

  const invalidateRequest = useCallback(() => {
    requestRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  const fetchUser = useCallback(async (isInitial = false): Promise<AuthUser | null> => {
    invalidateRequest();
    const request = requestRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        signal: controller.signal,
      });
      if (request !== requestRef.current) return null;

      if (response.ok) {
        const userData = await response.json();
        if (request !== requestRef.current) return null;
        const authUser = mapUserData(userData);
        setUser(authUser);
        hadUserRef.current = true;
        failureCountRef.current = 0;
        return authUser;
      } else {
        if (isInitial || response.status === 401 || response.status === 403) {
          setUser(null);
          hadUserRef.current = false;
        } else if (hadUserRef.current) {
          failureCountRef.current += 1;
          if (failureCountRef.current >= AUTH_FAILURE_THRESHOLD) {
            setUser(null);
            hadUserRef.current = false;
          }
        }
        return null;
      }
    } catch (error) {
      if (request !== requestRef.current || controller.signal.aborted) return null;
      console.warn('[AuthContext] Failed to fetch user:', error);
      if (isInitial) {
        setUser(null);
      } else if (hadUserRef.current) {
        failureCountRef.current += 1;
        if (failureCountRef.current >= AUTH_FAILURE_THRESHOLD) {
          setUser(null);
          hadUserRef.current = false;
        }
      }
      return null;
    }
  }, [invalidateRequest, setUser]);

  useEffect(() => {
    let active = true;
    fetchUser(true).finally(() => { if (active) setLoading(false); });

    const interval = setInterval(() => {
      if (!changingAuthRef.current) void fetchUser(false);
    }, SESSION_REFRESH_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
      invalidateRequest();
      authAttemptRef.current += 1;
    };
  }, [fetchUser, invalidateRequest]);

  const authenticate = async (path: string, body: { email: string; password: string; displayName?: string }, action: string) => {
    // Serialize account changes; an old refresh must never restore a previous account.
    if (changingAuthRef.current) return { error: new Error('登入處理中，請稍候') };
    changingAuthRef.current = true;
    const attempt = ++authAttemptRef.current;
    invalidateRequest();
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: new Error(data.message || `${action}失敗`) };
      }

      if (attempt !== authAttemptRef.current) return { error: new Error('登入已取消') };
      setUser(null);
      hadUserRef.current = false;
      const authenticated = await fetchUser(false);
      return { error: authenticated ? null : new Error('無法確認登入狀態，請稍後重試') };
    } catch {
      return { error: new Error(`${action}失敗，請稍後重試`) };
    } finally {
      if (attempt === authAttemptRef.current) {
        changingAuthRef.current = false;
        setLoading(false);
      }
    }
  };
  const signUp = (email: string, password: string, displayName?: string) => authenticate('/api/auth/register', { email, password, displayName }, '註冊');
  const signIn = (email: string, password: string) => authenticate('/api/auth/email-login', { email, password }, '登入');

  const signOut = async () => {
    invalidateRequest();
    authAttemptRef.current += 1;
    changingAuthRef.current = true;
    hadUserRef.current = false;
    setUser(null);
    queryClient.clear();
    window.location.href = '/api/logout';
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut }}>
      <React.Fragment key={user?.id || 'signed-out'}>{children}</React.Fragment>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
