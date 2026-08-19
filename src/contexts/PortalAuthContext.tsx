import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface PortalProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  client_id: string | null;
}

interface PortalAuthState {
  session: Session | null;
  user: User | null;
  profile: PortalProfile | null;
  clientId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthState | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, client_id')
      .eq('id', userId)
      .maybeSingle();
    if (data) setProfile(data as PortalProfile);
    return data as PortalProfile | null;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchProfile(s.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => { await fetchProfile(s.user.id); })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Neplatné přihlašovací údaje' };

    setSession(data.session);
    setUser(data.user);
    const prof = await fetchProfile(data.user.id);

    if (!prof?.client_id) {
      await supabase.auth.signOut();
      setProfile(null);
      setUser(null);
      setSession(null);
      return { error: 'Tento účet nemá přístup do klientského portálu' };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <PortalAuthContext.Provider
      value={{
        session,
        user,
        profile,
        clientId: profile?.client_id ?? null,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
}
