"use client";

import { useCallback, useEffect, useState } from "react";
import { KEYS, readJSON, writeJSON } from "./storage";

export const READER_THEMES = [
  { id: "beige", label: "بيج", swatch: "#efe6d4" },
  { id: "white", label: "أبيض", swatch: "#f6f5f1" },
  { id: "green", label: "أخضر", swatch: "#0f3a27" },
  { id: "navy", label: "كحلي", swatch: "#16243c" },
  { id: "night", label: "ليلي", swatch: "#1a1918" },
] as const;

export type ReaderTheme = (typeof READER_THEMES)[number]["id"];

const isTheme = (v: unknown): v is ReaderTheme =>
  typeof v === "string" && READER_THEMES.some((t) => t.id === v);

/** Reader color theme, persisted locally. SSR renders the default (beige). */
export function useReaderTheme(): [ReaderTheme, (t: ReaderTheme) => void] {
  const [theme, setTheme] = useState<ReaderTheme>("beige");

  useEffect(() => {
    setTheme(readJSON<ReaderTheme>(KEYS.theme, "beige", isTheme));
  }, []);

  const set = useCallback((t: ReaderTheme) => {
    setTheme(t);
    writeJSON(KEYS.theme, t);
  }, []);

  return [theme, set];
}
