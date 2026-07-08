// SSR-safe, versioned localStorage helpers. Corrupt or missing values fall
// back to defaults — persistence must never crash the reader.

export function readJSON<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked — reading must go on
  }
}

export const KEYS = {
  lastPage: "mushaf.v1.lastPage",
  bookmarks: "mushaf.v1.bookmarks",
  marks: "mushaf.v1.marks",
  theme: "mushaf.v1.theme",
  readerTheme: "mushaf.v2.readerTheme",
  mushafStyle: "mushaf.v2.mushafStyle",
} as const;
