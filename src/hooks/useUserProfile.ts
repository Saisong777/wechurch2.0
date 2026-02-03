import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      lastFetchedUserIdRef.current = null;
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${user.id}/profile`);
        if (res.ok) {
          const data = await res.json();
          setProfile({
            display_name: data.displayName || null,
            avatar_url: data.avatarUrl || null,
          });
        } else {
          setProfile({
            display_name: user.user_metadata?.display_name || user.displayName || null,
            avatar_url: user.user_metadata?.avatar_url || null,
          });
        }
        lastFetchedUserIdRef.current = user.id;
        hasFetchedRef.current = true;
      } catch {
        setProfile({
          display_name: user.user_metadata?.display_name || user.displayName || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        });
      } finally {
        setLoading(false);
      }
    };

    if (lastFetchedUserIdRef.current === user.id && hasFetchedRef.current) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const delay = Math.random() * 1500;
    const timeoutId = setTimeout(() => {
      if (!cancelled) fetchProfile();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user]);

  return { profile, loading };
};
