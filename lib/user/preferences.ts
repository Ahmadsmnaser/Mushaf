import { isMushafStyle, isReaderTheme, type MushafStyle, type ReaderTheme } from "@/lib/readerConfig";
import { PAGE_COUNT } from "@/lib/mushaf/source";

export interface UserPreferences {
  readerTheme?: ReaderTheme;
  mushafStyle?: MushafStyle;
  reciterId?: string;
  lastReadPage?: number;
  readingMode?: string;
}

type PreferencesRow = {
  reader_theme: ReaderTheme | null;
  mushaf_style: MushafStyle | null;
  reciter_id: string | null;
  last_read_page: number | null;
  reading_mode: string | null;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

function optionalShortString(v: unknown, max = 80): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error("invalid_string");
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new Error("too_long");
  return trimmed;
}

export function rowToPreferences(row: PreferencesRow | null): UserPreferences {
  if (!row) return {};
  return {
    readerTheme: row.reader_theme ?? undefined,
    mushafStyle: row.mushaf_style ?? undefined,
    reciterId: row.reciter_id ?? undefined,
    lastReadPage: row.last_read_page ?? undefined,
    readingMode: row.reading_mode ?? undefined,
  };
}

export function validatePreferencePatch(input: unknown): UserPreferences {
  if (!isObject(input)) throw new Error("invalid_body");
  const patch: UserPreferences = {};

  if (input.readerTheme !== undefined) {
    if (!isReaderTheme(input.readerTheme)) throw new Error("invalid_theme");
    patch.readerTheme = input.readerTheme;
  }
  if (input.mushafStyle !== undefined) {
    if (!isMushafStyle(input.mushafStyle)) throw new Error("invalid_style");
    patch.mushafStyle = input.mushafStyle;
  }
  if (input.reciterId !== undefined) patch.reciterId = optionalShortString(input.reciterId);
  if (input.readingMode !== undefined) patch.readingMode = optionalShortString(input.readingMode);
  if (input.lastReadPage !== undefined) {
    if (
      typeof input.lastReadPage !== "number" ||
      !Number.isInteger(input.lastReadPage) ||
      input.lastReadPage < 1 ||
      input.lastReadPage > PAGE_COUNT
    ) {
      throw new Error("invalid_page");
    }
    patch.lastReadPage = input.lastReadPage;
  }

  return patch;
}

export function preferencesToRow(patch: UserPreferences) {
  return {
    ...(patch.readerTheme !== undefined ? { reader_theme: patch.readerTheme } : {}),
    ...(patch.mushafStyle !== undefined ? { mushaf_style: patch.mushafStyle } : {}),
    ...(patch.reciterId !== undefined ? { reciter_id: patch.reciterId ?? null } : {}),
    ...(patch.lastReadPage !== undefined ? { last_read_page: patch.lastReadPage } : {}),
    ...(patch.readingMode !== undefined ? { reading_mode: patch.readingMode ?? null } : {}),
    updated_at: new Date().toISOString(),
  };
}
