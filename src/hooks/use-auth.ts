"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });
  // Stable reference — createClient() must not be called on every render
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({ user: session?.user ?? null, session, loading: false });
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const signInWithGoogle = useCallback(async (next = "/dashboard") => {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }, [supabase]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      return supabase.auth.signInWithPassword({ email, password });
    },
    [supabase]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string, next?: string, phone?: string) => {
      return supabase.auth.signUp({
        email,
        password,
        options: {
          // the number rides along in the sign-in's metadata and is saved to the profile on first use (see ensureUserProfile)
          data: { name, ...(phone ? { phone_number: phone } : {}) },
          // `next` carries where the person was heading (e.g. an invite link) through email confirmation
          emailRedirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        },
      });
    },
    [supabase]
  );

  const resetPassword = useCallback(
    async (email: string) => {
      return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update`,
      });
    },
    [supabase]
  );

  return {
    ...state,
    signOut,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  };
}
