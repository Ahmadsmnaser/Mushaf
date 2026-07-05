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

export interface MushafStyleConfig {
  id: string;
  label: string;
  swatch: string;
}

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

export const MUSHAF_STYLES = {
  classic: { id: "classic", label: "كلاسيكي", swatch: "#fffdf6" },
  premiumPaper: { id: "premiumPaper", label: "ورق فاخر", swatch: "#f5ecd6" },
} as const satisfies Record<string, MushafStyleConfig>;

export type MushafSourceId = keyof typeof MUSHAF_SOURCES;
export type ReaderTheme = keyof typeof READER_THEMES;
export type MushafStyle = keyof typeof MUSHAF_STYLES;

export interface ReaderSettings {
  readerTheme: ReaderTheme;
  mushafStyle: MushafStyle;
}

export const CURRENT_MUSHAF_SOURCE_ID: MushafSourceId = "madani";
export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  readerTheme: "beige",
  mushafStyle: "classic",
};

export const READER_THEME_OPTIONS = Object.values(READER_THEMES);
export const MUSHAF_STYLE_OPTIONS = Object.values(MUSHAF_STYLES);

export const isReaderTheme = (v: unknown): v is ReaderTheme =>
  typeof v === "string" && v in READER_THEMES;

export const isMushafStyle = (v: unknown): v is MushafStyle =>
  typeof v === "string" && v in MUSHAF_STYLES;

export function formatMushafPageUrl(
  source: MushafSourceConfig,
  pageNumber: number
): string {
  return source.imageUrlPattern.replace("{page}", String(pageNumber).padStart(3, "0"));
}
