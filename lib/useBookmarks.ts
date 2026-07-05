"use client";

import { useCallback, useEffect, useState } from "react";
import { PAGE_COUNT } from "@/lib/mushaf/source";
import { KEYS, readJSON, writeJSON } from "./storage";

export interface Bookmark {
  page: number;
  createdAt: string; // ISO
  note?: string;
}

function isBookmarkList(v: unknown): v is Bookmark[] {
  return (
    Array.isArray(v) &&
    v.every(
      (b) =>
        typeof b === "object" &&
        b !== null &&
        typeof (b as Bookmark).page === "number" &&
        (b as Bookmark).page >= 1 &&
        (b as Bookmark).page <= PAGE_COUNT &&
        typeof (b as Bookmark).createdAt === "string"
    )
  );
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Load after mount (SSR-safe); state starts empty and hydrates.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBookmarks(readJSON<Bookmark[]>(KEYS.bookmarks, [], isBookmarkList));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const update = useCallback((next: Bookmark[]) => {
    setBookmarks(next);
    writeJSON(KEYS.bookmarks, next);
  }, []);

  const isBookmarked = useCallback(
    (page: number) => bookmarks.some((b) => b.page === page),
    [bookmarks]
  );

  const toggle = useCallback(
    (page: number) => {
      const existing = bookmarks.find((b) => b.page === page);
      update(
        existing
          ? bookmarks.filter((b) => b.page !== page)
          : [...bookmarks, { page, createdAt: new Date().toISOString() }].sort(
              (a, b) => a.page - b.page
            )
      );
    },
    [bookmarks, update]
  );

  const remove = useCallback(
    (page: number) => update(bookmarks.filter((b) => b.page !== page)),
    [bookmarks, update]
  );

  const setNote = useCallback(
    (page: number, note: string) =>
      update(
        bookmarks.map((b) =>
          b.page === page ? { ...b, note: note.trim() || undefined } : b
        )
      ),
    [bookmarks, update]
  );

  return { bookmarks, isBookmarked, toggle, remove, setNote };
}
