"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_READER_SETTINGS,
  type ReaderSettings,
  type ReaderTheme,
  isReaderTheme,
} from "./readerConfig";
import { KEYS, readJSON, writeJSON } from "./storage";

export {
  CURRENT_MUSHAF_SOURCE_ID,
  DEFAULT_READER_SETTINGS,
  MUSHAF_SOURCES,
  READER_THEMES,
  READER_THEME_OPTIONS,
  THEME_MUSHAF_TREATMENTS,
  getMushafTreatment,
  formatMushafPageUrl,
  type MushafSourceId,
  type MushafTreatment,
  type ReaderSettings,
  type ReaderTheme,
} from "./readerConfig";

const isString = (v: unknown): v is string => typeof v === "string";

function normalizeReaderTheme(v: string): ReaderTheme | null {
  if (v === "night") return "black";
  return isReaderTheme(v) ? v : null;
}

function readReaderTheme(): ReaderTheme {
  const stored = readJSON<string>(KEYS.readerTheme, "", isString);
  const legacy = stored || readJSON<string>(KEYS.theme, "", isString);
  return normalizeReaderTheme(legacy) ?? DEFAULT_READER_SETTINGS.readerTheme;
}

/**
 * Migrate away from the removed independent Mushaf-style feature. Those keys
 * described a user choice that no longer exists (the Mushaf treatment is now
 * derived from the theme), so drop them. Purely a cleanup — reading never
 * depended on them, so their presence was already harmless.
 */
function migrateLegacyAppearance(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEYS.mushafStyle);
    window.localStorage.removeItem(KEYS.syncMushafWithTheme);
  } catch {
    // storage blocked — nothing to clean up, and reading is unaffected.
  }
}

/** Reader environment settings, persisted locally. The theme is the only value
 *  the user controls; everything about the Mushaf's look derives from it. */
export function useReaderSettings(): [
  ReaderSettings,
  (patch: Partial<ReaderSettings>) => void,
] {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      migrateLegacyAppearance();
      const next: ReaderSettings = { readerTheme: readReaderTheme() };
      setSettings(next);
      writeJSON(KEYS.readerTheme, next.readerTheme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const set = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      writeJSON(KEYS.readerTheme, next.readerTheme);
      return next;
    });
  }, []);

  return [settings, set];
}
