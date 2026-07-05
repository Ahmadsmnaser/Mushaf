"use client";

import { useCallback } from "react";
import {
  READER_THEME_OPTIONS,
  READER_THEMES,
  type ReaderTheme,
  useReaderSettings,
} from "./readerSettings";

export { READER_THEME_OPTIONS, READER_THEMES, type ReaderTheme };

/** Reader color theme, persisted locally. SSR renders the default (beige). */
export function useReaderTheme(): [ReaderTheme, (t: ReaderTheme) => void] {
  const [settings, setSettings] = useReaderSettings();
  const set = useCallback(
    (readerTheme: ReaderTheme) => setSettings({ readerTheme }),
    [setSettings]
  );

  return [settings.readerTheme, set];
}
