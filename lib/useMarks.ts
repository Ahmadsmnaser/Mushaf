"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPageMark,
  isMarkType,
  MARKS_STORAGE_VERSION,
  pageMetadataFields,
  parseImportedMarks,
  QuranMark,
  readMarksStorage,
  sortMarks,
  type MarkType,
  type MarksStorageV1,
} from "@/lib/marks";
import { useAuthUser } from "@/lib/auth/useAuthUser";
import { userApi } from "@/lib/user/client";

export type { MarkType, QuranMark, MarksStorageV1 };

type ImportResult =
  | { ok: true; added: number; updated: number; skipped?: number }
  | { ok: false; message: string };

function nextStorage(marks: QuranMark[]): MarksStorageV1 {
  return { version: MARKS_STORAGE_VERSION, marks: sortMarks(marks) };
}

function replaceMark(marks: QuranMark[], next: QuranMark): QuranMark[] {
  return sortMarks(marks.map((mark) => (mark.id === next.id ? next : mark)));
}

export function useMarks() {
  const auth = useAuthUser();
  const [marks, setMarks] = useState<QuranMark[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMarks(readMarksStorage().marks);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (auth.isLoading || auth.isAuthenticated) return;
    const timer = window.setTimeout(() => {
      setMarks(readMarksStorage().marks);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [auth.isAuthenticated, auth.isLoading]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setPending(true);
      userApi
        .getMarks()
        .then(({ marks: cloudMarks }) => {
          if (alive) setMarks(sortMarks(cloudMarks));
        })
        .catch(() => {
          if (alive) setError("تعذر تحميل علاماتك المحفوظة.");
        })
        .finally(() => {
          if (alive) setPending(false);
        });
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const onMigrated = () => {
      setPending(true);
      void userApi
        .getMarks()
        .then(({ marks: cloudMarks }) => setMarks(sortMarks(cloudMarks)))
        .finally(() => setPending(false));
    };
    window.addEventListener("mushaf:marks-migrated", onMigrated);
    return () => window.removeEventListener("mushaf:marks-migrated", onMigrated);
  }, [auth.isAuthenticated]);

  const requireLogin = useCallback(() => {
    if (auth.isAuthenticated) return false;
    setLoginPromptOpen(true);
    return true;
  }, [auth.isAuthenticated]);

  const bookmarkedPages = useMemo(
    () => new Set(marks.filter((m) => m.type === "bookmark").map((m) => m.pageNumber)),
    [marks]
  );

  const isPageBookmarked = useCallback(
    (pageNumber: number) => bookmarkedPages.has(pageNumber),
    [bookmarkedPages]
  );

  const marksForPage = useCallback(
    (pageNumber: number) => marks.filter((m) => m.pageNumber === pageNumber),
    [marks]
  );

  const createCloudMark = useCallback((mark: QuranMark) => {
    setMarks((current) => sortMarks([...current, mark]));
    setPending(true);
    void userApi
      .createMark(mark)
      .then(({ mark: saved }) => setMarks((current) => replaceMark(current, saved)))
      .catch(() => {
        setMarks((current) => current.filter((item) => item.id !== mark.id));
        setError("تعذر حفظ العلامة.");
      })
      .finally(() => setPending(false));
  }, []);

  const updateCloudMark = useCallback((id: string, values: Partial<QuranMark>) => {
    let previous: QuranMark[] = [];
    const now = new Date().toISOString();
    const patch = {
      ...values,
      ...(values.pageNumber ? pageMetadataFields(values.pageNumber) : {}),
      updatedAt: now,
    };
    setMarks((current) => {
      previous = current;
      return sortMarks(
        current.map((mark) => (mark.id === id ? { ...mark, ...patch } : mark))
      );
    });
    setPending(true);
    void userApi
      .updateMark(id, patch)
      .then(({ mark: saved }) => setMarks((current) => replaceMark(current, saved)))
      .catch(() => {
        setMarks(previous);
        setError("تعذر تحديث العلامة.");
      })
      .finally(() => setPending(false));
  }, []);

  const removeCloudMark = useCallback((id: string) => {
    let previous: QuranMark[] = [];
    setMarks((current) => {
      previous = current;
      return current.filter((mark) => mark.id !== id);
    });
    setPending(true);
    void userApi
      .deleteMark(id)
      .catch(() => {
        setMarks(previous);
        setError("تعذر حذف العلامة.");
      })
      .finally(() => setPending(false));
  }, []);

  const togglePageBookmark = useCallback(
    (pageNumber: number) => {
      if (requireLogin()) return;
      const existing = marks.find(
        (m) => m.type === "bookmark" && m.pageNumber === pageNumber && !m.verseKey
      );
      if (existing) {
        removeCloudMark(existing.id);
        return;
      }
      createCloudMark(createPageMark(pageNumber, "bookmark"));
    },
    [createCloudMark, marks, removeCloudMark, requireLogin]
  );

  const addMark = useCallback(
    (pageNumber: number, type: MarkType, values: Partial<QuranMark> = {}) => {
      if (!isMarkType(type)) return null;
      if (requireLogin()) return null;
      const mark = createPageMark(pageNumber, type, values);
      createCloudMark(mark);
      return mark;
    },
    [createCloudMark, requireLogin]
  );

  const updateMark = useCallback(
    (id: string, values: Partial<QuranMark>) => {
      if (requireLogin()) return;
      updateCloudMark(id, values);
    },
    [requireLogin, updateCloudMark]
  );

  const removeMark = useCallback(
    (id: string) => {
      if (requireLogin()) return;
      removeCloudMark(id);
    },
    [removeCloudMark, requireLogin]
  );

  const removePageBookmark = useCallback(
    (pageNumber: number) => {
      if (requireLogin()) return;
      const existing = marks.find(
        (mark) => mark.type === "bookmark" && mark.pageNumber === pageNumber && !mark.verseKey
      );
      if (existing) removeCloudMark(existing.id);
    },
    [marks, removeCloudMark, requireLogin]
  );

  const upsertNote = useCallback(
    (pageNumber: number, note: string) => {
      if (requireLogin()) return;
      const trimmed = note.trim();
      const existing = marks.find(
        (m) => m.type === "note" && m.pageNumber === pageNumber && !m.verseKey
      );
      if (!trimmed && existing) {
        removeCloudMark(existing.id);
        return;
      }
      if (!trimmed) return;
      if (existing) {
        updateCloudMark(existing.id, { note: trimmed });
        return;
      }
      createCloudMark(createPageMark(pageNumber, "note", { note: trimmed }));
    },
    [createCloudMark, marks, removeCloudMark, requireLogin, updateCloudMark]
  );

  const exportStorage = useCallback(() => nextStorage(marks), [marks]);

  const importStorage = useCallback(
    async (input: unknown): Promise<ImportResult> => {
      const imported = parseImportedMarks(input);
      if (!imported) {
        return { ok: false, message: "ملف العلامات غير صالح." };
      }
      if (requireLogin()) {
        return {
          ok: false,
          message: "سجّل الدخول لاستيراد العلامات إلى حسابك.",
        };
      }
      setPending(true);
      try {
        const result = await userApi.migrateMarks(imported);
        const { marks: cloudMarks } = await userApi.getMarks();
        setMarks(sortMarks(cloudMarks));
        return result;
      } catch {
        setError("تعذر استيراد العلامات.");
        return { ok: false, message: "تعذر استيراد العلامات الآن." };
      } finally {
        setPending(false);
      }
    },
    [requireLogin]
  );

  return {
    marks,
    addMark,
    updateMark,
    removeMark,
    removePageBookmark,
    marksForPage,
    isPageBookmarked,
    togglePageBookmark,
    upsertNote,
    exportStorage,
    importStorage,
    marksPending: pending,
    marksError: error,
    isAuthenticated: auth.isAuthenticated,
    authLoading: auth.isLoading,
    loginPromptOpen,
    openLoginPrompt: () => setLoginPromptOpen(true),
    closeLoginPrompt: () => setLoginPromptOpen(false),
  };
}
