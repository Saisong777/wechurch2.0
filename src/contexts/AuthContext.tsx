import * as React from 'react';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { withRetry, staggeredStart } from '@/lib/retry-utils';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Retry configuration for auth operations - more aggressive for high-concurrency scenarios
const AUTH_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  jitterFactor: 0.4, // Higher jitter to spread load
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // Stagger initial session check to prevent thundering herd
    let cancelled = false;
    const initSession = async () => {
      // Add 0-1.5s random delay to spread initial load
      await staggeredStart(1500);
      
      if (cancelled) return;

      try {
        // Use retry mechanism for session fetch
        const result = await withRetry(
          async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data;
          },
          AUTH_RETRY_OPTIONS
        );
        
        if (!cancelled) {
          setSession(result.session);
          setUser(result.session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.warn('[AuthContext] Failed to get session after retries:', error);
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    initSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await withRetry(
        async () => {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          return { error: null };
        },
        AUTH_RETRY_OPTIONS
      );
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signOut = async () => {
    try {
      await withRetry(
        async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        },
        { ...AUTH_RETRY_OPTIONS, maxRetries: 2 }
      );
    } catch (error) {
      console.warn('[AuthContext] Sign out failed after retries:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut }}>
      {children}
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
