import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { withDeadline } from '@/lib/request';
type AuthState = {
  session: Session | null; user: User | null; loading: boolean;
  error: string | null; retrySession: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true, receivedEvent = false;
    setLoading(true); setError(null);
    const sb = getSupabase();
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      // No asynchronous Supabase calls inside auth callbacks (deadlock risk).
      receivedEvent = true; setSession(next); setLoading(false); setError(null);
    });
    withDeadline(sb.auth.getSession(), 12_000).then(({ data, error: authError }) => {
      if (!mounted || receivedEvent) return;
      if (authError) throw authError;
      setSession(data.session ?? null); setLoading(false);
    }).catch((err: unknown) => {
      if (!mounted || receivedEvent) return;
      setError(err instanceof Error ? err.message : 'Sesi belum bisa diperiksa.'); setLoading(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [attempt]);
  useEffect(() => { cache.clear(); }, [cache, session?.user.id]);
  const retrySession = useCallback(() => setAttempt(v => v + 1), []);
  const signIn = useCallback(async (email: string, password: string) => {
    const { error: authError } = await withDeadline(getSupabase().auth.signInWithPassword({ email, password }));
    if (authError) throw authError;
  }, []);
  const signOut = useCallback(async () => {
    const { error: authError } = await withDeadline(getSupabase().auth.signOut({ scope: 'local' }));
    if (authError) throw authError;
    cache.clear(); setSession(null);
  }, [cache]);
  const value = useMemo<AuthState>(() => ({ session, user: session?.user ?? null, loading, error, retrySession, signIn, signOut }), [session, loading, error, retrySession, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
