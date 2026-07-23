import { describe, expect, it } from "vitest";
import {
  clampPage,
  getSpread,
  normalizeArabic,
  pageToSpreadStart,
  PAGE_COUNT,
} from "@/lib/mushaf/source";
import { isVerseKey, validatePageNumber } from "@/lib/mushaf/ayahRegions";
import { isMarksStorageV1, isQuranMark, type QuranMark } from "@/lib/marks";
import { validateCreateMark, validatePatchMark } from "@/lib/user/marks";
import { validatePreferencePatch } from "@/lib/user/preferences";

// ---------------------------------------------------------------------------
// Page-number conversion — the single source of truth for page/spread math.
// ---------------------------------------------------------------------------
describe("clampPage", () => {
  it("clamps to the valid 1..604 range", () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
    expect(clampPage(605)).toBe(PAGE_COUNT);
    expect(clampPage(99999)).toBe(PAGE_COUNT);
    expect(clampPage(42)).toBe(42);
  });

  it("truncates fractional pages and rejects non-finite input", () => {
    expect(clampPage(3.7)).toBe(3);
    // Non-finite input (NaN / ±Infinity) falls back to the safe first page.
    expect(clampPage(Number.NaN)).toBe(1);
    expect(clampPage(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("pageToSpreadStart", () => {
  it("pairs (odd, even) with the odd page on the right", () => {
    expect(pageToSpreadStart(1)).toBe(1);
    expect(pageToSpreadStart(2)).toBe(1);
    expect(pageToSpreadStart(3)).toBe(3);
    expect(pageToSpreadStart(42)).toBe(41);
    // 604 is even, so the last spread (603, 604) is complete.
    expect(pageToSpreadStart(603)).toBe(603);
    expect(pageToSpreadStart(604)).toBe(603);
  });

  it("getSpread returns the odd/even pair for the containing spread", () => {
    const spread = getSpread(42);
    expect(spread.rightPage.pageNumber).toBe(41);
    expect(spread.leftPage.pageNumber).toBe(42);
    // start + 1 never overflows even at the final page.
    expect(getSpread(604).leftPage.pageNumber).toBe(604);
  });
});

// ---------------------------------------------------------------------------
// Verse-key validation — one canonical `surah:ayah` format, guarded everywhere.
// ---------------------------------------------------------------------------
describe("isVerseKey", () => {
  it("accepts canonical surah:ayah keys", () => {
    expect(isVerseKey("1:1")).toBe(true);
    expect(isVerseKey("2:255")).toBe(true);
    expect(isVerseKey("114:6")).toBe(true);
  });

  it("rejects zero-indexed, malformed, and non-numeric keys", () => {
    expect(isVerseKey("0:1")).toBe(false);
    expect(isVerseKey("2:0")).toBe(false);
    expect(isVerseKey("2")).toBe(false);
    expect(isVerseKey("2:255:1")).toBe(false);
    expect(isVerseKey("abc")).toBe(false);
    expect(isVerseKey("2:255 ")).toBe(false);
  });
});

describe("validatePageNumber", () => {
  it("returns valid pages and throws on out-of-range or fractional input", () => {
    expect(validatePageNumber(1)).toBe(1);
    expect(validatePageNumber(604)).toBe(604);
    expect(() => validatePageNumber(0)).toThrow();
    expect(() => validatePageNumber(605)).toThrow();
    expect(() => validatePageNumber(3.5)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Arabic normalization — diacritics-insensitive matching for search.
// ---------------------------------------------------------------------------
describe("normalizeArabic", () => {
  it("strips harakat and tatweel", () => {
    expect(normalizeArabic("الْحَمْدُ")).toBe("الحمد");
    expect(normalizeArabic("رَحْمٰن")).toBe("رحمن");
  });

  it("unifies hamza-carrier alifs, ta marbuta, and alif maqsura", () => {
    expect(normalizeArabic("أحمد")).toBe("احمد");
    expect(normalizeArabic("إن")).toBe("ان");
    expect(normalizeArabic("آية")).toBe("ايه");
    expect(normalizeArabic("ٱلله")).toBe("الله");
    expect(normalizeArabic("رحمة")).toBe("رحمه");
    expect(normalizeArabic("موسى")).toBe("موسي");
  });

  it("collapses runs of whitespace and drops the leading space", () => {
    // Leading whitespace is dropped and internal runs collapse to one space;
    // queries are trimmed before matching, so a trailing space is harmless.
    const out = normalizeArabic("  الحمد   لله  ");
    expect(out.trimEnd()).toBe("الحمد لله");
    expect(out.startsWith(" ")).toBe(false);
    expect(out).not.toMatch(/ {2,}/);
  });
});

// ---------------------------------------------------------------------------
// Persisted-state validation — corrupt localStorage must never be trusted.
// ---------------------------------------------------------------------------
const validMark: QuranMark = {
  id: "mark-1",
  type: "bookmark",
  pageNumber: 42,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("isQuranMark / isMarksStorageV1", () => {
  it("accepts a well-formed mark and storage envelope", () => {
    expect(isQuranMark(validMark)).toBe(true);
    expect(isMarksStorageV1({ version: 1, marks: [validMark] })).toBe(true);
    expect(isMarksStorageV1({ version: 1, marks: [] })).toBe(true);
  });

  it("rejects corrupt, mistyped, or out-of-range values", () => {
    expect(isQuranMark({ ...validMark, pageNumber: 0 })).toBe(false);
    expect(isQuranMark({ ...validMark, pageNumber: 9999 })).toBe(false);
    expect(isQuranMark({ ...validMark, type: "not-a-type" })).toBe(false);
    expect(isQuranMark({ ...validMark, id: "" })).toBe(false);
    expect(isQuranMark(null)).toBe(false);
    expect(isMarksStorageV1({ version: 2, marks: [validMark] })).toBe(false);
    expect(isMarksStorageV1({ version: 1, marks: [{ id: "x" }] })).toBe(false);
    expect(isMarksStorageV1("[]")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Server-side input validation — the trust boundary for user-owned data.
// ---------------------------------------------------------------------------
describe("validateCreateMark", () => {
  it("accepts a minimal valid mark and fills page metadata", () => {
    const mark = validateCreateMark({ id: "abc123", type: "bookmark", pageNumber: 42 });
    expect(mark.type).toBe("bookmark");
    expect(mark.pageNumber).toBe(42);
    expect(mark.surahNumber).toBeGreaterThan(0);
    expect(typeof mark.createdAt).toBe("string");
  });

  it("rejects missing/short id, bad type, and out-of-range page", () => {
    expect(() => validateCreateMark(null)).toThrow();
    expect(() => validateCreateMark({ type: "bookmark", pageNumber: 1 })).toThrow();
    expect(() => validateCreateMark({ id: "ab", type: "bookmark", pageNumber: 1 })).toThrow();
    expect(() => validateCreateMark({ id: "abc", type: "nope", pageNumber: 1 })).toThrow();
    expect(() => validateCreateMark({ id: "abc", type: "bookmark", pageNumber: 0 })).toThrow();
    expect(() => validateCreateMark({ id: "abc", type: "bookmark", pageNumber: 605 })).toThrow();
  });

  it("rejects an invalid verseKey and over-long note", () => {
    expect(() =>
      validateCreateMark({ id: "abc", type: "bookmark", pageNumber: 1, verseKey: "not-a-key" })
    ).toThrow();
    expect(() =>
      validateCreateMark({ id: "abc", type: "note", pageNumber: 1, note: "x".repeat(5001) })
    ).toThrow();
  });
});

describe("validatePatchMark", () => {
  it("accepts a partial patch and stamps updatedAt", () => {
    const patch = validatePatchMark({ note: "  hello  " });
    expect(patch.note).toBe("hello");
    expect(typeof patch.updatedAt).toBe("string");
  });

  it("rejects invalid enum/page and an invalid verseKey", () => {
    expect(() => validatePatchMark({ type: "nope" })).toThrow();
    expect(() => validatePatchMark({ pageNumber: 0 })).toThrow();
    expect(() => validatePatchMark({ verseKey: "bad" })).toThrow();
  });
});

describe("validatePreferencePatch", () => {
  it("accepts a valid theme and last-read page", () => {
    expect(validatePreferencePatch({ readerTheme: "green" })).toEqual({ readerTheme: "green" });
    expect(validatePreferencePatch({ lastReadPage: 42 })).toEqual({ lastReadPage: 42 });
  });

  it("ignores fields from the removed appearance feature without throwing", () => {
    const patch = validatePreferencePatch({ mushafStyle: "classic", syncMushafWithTheme: true });
    expect(patch).toEqual({});
  });

  it("rejects an invalid theme and out-of-range page", () => {
    expect(() => validatePreferencePatch({ readerTheme: "rainbow" })).toThrow();
    expect(() => validatePreferencePatch({ lastReadPage: 0 })).toThrow();
    expect(() => validatePreferencePatch({ lastReadPage: 605 })).toThrow();
    expect(() => validatePreferencePatch(null)).toThrow();
  });
});
