"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuthUser } from "@/lib/auth/useAuthUser";
import { useReaderSettings, type ReaderSettings } from "@/lib/readerSettings";
import { userApi } from "@/lib/user/client";

export function useSyncedReaderSettings(): [
  ReaderSettings,
  (patch: Partial<ReaderSettings>) => void,
] {
  const auth = useAuthUser();
  const [settings, setLocalSettings] = useReaderSettings();
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user || loadedForUser.current === auth.user.id) return;
    loadedForUser.current = auth.user.id;
    let alive = true;
    void userApi
      .getPreferences()
      .then(({ preferences }) => {
        if (!alive) return;
        setLocalSettings({
          ...(preferences.readerTheme ? { readerTheme: preferences.readerTheme } : {}),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [auth.isAuthenticated, auth.user, setLocalSettings]);

  const setSyncedSettings = useCallback(
    (patch: Partial<ReaderSettings>) => {
      setLocalSettings(patch);
      if (!auth.isAuthenticated) return;
      void userApi
        .updatePreferences({
          ...(patch.readerTheme ? { readerTheme: patch.readerTheme } : {}),
        })
        .catch(() => {});
    },
    [auth.isAuthenticated, setLocalSettings]
  );

  return [settings, setSyncedSettings];
}
