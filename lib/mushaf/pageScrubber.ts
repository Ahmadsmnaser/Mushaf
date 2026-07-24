// Pure, DOM-free helpers for the Bottom Page Scrubber (مستعرض الصفحات السريع).
//
// Everything the scrubber needs to resolve page metadata and to map raw
// pointer / track geometry into a page number lives here, so the interaction
// hook and the presentation stay thin and the math stays unit-testable.
//
// Directional rule — the SINGLE source of truth for the scrubber, kept in
// lock-step with Reader.getNavigationDirection: this is an RTL (Arabic) book,
// so rightward pointer motion (positive deltaX) advances toward LATER pages
// and leftward motion goes back. The number ruler is a strip moving under a
// fixed centre marker, so later pages sit to the LEFT of centre (dragging the
// strip rightward pulls them in). The 1→604 progress track is a conventional
// position bar (page 1 left, last page right); dragging its handle rightward
// also advances — same gesture, so no contradictory second RTL rule exists.

import { bareSurahName } from "@/lib/surah";
import {
  clampPage,
  getPageMeta,
  getSurahMeta,
  PAGE_COUNT,
} from "@/lib/mushaf/source";

export { PAGE_COUNT, clampPage };

const arNum = (n: number) => n.toLocaleString("ar-EG");

export interface PageScrubberMetadata {
  pageNumber: number;
  /** Canonical Surah numbers on this page, in reading order. */
  surahNumbers: number[];
  /** Bare Arabic Surah names (no honorific), in reading order. */
  surahNamesArabic: string[];
  /** Deterministic "primary" Surah: the first in the page's reading order. */
  primarySurahNumber: number;
  primarySurahNameArabic: string;
  juzNumber: number;
  hizbNumber: number;
}

const metadataCache = new Map<number, PageScrubberMetadata>();

/**
 * Resolve local, verified page metadata synchronously from the bundled index —
 * no network, no full-corpus scan. Memoised per page (604 entries at most).
 *
 * Primary-Surah rule: the first Surah in the page's reading order. Pages that
 * carry more than one Surah expose the full list in `surahNamesArabic`, so the
 * card can name them all rather than silently picking one; the reader's own
 * caption uses the same source and convention.
 */
export function resolvePageScrubberMetadata(pageNumber: number): PageScrubberMetadata {
  const page = clampPage(pageNumber);
  const cached = metadataCache.get(page);
  if (cached) return cached;

  const meta = getPageMeta(page);
  const surahNumbers = meta.surahNumbers.length > 0 ? meta.surahNumbers : [1];
  const surahNamesArabic = surahNumbers.map((id) => {
    const surah = getSurahMeta(id);
    return surah ? bareSurahName(surah.name_ar) : `سورة ${arNum(id)}`;
  });
  const resolved: PageScrubberMetadata = {
    pageNumber: page,
    surahNumbers,
    surahNamesArabic,
    primarySurahNumber: surahNumbers[0],
    primarySurahNameArabic: surahNamesArabic[0],
    juzNumber: meta.juz,
    hizbNumber: meta.hizb,
  };
  metadataCache.set(page, resolved);
  return resolved;
}

/** Test-only reset so the memo's lifetime stays observable. */
export function resetPageScrubberMetadataCache(): void {
  metadataCache.clear();
}

/**
 * The bounded window of page numbers drawn around the preview page — never all
 * 604. Returns only pages inside [1, pageCount]; the ends naturally show fewer
 * numbers because each is positioned by its distance from the centre.
 */
export function rulerWindow(
  previewPage: number,
  radius: number,
  pageCount: number = PAGE_COUNT
): number[] {
  const centre = clampPage(previewPage);
  const pages: number[] = [];
  for (let p = centre - radius; p <= centre + radius; p++) {
    if (p >= 1 && p <= pageCount) pages.push(p);
  }
  return pages;
}

/**
 * Horizontal offset (px) of page `p` from the centre marker on the ruler.
 * Later pages sit to the LEFT (negative offset), so dragging the strip
 * rightward brings them toward the centre — the RTL advance gesture.
 */
export function rulerOffsetForPage(
  page: number,
  previewPage: number,
  pxPerPage: number
): number {
  return (previewPage - page) * pxPerPage;
}

/**
 * Map a horizontal drag on the ruler to a new preview page. Rightward motion
 * (deltaX > 0) advances toward later pages, matching the reader.
 */
export function pointerDeltaToPage(
  startPage: number,
  deltaX: number,
  pxPerPage: number,
  pageCount: number = PAGE_COUNT
): number {
  if (pxPerPage <= 0) return clampPage(startPage);
  const next = Math.round(startPage + deltaX / pxPerPage);
  return Math.min(Math.max(1, next), pageCount);
}

/** Progress-track position (0 = page 1, left; 1 = last page, right). */
export function pageToTrackRatio(page: number, pageCount: number = PAGE_COUNT): number {
  if (pageCount <= 1) return 0;
  return (clampPage(page) - 1) / (pageCount - 1);
}

/** Inverse of pageToTrackRatio: a 0..1 position on the track → a snapped page. */
export function trackRatioToPage(ratio: number, pageCount: number = PAGE_COUNT): number {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return Math.min(Math.max(1, Math.round(1 + clamped * (pageCount - 1))), pageCount);
}

/** One keyboard step against the preview page; sign already resolved by caller. */
export function stepPage(
  page: number,
  delta: number,
  pageCount: number = PAGE_COUNT
): number {
  return Math.min(Math.max(1, page + delta), pageCount);
}

export const scrubberArabicNumber = arNum;
