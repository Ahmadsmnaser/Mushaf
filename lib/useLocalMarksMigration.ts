"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth/useAuthUser";
import { readMarksStorage } from "@/lib/marks";
import { KEYS, writeJSON } from "@/lib/storage";
import { userApi } from "@/lib/user/client";

const completedKey = (userId: string) => `${KEYS.marksMigrationDone}.${userId}`;

export function useLocalMarksMigration() {
  const auth = useAuthUser();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) return;
    const timer = window.setTimeout(() => {
      if (window.localStorage.getItem(completedKey(auth.user!.id)) === "true") return;
      const localMarks = readMarksStorage().marks;
      if (localMarks.length > 0) setOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [auth.isAuthenticated, auth.user]);

  const importLocalMarks = useCallback(async () => {
    if (!auth.user) return;
    const localMarks = readMarksStorage().marks;
    setPending(true);
    setStatus(null);
    try {
      const result = await userApi.migrateMarks(localMarks);
      writeJSON(completedKey(auth.user.id), true);
      setStatus(
        `تم استيراد ${result.added.toLocaleString("ar-EG")} علامة، وتجاهل ${result.skipped.toLocaleString("ar-EG")} مكررة.`
      );
      setOpen(false);
      window.dispatchEvent(new Event("mushaf:marks-migrated"));
    } catch {
      setStatus("تعذر الاستيراد الآن. بقيت علاماتك المحلية محفوظة.");
    } finally {
      setPending(false);
    }
  }, [auth.user]);

  return {
    open,
    pending,
    status,
    importLocalMarks,
    dismiss: () => setOpen(false),
  };
}
