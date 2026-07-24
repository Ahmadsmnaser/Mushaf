import { describe, expect, it } from "vitest";
import {
  PAGE_COUNT,
  pageToTrackRatio,
  pointerDeltaToPage,
  resetPageScrubberMetadataCache,
  resolvePageScrubberMetadata,
  rulerOffsetForPage,
  rulerWindow,
  stepPage,
  trackRatioToPage,
} from "@/lib/mushaf/pageScrubber";

// ---------------------------------------------------------------------------
// Page metadata — resolved synchronously from the bundled local index only.
// ---------------------------------------------------------------------------
describe("resolvePageScrubberMetadata", () => {
  it("resolves page, primary Surah, and Juz from local data", () => {
    resetPageScrubberMetadataCache();
    const meta = resolvePageScrubberMetadata(1);
    expect(meta.pageNumber).toBe(1);
    expect(meta.juzNumber).toBe(1);
    expect(meta.primarySurahNumber).toBe(1);
    expect(meta.primarySurahNameArabic.length).toBeGreaterThan(0);
    expect(meta.surahNamesArabic.length).toBe(meta.surahNumbers.length);
  });

  it("keeps every Surah on a shared page addressable, in reading order", () => {
    // The final Madani page carries several short Surahs.
    const meta = resolvePageScrubberMetadata(PAGE_COUNT);
    expect(meta.surahNumbers.length).toBeGreaterThanOrEqual(2);
    expect(meta.surahNamesArabic.length).toBe(meta.surahNumbers.length);
    // Primary is the first in reading order, deterministically.
    expect(meta.primarySurahNumber).toBe(meta.surahNumbers[0]);
  });

  it("clamps and memoises out-of-range input safely", () => {
    expect(resolvePageScrubberMetadata(0).pageNumber).toBe(1);
    expect(resolvePageScrubberMetadata(9999).pageNumber).toBe(PAGE_COUNT);
  });
});

// ---------------------------------------------------------------------------
// Ruler geometry — a bounded window, never 604 numbers.
// ---------------------------------------------------------------------------
describe("rulerWindow", () => {
  it("returns a bounded window around the preview page", () => {
    expect(rulerWindow(50, 4)).toEqual([46, 47, 48, 49, 50, 51, 52, 53, 54]);
  });

  it("clips the window at both boundaries", () => {
    expect(rulerWindow(2, 4, PAGE_COUNT)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rulerWindow(PAGE_COUNT - 1, 4, PAGE_COUNT)).toEqual([599, 600, 601, 602, 603, 604]);
  });
});

describe("rulerOffsetForPage", () => {
  it("places later pages LEFT of centre (negative) for the RTL advance", () => {
    expect(rulerOffsetForPage(50, 50, 52)).toBe(0);
    expect(rulerOffsetForPage(51, 50, 52)).toBe(-52); // next page → left
    expect(rulerOffsetForPage(49, 50, 52)).toBe(52); // previous page → right
  });
});

// ---------------------------------------------------------------------------
// Directional mapping — one rule: rightward advances to later pages.
// ---------------------------------------------------------------------------
describe("pointerDeltaToPage", () => {
  it("advances on rightward drag and retreats on leftward drag", () => {
    expect(pointerDeltaToPage(50, 52, 52)).toBe(51); // right → next
    expect(pointerDeltaToPage(50, -52, 52)).toBe(49); // left → previous
    expect(pointerDeltaToPage(50, 0, 52)).toBe(50);
  });

  it("clamps to the valid page range on long drags", () => {
    expect(pointerDeltaToPage(50, 52 * 1000, 52)).toBe(PAGE_COUNT);
    expect(pointerDeltaToPage(50, -52 * 1000, 52)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Progress-track mapping — page 1 at the low end, last page at the high end.
// ---------------------------------------------------------------------------
describe("track ratio mapping", () => {
  it("round-trips the endpoints and the midpoint", () => {
    expect(pageToTrackRatio(1)).toBe(0);
    expect(pageToTrackRatio(PAGE_COUNT)).toBe(1);
    expect(trackRatioToPage(0)).toBe(1);
    expect(trackRatioToPage(1)).toBe(PAGE_COUNT);
    expect(trackRatioToPage(0.5)).toBe(Math.round(1 + 0.5 * (PAGE_COUNT - 1)));
  });

  it("snaps to integer pages and clamps out-of-range ratios", () => {
    expect(Number.isInteger(trackRatioToPage(0.333))).toBe(true);
    expect(trackRatioToPage(-1)).toBe(1);
    expect(trackRatioToPage(2)).toBe(PAGE_COUNT);
  });
});

describe("stepPage", () => {
  it("steps and clamps against the page bounds", () => {
    expect(stepPage(50, 1)).toBe(51);
    expect(stepPage(50, -1)).toBe(49);
    expect(stepPage(PAGE_COUNT, 1)).toBe(PAGE_COUNT);
    expect(stepPage(1, -1)).toBe(1);
    expect(stepPage(600, 10)).toBe(PAGE_COUNT);
  });
});
