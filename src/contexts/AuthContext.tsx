/**
 * Auth context — exposes the current Supabase user, the linked profile,
 * and helpers for sign in / sign up / sign out. The provider is mounted
 * in src/app/_layout.tsx and consumed via the useAuth() hook.
 */
import { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True after the initial auth/profile bootstrap is complete. */
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[auth] fetchProfile error", error.message);
      return null;
    }
    return data ?? null;
  }, []);

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setProfile(null);
      return null;
    }
    const p = await fetchProfile(currentUser.id);
    setProfile(p);
    return p;
  }, [fetchProfile]);

  // Initial bootstrap: read stored session and subscribe to auth changes.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session: initial } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(initial);
      if (initial?.user) {
        const p = await fetchProfile(initial.user.id);
        if (mounted) setProfile(p);
      }
      if (mounted) setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        const p = await fetchProfile(newSession.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName ?? email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Insert a profile row so the dashboard can read preferences/connections.
        if (data.user) {
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              email,
              display_name: displayName ?? email.split("@")[0],
              automation_paused: false,
              personalization_score: 0,
            },
            { onConflict: "id", ignoreDuplicates: true },
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "myfeed://auth/callback",
        },
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Prevent auto-refresh from re-reading the stale session from storage.
    supabase.auth.stopAutoRefresh();

    // Clear local state immediately so layouts redirect right away.
    setSession(null);
    setProfile(null);

    // Wipe all Supabase auth keys from AsyncStorage BEFORE calling
    // signOut().  signOut() internally calls __loadSession() which
    // reads from storage — if the token is expired it will *refresh*
    // the token, emit SIGNED_IN, and restore the session via the
    // onAuthStateChange listener, defeating sign-out.
    try {
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter(
        (k) =>
          k.startsWith("supabase.auth.token") || k.startsWith("sb-"),
      );
      if (supabaseKeys.length > 0) {
        await AsyncStorage.removeMany(supabaseKeys);
      }
    } catch {
      // Storage may not be available; proceed anyway.
    }

    // Best-effort server-side sign-out.  With storage already empty
    // the internal __loadSession → _callRefreshToken path is a no-op.
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      ready,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, ready, signIn, signUp, signInWithGoogle, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
