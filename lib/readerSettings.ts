"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_READER_SETTINGS,
  type MushafStyle,
  type ReaderSettings,
  type ReaderTheme,
  isMushafStyle,
  isReaderTheme,
} from "./readerConfig";
import { KEYS, readJSON, writeJSON } from "./storage";

export {
  CURRENT_MUSHAF_SOURCE_ID,
  DEFAULT_READER_SETTINGS,
  MUSHAF_SOURCES,
  MUSHAF_STYLES,
  MUSHAF_STYLE_OPTIONS,
  READER_THEMES,
  READER_THEME_OPTIONS,
  formatMushafPageUrl,
  type MushafSourceId,
  type MushafStyle,
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

function readMushafStyle(): MushafStyle {
  return readJSON<MushafStyle>(
    KEYS.mushafStyle,
    DEFAULT_READER_SETTINGS.mushafStyle,
    isMushafStyle
  );
}

/** Reader environment and Mushaf presentation settings, persisted locally. */
export function useReaderSettings(): [
  ReaderSettings,
  (patch: Partial<ReaderSettings>) => void,
] {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = {
        readerTheme: readReaderTheme(),
        mushafStyle: readMushafStyle(),
      };
      setSettings(next);
      writeJSON(KEYS.readerTheme, next.readerTheme);
      writeJSON(KEYS.mushafStyle, next.mushafStyle);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const set = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      writeJSON(KEYS.readerTheme, next.readerTheme);
      writeJSON(KEYS.mushafStyle, next.mushafStyle);
      return next;
    });
  }, []);

  return [settings, set];
}
