"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name:
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : typeof user.user_metadata?.picture === "string"
          ? user.user_metadata.picture
          : null,
  };
}

export function useAuthUser() {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured() ? "loading" : "unauthenticated"
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClientSupabaseClient();
    if (!supabase) {
      return;
    }

    let alive = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!alive) return;
      if (authError) setError("تعذر التحقق من تسجيل الدخول.");
      const nextUser = toAuthUser(data.user);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = toAuthUser(session?.user ?? null);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = createClientSupabaseClient();
    if (!supabase) {
      setError("إعدادات تسجيل الدخول غير مكتملة.");
      return;
    }
    setError(null);
    const next = `${window.location.pathname}${window.location.search}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) setError("تعذر بدء تسجيل الدخول بواسطة Google.");
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClientSupabaseClient();
    if (!supabase) return;
    setError(null);
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError("تعذر تسجيل الخروج.");
  }, []);

  return useMemo(
    () => ({
      status,
      user,
      error,
      isConfigured: isSupabaseConfigured(),
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated",
      signInWithGoogle,
      signOut,
    }),
    [error, signInWithGoogle, signOut, status, user]
  );
}
