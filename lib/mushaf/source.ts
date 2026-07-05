// The single data adapter. The UI never talks to anything but this module,
// so swapping the mushaf source (images or metadata) happens only here.
//
// Sources (verified 2026-07-04, see PLAN.md §1):
//   - Page images: KSU "Ayat" Madani 604-page set, downloaded once by
//     scripts/fetch-pages.mjs and self-hosted under /public/pages/.
//   - Metadata + ayah text: api.alquran.cloud quran-simple edition, baked at
//     build time by scripts/build-data.mjs into data/indexes.json (imported
//     statically) and /public/data/search-index.json (lazy-loaded on first search).
//
// TODO(v2): word-level highlighting or cross-device sync would need
// apis.quran.foundation (OAuth). Route it through a Next.js API-route proxy so
// credentials stay server-side; the interface below should not need to change.

import indexes from "./data/indexes.json";
import {
  CURRENT_MUSHAF_SOURCE_ID,
  MUSHAF_SOURCES,
  formatMushafPageUrl,
} from "@/lib/readerConfig";

export const CURRENT_MUSHAF_SOURCE = MUSHAF_SOURCES[CURRENT_MUSHAF_SOURCE_ID];
export const PAGE_COUNT = CURRENT_MUSHAF_SOURCE.pageCount;
// Intrinsic size of every page image in the KSU set.
export const PAGE_WIDTH = 622;
export const PAGE_HEIGHT = 917;

export interface SurahMeta {
  id: number;
  name_ar: string;
  name_en: string;
  first_page: number;
  last_page: number;
}

export interface JuzMeta {
  number: number;
  first_page: number;
}

export interface PageMeta {
  pageNumber: number;
  imageUrl: string;
  /** Arabic names of the surahs appearing on this page, in reading order. */
  surahs: string[];
  juz: number;
  hizb: number;
}

export interface Spread {
  rightPage: PageMeta;
  leftPage: PageMeta;
}

export interface SearchResult {
  ayahKey: string; // "surah:ayah", e.g. "2:255"
  surah: string;
  ayahNo: number;
  page: number;
  snippet: string;
}

export function clampPage(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.trunc(n)), PAGE_COUNT);
}

export function getPageImageUrl(pageNumber: number): string {
  return formatMushafPageUrl(CURRENT_MUSHAF_SOURCE, clampPage(pageNumber));
}

export function getSurahIndex(): SurahMeta[] {
  return indexes.surahs;
}

export function getJuzIndex(): JuzMeta[] {
  return indexes.juzs;
}

export function getPageMeta(pageNumber: number): PageMeta {
  const n = clampPage(pageNumber);
  const raw = indexes.pages[n - 1];
  return {
    pageNumber: n,
    imageUrl: getPageImageUrl(n),
    surahs: raw.surahs.map((id) => indexes.surahs[id - 1].name_ar),
    juz: raw.juz,
    hizb: raw.hizb,
  };
}

/**
 * Madani convention: spreads pair (odd, even) — الفاتحة (1) faces أول البقرة (2),
 * both carrying the matching illuminated frame. The RIGHT page holds the LOWER
 * (odd) number and is read first; advancing flips right → left. 604 is even,
 * so the last spread (603, 604) is complete and start+1 never overflows.
 */
export function getSpread(pageNumber: number): Spread {
  const n = clampPage(pageNumber);
  const start = n % 2 === 0 ? n - 1 : n;
  return { rightPage: getPageMeta(start), leftPage: getPageMeta(start + 1) };
}

// ---------------------------------------------------------------------------
// Search — client-side over the bundled index. alquran.cloud's search endpoint
// was tested and rejected: it 404s on Quran text and only matches tafsir.
// ---------------------------------------------------------------------------

interface RawAyah {
  k: string;
  s: number;
  a: number;
  p: number;
  t: string;
}

/**
 * Diacritics-insensitive normalization applied to both corpus and query:
 * strips harakat/tanween, dagger alif, tatweel and Quranic annotation marks,
 * then unifies hamza-carrier alifs, ta marbuta and alif maqsura.
 * Exported for UI-side matching (e.g. filtering surah names).
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ْٰـۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

let corpusPromise: Promise<{ raw: RawAyah; norm: string }[]> | null = null;

async function loadCorpus(): Promise<{ raw: RawAyah; norm: string }[]> {
  const res = await fetch("/data/search-index.json");
  if (!res.ok) throw new Error(`search index fetch failed: HTTP ${res.status}`);
  const raw: RawAyah[] = await res.json();
  return raw.map((r) => ({ raw: r, norm: normalizeArabic(r.t) }));
}

const MAX_RESULTS = 50;

export async function search(query: string): Promise<SearchResult[]> {
  const q = normalizeArabic(query.trim()).replace(/\s+/g, " ");
  if (q.length < 2) return [];
  if (!corpusPromise) {
    // Reset the cache on failure so a later retry can succeed.
    corpusPromise = loadCorpus().catch((err) => {
      corpusPromise = null;
      throw err;
    });
  }
  const corpus = await corpusPromise;
  const results: SearchResult[] = [];
  for (const { raw, norm } of corpus) {
    if (!norm.includes(q)) continue;
    results.push({
      ayahKey: raw.k,
      surah: indexes.surahs[raw.s - 1].name_ar,
      ayahNo: raw.a,
      page: raw.p,
      snippet: raw.t.length > 160 ? `${raw.t.slice(0, 160)}…` : raw.t,
    });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}
