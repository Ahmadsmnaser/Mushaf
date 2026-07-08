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
  writeMarksStorage,
  type MarkType,
  type MarksStorageV1,
} from "@/lib/marks";

export type { MarkType, QuranMark, MarksStorageV1 };

type ImportResult =
  | { ok: true; added: number; updated: number }
  | { ok: false; message: string };

function nextStorage(marks: QuranMark[]): MarksStorageV1 {
  return { version: MARKS_STORAGE_VERSION, marks: sortMarks(marks) };
}

function sameMark(a: QuranMark, b: QuranMark): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useMarks() {
  const [marks, setMarks] = useState<QuranMark[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMarks(readMarksStorage().marks);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const update = useCallback((next: QuranMark[]) => {
    const storage = nextStorage(next);
    setMarks(storage.marks);
    writeMarksStorage(storage);
  }, []);

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

  const togglePageBookmark = useCallback(
    (pageNumber: number) => {
      const existing = marks.find(
        (m) => m.type === "bookmark" && m.pageNumber === pageNumber && !m.verseKey
      );
      update(
        existing
          ? marks.filter((m) => m.id !== existing.id)
          : [...marks, createPageMark(pageNumber, "bookmark")]
      );
    },
    [marks, update]
  );

  const addMark = useCallback(
    (pageNumber: number, type: MarkType, values: Partial<QuranMark> = {}) => {
      if (!isMarkType(type)) return null;
      const mark = createPageMark(pageNumber, type, values);
      update([...marks, mark]);
      return mark;
    },
    [marks, update]
  );

  const updateMark = useCallback(
    (id: string, values: Partial<QuranMark>) => {
      const now = new Date().toISOString();
      update(
        marks.map((mark) =>
          mark.id === id
            ? {
                ...mark,
                ...values,
                ...(values.pageNumber ? pageMetadataFields(values.pageNumber) : {}),
                updatedAt: now,
              }
            : mark
        )
      );
    },
    [marks, update]
  );

  const removeMark = useCallback(
    (id: string) => update(marks.filter((mark) => mark.id !== id)),
    [marks, update]
  );

  const removePageBookmark = useCallback(
    (pageNumber: number) =>
      update(
        marks.filter(
          (mark) => !(mark.type === "bookmark" && mark.pageNumber === pageNumber && !mark.verseKey)
        )
      ),
    [marks, update]
  );

  const upsertNote = useCallback(
    (pageNumber: number, note: string) => {
      const trimmed = note.trim();
      const existing = marks.find(
        (m) => m.type === "note" && m.pageNumber === pageNumber && !m.verseKey
      );
      if (!trimmed && existing) {
        removeMark(existing.id);
        return;
      }
      if (!trimmed) return;
      if (existing) {
        updateMark(existing.id, { note: trimmed });
        return;
      }
      addMark(pageNumber, "note", { note: trimmed });
    },
    [addMark, marks, removeMark, updateMark]
  );

  const exportStorage = useCallback(
    () => nextStorage(marks),
    [marks]
  );

  const importStorage = useCallback(
    (input: unknown): ImportResult => {
      const imported = parseImportedMarks(input);
      if (!imported) {
        return { ok: false, message: "ملف العلامات غير صالح." };
      }

      let added = 0;
      let updated = 0;
      const byId = new Map(marks.map((mark) => [mark.id, mark]));
      for (const mark of imported) {
        const existing = byId.get(mark.id);
        if (!existing) {
          byId.set(mark.id, mark);
          added++;
        } else if (!sameMark(existing, mark)) {
          byId.set(mark.id, mark);
          updated++;
        }
      }
      update(Array.from(byId.values()));
      return { ok: true, added, updated };
    },
    [marks, update]
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
  };
}
