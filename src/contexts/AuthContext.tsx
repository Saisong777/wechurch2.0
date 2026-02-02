import * as React from 'react';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface AuthUser {
  id: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  legacyUserId?: string;
  displayName?: string;
  role?: string;
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const userData = await response.json();
          const authUser: AuthUser = {
            id: userData.legacyUserId || userData.id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            legacyUserId: userData.legacyUserId,
            displayName: userData.displayName,
            role: userData.role,
            user_metadata: {
              display_name: userData.displayName || (userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : undefined),
              avatar_url: userData.profileImageUrl,
            },
          };
          setUser(authUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.warn('[AuthContext] Failed to fetch user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const signUp = async (_email: string, _password: string, _displayName?: string) => {
    window.location.href = '/api/login';
    return { error: null };
  };

  const signIn = async (_email: string, _password: string) => {
    window.location.href = '/api/login';
    return { error: null };
  };

  const signOut = async () => {
    window.location.href = '/api/logout';
  };

  const session = user ? { user } : null;

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
