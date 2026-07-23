"use client";

import { getPageImageUrl, PAGE_COUNT } from "@/lib/mushaf/source";

/**
 * Centralized page-image readiness for the reader.
 *
 * The reader must never turn a page onto a blank or half-painted sheet, so
 * programmatic navigation (buttons, keyboard, wheel, search/direct jumps) waits
 * here until every image of the *target* spread is fully decoded before the
 * visible transition begins. The current spread stays on screen for the whole
 * wait — this module owns "is it ready?", never the visible swap.
 *
 * Readiness means decoded, not merely fetched: assigning `src` only starts the
 * download, and even a cached image can paint one blank frame while the browser
 * rasterizes it. `HTMLImageElement.decode()` resolves only once the bitmap is
 * ready to paint synchronously, which is exactly the guarantee a seamless turn
 * needs. Where `decode()` is unavailable (older engines, jsdom) we fall back to
 * load/error events.
 *
 * The decoded elements are retained in a small bounded LRU so recently seen
 * spreads report ready instantly and hold a reference that keeps the browser
 * from evicting + re-fetching them — while never growing without bound.
 */

// Two spreads back + current + two ahead ≈ 10 pages; 16 leaves generous slack
// without letting the retained-bitmap set grow unbounded during long reading.
const MAX_DECODED = 16;

/** LRU of decoded pages. Insertion order is the recency order (touch = re-insert). */
const decoded = new Map<number, HTMLImageElement>();
/** In-flight decodes, so concurrent callers share one request per page. */
const inFlight = new Map<number, Promise<void>>();

function isValidPage(page: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= PAGE_COUNT;
}

/** Mark a page decoded and evict the least-recently-used entries past the cap. */
function remember(page: number, img: HTMLImageElement): void {
  decoded.delete(page); // re-insert so it becomes the most-recent entry
  decoded.set(page, img);
  while (decoded.size > MAX_DECODED) {
    const oldest = decoded.keys().next().value;
    if (oldest === undefined) break;
    decoded.delete(oldest);
  }
}

/** Resolve once the image has actually painted, via load/error events. */
function decodeViaEvents(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener(
      "error",
      () => reject(new Error("image load failed")),
      { once: true }
    );
  });
}

/**
 * Decode a single page's image. Resolves when the bitmap is ready to paint;
 * rejects (without caching) if the image fails to load so the caller can keep
 * the current spread visible. Invalid page numbers resolve as a no-op.
 */
export function decodePage(page: number): Promise<void> {
  if (!isValidPage(page)) return Promise.resolve();
  const cached = decoded.get(page);
  if (cached) {
    remember(page, cached); // touch for LRU
    return Promise.resolve();
  }
  const existing = inFlight.get(page);
  if (existing) return existing;

  const img = new Image();
  img.decoding = "async";
  img.src = getPageImageUrl(page);

  const ready =
    typeof img.decode === "function" ? img.decode() : decodeViaEvents(img);

  const task = ready
    .then(() => {
      remember(page, img);
    })
    .catch((error) => {
      // Leave it uncached so a later attempt (retry / re-navigation) can reload.
      throw error;
    })
    .finally(() => {
      inFlight.delete(page);
    });

  inFlight.set(page, task);
  return task;
}

/**
 * Wait until every image of a spread is decoded. Rejects if any page fails —
 * the caller treats that as "target not ready" and holds the current spread.
 */
export function loadSpread(pages: readonly number[]): Promise<void> {
  return Promise.all(pages.map(decodePage)).then(() => undefined);
}

/** Synchronous readiness check — lets the reader take a zero-delay fast path. */
export function isPageDecoded(page: number): boolean {
  return decoded.has(page);
}

/** True only when every page of the spread is already decoded. */
export function isSpreadDecoded(pages: readonly number[]): boolean {
  return pages.every((page) => !isValidPage(page) || isPageDecoded(page));
}

/**
 * Warm a spread ahead of time without surfacing failures — used for bounded
 * nearby preloading. Fire-and-forget; a failed warm simply isn't cached.
 */
export function preloadSpread(pages: readonly number[]): void {
  for (const page of pages) {
    if (isValidPage(page)) void decodePage(page).catch(() => {});
  }
}

/** Test seam: clear all cached/in-flight state between cases. */
export function __resetSpreadLoader(): void {
  decoded.clear();
  inFlight.clear();
}
