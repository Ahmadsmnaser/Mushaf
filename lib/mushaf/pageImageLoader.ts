"use client";

import {
  clampPage,
  getPageImageUrl,
  pageToSpreadStart,
  PAGE_COUNT,
} from "@/lib/mushaf/source";

type CacheEntry = {
  promise: Promise<void>;
  status: "loading" | "ready";
  touchedAt: number;
};

const MAX_CACHE_ENTRIES = 16;
const cache = new Map<string, CacheEntry>();

function abortError() {
  return new DOMException("Page image request was superseded.", "AbortError");
}

function trimCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const readyEntries = [...cache.entries()]
    .filter(([, entry]) => entry.status === "ready")
    .sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  while (cache.size > MAX_CACHE_ENTRIES && readyEntries.length > 0) {
    const [url] = readyEntries.shift()!;
    cache.delete(url);
  }
}

function waitForImage(url: string): Promise<void> {
  const existing = cache.get(url);
  if (existing) {
    existing.touchedAt = performance.now();
    return existing.promise;
  }

  const image = new Image();
  image.decoding = "async";
  const entry: CacheEntry = {
    status: "loading",
    touchedAt: performance.now(),
    promise: Promise.resolve(),
  };
  entry.promise = new Promise<void>((resolve, reject) => {
    image.onload = async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
        entry.status = "ready";
        entry.touchedAt = performance.now();
        trimCache();
        resolve();
      } catch (error) {
        // Some browsers reject decode() after a successful load. A populated
        // bitmap is still a safe readiness fallback in that case.
        if (image.complete && image.naturalWidth > 0) {
          entry.status = "ready";
          entry.touchedAt = performance.now();
          trimCache();
          resolve();
        } else {
          cache.delete(url);
          reject(error);
        }
      }
    };
    image.onerror = () => {
      cache.delete(url);
      reject(new Error(`Unable to load Mushaf page image: ${url}`));
    };
  });
  cache.set(url, entry);
  image.src = url;
  return entry.promise;
}

function withAbort(promise: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

export function getSpreadPageNumbers(page: number, single: boolean): number[] {
  const target = clampPage(page);
  if (single) return [target];
  const start = pageToSpreadStart(target);
  return [start, start + 1].filter((candidate) => candidate <= PAGE_COUNT);
}

export async function loadPageImages(
  pages: readonly number[],
  signal?: AbortSignal
): Promise<void> {
  const valid = [...new Set(pages)].filter(
    (page) => Number.isInteger(page) && page >= 1 && page <= PAGE_COUNT
  );
  if (valid.length !== pages.length) {
    throw new RangeError("A Mushaf page image request was outside the valid range.");
  }
  await Promise.all(
    valid.map((page) => withAbort(waitForImage(getPageImageUrl(page)), signal))
  );
}

export function loadSpreadImages(
  page: number,
  single: boolean,
  signal?: AbortSignal
): Promise<void> {
  return loadPageImages(getSpreadPageNumbers(page, single), signal);
}

export function preloadPageImages(pages: readonly number[]): void {
  void loadPageImages(
    pages.filter((page) => page >= 1 && page <= PAGE_COUNT)
  ).catch(() => {
    // Preload failures are handled if that target becomes an actual navigation.
  });
}

export function isPageImageReady(page: number): boolean {
  return cache.get(getPageImageUrl(page))?.status === "ready";
}

export function markPageImageReady(page: number): void {
  const url = getPageImageUrl(page);
  const existing = cache.get(url);
  if (existing?.status === "ready") {
    existing.touchedAt = performance.now();
    return;
  }
  cache.set(url, {
    status: "ready",
    touchedAt: performance.now(),
    promise: Promise.resolve(),
  });
  trimCache();
}

export function forgetPageImage(page: number): void {
  cache.delete(getPageImageUrl(page));
}

/** Test-only reset; kept explicit so cache lifetime remains observable. */
export function resetPageImageCache(): void {
  cache.clear();
}
