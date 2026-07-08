import { getPageMeta, getSurahIndex, PAGE_COUNT } from "@/lib/mushaf/source";
import { KEYS, writeJSON } from "@/lib/storage";

export const MARKS_STORAGE_VERSION = 1;

export type MarkType =
  | "bookmark"
  | "note"
  | "reflection"
  | "review"
  | "memorization"
  | "important"
  | "return-later";

export interface QuranMark {
  id: string;
  type: MarkType;
  pageNumber: number;
  pageRange?: string;
  surahName?: string;
  surahNumber?: number;
  juzNumber?: number;
  ayahNumber?: number;
  verseKey?: string;
  title?: string;
  note?: string;
  tags?: string[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarksStorageV1 {
  version: 1;
  marks: QuranMark[];
}

interface LegacyBookmark {
  page: number;
  createdAt: string;
  note?: string;
}

export const MARK_TYPES: MarkType[] = [
  "bookmark",
  "note",
  "reflection",
  "review",
  "memorization",
  "important",
  "return-later",
];

export const MARK_TYPE_LABELS: Record<MarkType, string> = {
  bookmark: "علامة",
  note: "ملاحظة",
  reflection: "تدبر",
  review: "مراجعة",
  memorization: "حفظ",
  important: "مهم",
  "return-later": "رجوع لاحقا",
};

const MARK_TYPE_SET = new Set<string>(MARK_TYPES);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isPageNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= PAGE_COUNT;

const isOptionalString = (v: unknown): v is string | undefined =>
  v === undefined || typeof v === "string";

const isOptionalNumber = (v: unknown): v is number | undefined =>
  v === undefined || typeof v === "number";

const isOptionalStringList = (v: unknown): v is string[] | undefined =>
  v === undefined || (Array.isArray(v) && v.every((item) => typeof item === "string"));

export function isMarkType(v: unknown): v is MarkType {
  return typeof v === "string" && MARK_TYPE_SET.has(v);
}

export function isQuranMark(v: unknown): v is QuranMark {
  if (!isObject(v)) return false;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    isMarkType(v.type) &&
    isPageNumber(v.pageNumber) &&
    isOptionalString(v.pageRange) &&
    isOptionalString(v.surahName) &&
    isOptionalNumber(v.surahNumber) &&
    isOptionalNumber(v.juzNumber) &&
    isOptionalNumber(v.ayahNumber) &&
    isOptionalString(v.verseKey) &&
    isOptionalString(v.title) &&
    isOptionalString(v.note) &&
    isOptionalStringList(v.tags) &&
    isOptionalString(v.color) &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string"
  );
}

export function isMarksStorageV1(v: unknown): v is MarksStorageV1 {
  return (
    isObject(v) &&
    v.version === MARKS_STORAGE_VERSION &&
    Array.isArray(v.marks) &&
    v.marks.every(isQuranMark)
  );
}

function isLegacyBookmarkList(v: unknown): v is LegacyBookmark[] {
  return (
    Array.isArray(v) &&
    v.every(
      (b) =>
        isObject(b) &&
        isPageNumber(b.page) &&
        typeof b.createdAt === "string" &&
        isOptionalString(b.note)
    )
  );
}

export function sortMarks(marks: QuranMark[]): QuranMark[] {
  return [...marks].sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      a.id.localeCompare(b.id)
  );
}

export function createMarkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mark-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function pageMetadataFields(pageNumber: number): Pick<
  QuranMark,
  "pageNumber" | "surahName" | "surahNumber" | "juzNumber"
> {
  const meta = getPageMeta(pageNumber);
  const surahName = meta.surahs[0];
  const surahNumber = getSurahIndex().find((s) => s.name_ar === surahName)?.id;
  return {
    pageNumber: meta.pageNumber,
    surahName,
    surahNumber,
    juzNumber: meta.juz,
  };
}

export function createPageMark(
  pageNumber: number,
  type: MarkType,
  values: Partial<QuranMark> = {}
): QuranMark {
  const now = new Date().toISOString();
  return {
    id: createMarkId(),
    type,
    ...pageMetadataFields(pageNumber),
    createdAt: now,
    updatedAt: now,
    ...values,
  };
}

function migrateLegacyBookmarks(bookmarks: LegacyBookmark[]): MarksStorageV1 {
  const seen = new Set<number>();
  const marks = bookmarks
    .filter((bookmark) => {
      if (seen.has(bookmark.page)) return false;
      seen.add(bookmark.page);
      return true;
    })
    .map((bookmark) => {
      const note = bookmark.note?.trim();
      const type: MarkType = note ? "note" : "bookmark";
      return createPageMark(bookmark.page, type, {
        id: `legacy-${type}-page-${bookmark.page}`,
        note: note || undefined,
        createdAt: bookmark.createdAt,
        updatedAt: bookmark.createdAt,
      });
    });
  return { version: MARKS_STORAGE_VERSION, marks: sortMarks(marks) };
}

function parseStoredJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  return JSON.parse(raw);
}

export function readMarksStorage(): MarksStorageV1 {
  if (typeof window === "undefined") return { version: MARKS_STORAGE_VERSION, marks: [] };
  try {
    const stored = parseStoredJson(KEYS.marks);
    if (stored !== null) {
      return isMarksStorageV1(stored)
        ? { version: MARKS_STORAGE_VERSION, marks: sortMarks(stored.marks) }
        : { version: MARKS_STORAGE_VERSION, marks: [] };
    }

    const legacy = parseStoredJson(KEYS.bookmarks);
    if (!isLegacyBookmarkList(legacy)) return { version: MARKS_STORAGE_VERSION, marks: [] };

    const migrated = migrateLegacyBookmarks(legacy);
    writeMarksStorage(migrated);
    return migrated;
  } catch {
    return { version: MARKS_STORAGE_VERSION, marks: [] };
  }
}

export function writeMarksStorage(storage: MarksStorageV1): void {
  writeJSON(KEYS.marks, {
    version: MARKS_STORAGE_VERSION,
    marks: sortMarks(storage.marks),
  });
}

export function parseImportedMarks(v: unknown): QuranMark[] | null {
  if (isMarksStorageV1(v)) return sortMarks(v.marks);
  if (Array.isArray(v) && v.every(isQuranMark)) return sortMarks(v);
  return null;
}
