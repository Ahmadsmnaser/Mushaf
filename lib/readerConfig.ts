export type MushafLayoutType = "madani" | "indopak" | "tajweed";

export interface MushafSourceConfig {
  id: string;
  label: string;
  pageCount: number;
  imageUrlPattern: string;
  layoutType: MushafLayoutType;
}

export interface ReaderThemeConfig {
  id: string;
  label: string;
  swatch: string;
}

/**
 * Image-dataset registry. The app currently ships one verified dataset (the
 * transparent Madani set). This stays the seam for adding a genuinely
 * different dataset later — a real Mushaf *style* is exposed to users only
 * when it produces a clearly distinguishable, validated visual result, which
 * a second entry here would provide.
 */
export const MUSHAF_SOURCES = {
  madani: {
    id: "madani",
    label: "مصحف المدينة",
    pageCount: 604,
    imageUrlPattern: "/pages/{page}.png",
    layoutType: "madani",
  },
} as const satisfies Record<string, MushafSourceConfig>;

export const READER_THEMES = {
  green: { id: "green", label: "أخضر", swatch: "#0f3a27" },
  navy: { id: "navy", label: "كحلي", swatch: "#16243c" },
  beige: { id: "beige", label: "بيج", swatch: "#efe6d4" },
  white: { id: "white", label: "أبيض", swatch: "#f6f5f1" },
  black: { id: "black", label: "ليلي", swatch: "#1a1918" },
} as const satisfies Record<string, ReaderThemeConfig>;

export type MushafSourceId = keyof typeof MUSHAF_SOURCES;
export type ReaderTheme = keyof typeof READER_THEMES;

/**
 * The restrained page treatment the app theme applies to the Mushaf. This is
 * NOT a user choice — the page images are one canonical dataset, so there is
 * no honest independent "Mushaf color" to pick. The theme is the single source
 * of truth; each treatment is a small set of safe CSS tokens (paper tone,
 * frame tint, edge/shadow warmth) applied to the whole page environment, never
 * a flat overlay on the Quran text.
 */
export type MushafTreatment = "neutral" | "warm" | "sage" | "cool" | "dim";

/** Central theme → treatment mapping. Never hardcode this in components. */
export const THEME_MUSHAF_TREATMENTS: Record<ReaderTheme, MushafTreatment> = {
  green: "sage",
  navy: "cool",
  beige: "warm",
  white: "neutral",
  black: "dim",
};

export function getMushafTreatment(theme: ReaderTheme): MushafTreatment {
  return THEME_MUSHAF_TREATMENTS[theme];
}

/** The only appearance value the user genuinely controls. */
export interface ReaderSettings {
  readerTheme: ReaderTheme;
}

export const CURRENT_MUSHAF_SOURCE_ID: MushafSourceId = "madani";
export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  readerTheme: "green",
};

export const READER_THEME_OPTIONS = Object.values(READER_THEMES);

export const isReaderTheme = (v: unknown): v is ReaderTheme =>
  typeof v === "string" && v in READER_THEMES;

export function formatMushafPageUrl(
  source: MushafSourceConfig,
  pageNumber: number
): string {
  return source.imageUrlPattern.replace("{page}", String(pageNumber).padStart(3, "0"));
}
