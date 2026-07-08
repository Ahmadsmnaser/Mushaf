import { MARK_TYPES, isMarkType, pageMetadataFields, sortMarks, type MarkType, type QuranMark } from "@/lib/marks";
import { PAGE_COUNT } from "@/lib/mushaf/source";

const NOTE_MAX = 5000;
const TITLE_MAX = 160;
const TAG_MAX = 40;
const TAG_COUNT_MAX = 12;
const COLOR_MAX = 32;
const VERSE_KEY_RE = /^\d{1,3}:\d{1,3}$/;

type MarkRow = {
  id: string;
  user_id: string;
  type: MarkType;
  page_number: number;
  page_range: string | null;
  surah_name: string | null;
  surah_number: number | null;
  juz_number: number | null;
  ayah_number: number | null;
  verse_key: string | null;
  title: string | null;
  note: string | null;
  tags: string[] | null;
  color: string | null;
  created_at: string;
  updated_at: string;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const optionalString = (v: unknown, max: number): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error("invalid_string");
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new Error("too_long");
  return trimmed;
};

const optionalNumber = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("invalid_number");
  return v;
};

const optionalDate = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new Error("invalid_date");
  return new Date(v).toISOString();
};

const optionalTags = (v: unknown): string[] | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new Error("invalid_tags");
  const tags = v
    .map((item) => {
      if (typeof item !== "string") throw new Error("invalid_tags");
      return item.trim();
    })
    .filter(Boolean);
  if (tags.length > TAG_COUNT_MAX || tags.some((tag) => tag.length > TAG_MAX)) {
    throw new Error("invalid_tags");
  }
  return Array.from(new Set(tags));
};

function requiredPageNumber(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > PAGE_COUNT) {
    throw new Error("invalid_page");
  }
  return v;
}

function rowToMark(row: MarkRow): QuranMark {
  return {
    id: row.id,
    type: row.type,
    pageNumber: row.page_number,
    pageRange: row.page_range ?? undefined,
    surahName: row.surah_name ?? undefined,
    surahNumber: row.surah_number ?? undefined,
    juzNumber: row.juz_number ?? undefined,
    ayahNumber: row.ayah_number ?? undefined,
    verseKey: row.verse_key ?? undefined,
    title: row.title ?? undefined,
    note: row.note ?? undefined,
    tags: row.tags ?? undefined,
    color: row.color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowsToMarks(rows: MarkRow[] | null): QuranMark[] {
  return sortMarks((rows ?? []).map(rowToMark));
}

export function markToRow(mark: QuranMark, userId: string) {
  return {
    id: mark.id,
    user_id: userId,
    type: mark.type,
    page_number: mark.pageNumber,
    page_range: mark.pageRange ?? null,
    surah_name: mark.surahName ?? null,
    surah_number: mark.surahNumber ?? null,
    juz_number: mark.juzNumber ?? null,
    ayah_number: mark.ayahNumber ?? null,
    verse_key: mark.verseKey ?? null,
    title: mark.title ?? null,
    note: mark.note ?? null,
    tags: mark.tags ?? null,
    color: mark.color ?? null,
    created_at: mark.createdAt,
    updated_at: mark.updatedAt,
  };
}

export function validateCreateMark(input: unknown): QuranMark {
  if (!isObject(input)) throw new Error("invalid_body");
  if (typeof input.id !== "string" || input.id.length < 3 || input.id.length > 120) {
    throw new Error("invalid_id");
  }
  if (!isMarkType(input.type)) throw new Error("invalid_type");

  const pageNumber = requiredPageNumber(input.pageNumber);
  const verseKey = optionalString(input.verseKey, 24);
  if (verseKey && !VERSE_KEY_RE.test(verseKey)) throw new Error("invalid_verse_key");

  const now = new Date().toISOString();
  return {
    id: input.id,
    type: input.type,
    ...pageMetadataFields(pageNumber),
    pageRange: optionalString(input.pageRange, 40),
    ayahNumber: optionalNumber(input.ayahNumber),
    verseKey,
    title: optionalString(input.title, TITLE_MAX),
    note: optionalString(input.note, NOTE_MAX),
    tags: optionalTags(input.tags),
    color: optionalString(input.color, COLOR_MAX),
    createdAt: optionalDate(input.createdAt) ?? now,
    updatedAt: optionalDate(input.updatedAt) ?? now,
  };
}

type MarkPatch = Partial<Omit<QuranMark, "pageRange" | "verseKey" | "title" | "note" | "color">> & {
  pageRange?: string | null;
  verseKey?: string | null;
  title?: string | null;
  note?: string | null;
  color?: string | null;
};

function nullableString(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") throw new Error("invalid_string");
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error("too_long");
  return trimmed;
}

export function validatePatchMark(input: unknown): MarkPatch {
  if (!isObject(input)) throw new Error("invalid_body");
  const patch: MarkPatch = {};

  if (input.type !== undefined) {
    if (!isMarkType(input.type)) throw new Error("invalid_type");
    patch.type = input.type;
  }
  if (input.pageNumber !== undefined) {
    patch.pageNumber = requiredPageNumber(input.pageNumber);
    Object.assign(patch, pageMetadataFields(patch.pageNumber));
  }
  if (input.pageRange !== undefined) patch.pageRange = nullableString(input.pageRange, 40);
  if (input.ayahNumber !== undefined) patch.ayahNumber = optionalNumber(input.ayahNumber);
  if (input.verseKey !== undefined) {
    const verseKey = nullableString(input.verseKey, 24);
    if (verseKey && !VERSE_KEY_RE.test(verseKey)) throw new Error("invalid_verse_key");
    patch.verseKey = verseKey;
  }
  if (input.title !== undefined) patch.title = nullableString(input.title, TITLE_MAX);
  if (input.note !== undefined) patch.note = nullableString(input.note, NOTE_MAX);
  if (input.tags !== undefined) patch.tags = optionalTags(input.tags);
  if (input.color !== undefined) patch.color = nullableString(input.color, COLOR_MAX);
  patch.updatedAt = new Date().toISOString();
  return patch;
}

export function patchToRow(patch: MarkPatch) {
  return {
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.pageNumber !== undefined ? { page_number: patch.pageNumber } : {}),
    ...(patch.pageRange !== undefined ? { page_range: patch.pageRange ?? null } : {}),
    ...(patch.surahName !== undefined ? { surah_name: patch.surahName ?? null } : {}),
    ...(patch.surahNumber !== undefined ? { surah_number: patch.surahNumber ?? null } : {}),
    ...(patch.juzNumber !== undefined ? { juz_number: patch.juzNumber ?? null } : {}),
    ...(patch.ayahNumber !== undefined ? { ayah_number: patch.ayahNumber ?? null } : {}),
    ...(patch.verseKey !== undefined ? { verse_key: patch.verseKey ?? null } : {}),
    ...(patch.title !== undefined ? { title: patch.title ?? null } : {}),
    ...(patch.note !== undefined ? { note: patch.note ?? null } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags ?? null } : {}),
    ...(patch.color !== undefined ? { color: patch.color ?? null } : {}),
    updated_at: patch.updatedAt,
  };
}

export function semanticMarkKey(mark: Pick<QuranMark, "type" | "pageNumber" | "verseKey" | "title" | "note">) {
  const verse = mark.verseKey ?? "";
  if (mark.type === "bookmark") return `${mark.type}:${mark.pageNumber}:${verse}`;
  return [
    mark.type,
    mark.pageNumber,
    verse,
    (mark.title ?? "").trim().toLowerCase(),
    (mark.note ?? "").trim().toLowerCase(),
  ].join(":");
}

export { MARK_TYPES };
