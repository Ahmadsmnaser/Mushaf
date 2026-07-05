"use client";

import { useEffect, useState } from "react";
import { clampPage, PAGE_COUNT } from "@/lib/mushaf/source";
import { KEYS, readJSON, writeJSON } from "./storage";

const isPage = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= PAGE_COUNT;

/** Call from the reader on every settled page. */
export function saveLastRead(page: number): void {
  writeJSON(KEYS.lastPage, clampPage(page));
}

/** Last visited page, or null before hydration / on first visit. */
export function useLastRead(): number | null {
  const [lastRead, setLastRead] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readJSON<number | 0>(
        KEYS.lastPage,
        0,
        (v): v is number | 0 => v === 0 || isPage(v)
      );
      if (stored !== 0) setLastRead(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return lastRead;
}
