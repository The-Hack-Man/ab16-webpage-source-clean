import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  user: User | null;
  role: string | null;
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
export type { AuthContextValue };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) console.error('Could not restore authentication session:', error.message);
        setSession(data.session);
      })
      .catch((error: unknown) => {
        console.error('Could not restore authentication session:', error instanceof Error ? error.message : 'Unknown error');
        setSession(null);
      })
      .finally(() => setLoading(false));

    return () => sub.subscription.unsubscribe();
  }, []);

  const role = (session?.user?.app_metadata?.role as string | undefined) ?? null;
  const isAdmin = role === 'admin' || role === 'super_admin';

  const value: AuthContextValue = {
    session,
    loading,
    signOut: () => supabase.auth.signOut().then(() => {}),
    user: session?.user ?? null,
    role,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

