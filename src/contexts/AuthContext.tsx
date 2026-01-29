import * as React from 'react';
import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { staggeredStart, withRetry } from '@/lib/retry-utils';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // HIGH CONCURRENCY: Stagger initial session check to prevent thundering herd
    // When 100+ users open the app simultaneously, this spreads the load over 1.5s
    let cancelled = false;
    staggeredStart(1500).then(async () => {
      if (cancelled) return;
      
      try {
        // Use retry logic in case of transient network issues
        const sessionData = await withRetry(
          async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data.session;
          },
          { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 2000, jitterFactor: 0.4 }
        );
        
        if (!cancelled) {
          setSession(sessionData);
          setUser(sessionData?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[AuthContext] Failed to get session, user may need to re-login:', err);
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    });

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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
