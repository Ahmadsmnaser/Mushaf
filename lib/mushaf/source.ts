// The single data adapter. The UI never talks to anything but this module,
// so swapping the mushaf source (images or metadata) happens only here.
//
// Sources (verified 2026-07-04, see PLAN.md §1):
//   - Page images: KSU "Ayat" Madani 604-page set, downloaded once by
//     scripts/fetch-pages.mjs and self-hosted under /public/pages/.
//   - Metadata + ayah text: QUL JSON resources, baked at build time by
//     scripts/build-data.mjs into data/indexes.json (imported statically),
//     /public/data/search-index.json (lazy-loaded on first search), and
//     /public/data/page-ayaat/{page}.json (lazy-loaded by page).
//
// TODO(v2): word-level highlighting or cross-device sync would need
// apis.quran.foundation (OAuth). Route it through a Next.js API-route proxy so
// credentials stay server-side; the interface below should not need to change.

import indexes from "./data/indexes.json";
import ksuPageSurahs from "./data/ksu-page-surahs.json";
import surahDetails from "./data/surah-details.json";
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
  revelation_place: "makkah" | "madinah";
  revelation_order: number;
  ayah_count: number;
  first_page: number;
  last_page: number;
}

const ksuSurahPageRanges = new Map<number, { firstPage: number; lastPage: number }>();

for (const entry of ksuPageSurahs) {
  for (const surahNumber of entry.surahs) {
    const current = ksuSurahPageRanges.get(surahNumber);
    if (current) {
      current.lastPage = entry.pageNumber;
    } else {
      ksuSurahPageRanges.set(surahNumber, {
        firstPage: entry.pageNumber,
        lastPage: entry.pageNumber,
      });
    }
  }
}

const SURAH_INDEX: SurahMeta[] = indexes.surahs.map((surah, index) => {
  const details = surahDetails[index];
  const pageRange = ksuSurahPageRanges.get(surah.id);
  if (!details || details.id !== surah.id) {
    throw new Error(`Missing QUL metadata for Surah ${surah.id}`);
  }
  if (!pageRange) {
    throw new Error(`Missing KSU page range for Surah ${surah.id}`);
  }
  return {
    ...surah,
    first_page: pageRange.firstPage,
    last_page: pageRange.lastPage,
    revelation_place: details.revelationPlace as "makkah" | "madinah",
    revelation_order: details.revelationOrder,
    ayah_count: details.ayahCount,
  };
});

export interface JuzMeta {
  number: number;
  first_page: number;
}

export interface PageMeta {
  pageNumber: number;
  imageUrl: string;
  /** Canonical Surah numbers appearing on this page, in reading order. */
  surahNumbers: number[];
  /** Arabic names of the surahs appearing on this page, in reading order. */
  surahs: string[];
  juz: number;
  hizb: number;
}

export interface Spread {
  rightPage: PageMeta;
  leftPage: PageMeta;
}

/** A verse-text match. `matchRanges` are [start, end) indices INTO `text`
 *  (the original, unmodified verse) for safe highlighting. */
export interface SearchResult {
  kind: "verse";
  ayahKey: string; // "surah:ayah", e.g. "2:255"
  surah: string; // Arabic surah name, with honorific
  surahNumber: number;
  ayahNo: number;
  page: number;
  juz: number;
  text: string; // original verse text, never altered
  matchRanges: [number, number][];
}

/** A direct reference hit ("2:255", "البقرة 255") — navigates to an exact ayah. */
export interface ReferenceResult {
  kind: "reference";
  ayahKey: string;
  surah: string;
  surahNumber: number;
  ayahNo: number;
  page: number;
}

/** A surah-name hit — offers navigation to the surah's first page. */
export interface SurahResult {
  kind: "surah";
  surahNumber: number;
  surah: string;
  page: number;
}

export type SearchHit = SearchResult | ReferenceResult | SurahResult;

/** Stable payload a clicked result hands to the reader. */
export interface VerseNavigationTarget {
  page: number;
  ayahKey: string;
  surahNumber: number;
  ayahNo: number;
}

export interface PageAyah {
  verseKey: string;
  surah: number;
  ayah: number;
  text: string;
}

export function clampPage(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.trunc(n)), PAGE_COUNT);
}

export function getPageImageUrl(pageNumber: number): string {
  return formatMushafPageUrl(CURRENT_MUSHAF_SOURCE, clampPage(pageNumber));
}

export function getSurahIndex(): SurahMeta[] {
  return SURAH_INDEX;
}

export function getSurahMeta(surahNumber: number): SurahMeta | null {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return null;
  }
  return getSurahIndex()[surahNumber - 1] ?? null;
}

export function getJuzIndex(): JuzMeta[] {
  return indexes.juzs;
}

export function getPageMeta(pageNumber: number): PageMeta {
  const n = clampPage(pageNumber);
  const raw = indexes.pages[n - 1];
  // Visible Surahs must follow the exact KSU image/overlay edition. Generic
  // Quran page metadata differs at a few cross-page boundaries.
  const ksuPage = ksuPageSurahs[n - 1];
  if (!ksuPage || ksuPage.pageNumber !== n) {
    throw new Error(`Missing KSU Surah mapping for page ${n}`);
  }
  return {
    pageNumber: n,
    imageUrl: getPageImageUrl(n),
    surahNumbers: [...ksuPage.surahs],
    surahs: ksuPage.surahs.map((id) => indexes.surahs[id - 1].name_ar),
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
/** Madani spread start: the odd/right page of the spread containing `n`.
 *  The single source of truth for page → spread — imported by the reader. */
export function pageToSpreadStart(n: number): number {
  const p = clampPage(n);
  return p % 2 === 0 ? p - 1 : p;
}

export function getSpread(pageNumber: number): Spread {
  const start = pageToSpreadStart(pageNumber);
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

export interface SurahAyah {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  text: string;
}

// Harakat/tanween/sukun/shadda, dagger alif, tatweel, Quranic annotation
// marks, and zero-width characters (incl. the stray BOM on 1:1) — all dropped
// so a query typed without diacritics still matches the fully-voweled corpus.
const REMOVE_RE = /[\u064B-\u0652\u0670\u0640\u06D6-\u06ED\uFEFF\u200B-\u200F\u2060]/;

export interface NormalizedText {
  norm: string;
  /** map[i] = index in the original string of normalized char i. */
  map: number[];
}

/**
 * Normalize Arabic for matching while keeping a char-index map back to the
 * original: strips the marks above, unifies hamza-carrier alifs, ta marbuta
 * (ة→ه) and alif maqsura (ى→ي), and collapses whitespace. The map lets a
 * match found in normalized space be highlighted in the untouched original.
 */
export function normalizeWithMap(text: string): NormalizedText {
  let norm = "";
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (REMOVE_RE.test(ch)) continue;
    let out: string;
    if (/\s/.test(ch)) {
      if (lastWasSpace || norm === "") continue; // collapse + no leading space
      out = " ";
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
      if (ch === "أ" || ch === "إ" || ch === "آ" || ch === "ٱ") out = "ا";
      else if (ch === "ة") out = "ه";
      else if (ch === "ى") out = "ي";
      else out = ch;
    }
    norm += out;
    map.push(i);
  }
  return { norm, map };
}

/**
 * Diacritics-insensitive normalization applied to both corpus and query.
 * Exported for UI-side matching (e.g. filtering surah names).
 */
export function normalizeArabic(text: string): string {
  return normalizeWithMap(text).norm;
}

interface CorpusEntry {
  raw: RawAyah;
  norm: string;
  map: number[];
}

let rawCorpusPromise: Promise<RawAyah[]> | null = null;
let corpusPromise: Promise<CorpusEntry[]> | null = null;

async function loadRawCorpus(): Promise<RawAyah[]> {
  const res = await fetch("/data/search-index.json");
  if (!res.ok) throw new Error(`search index fetch failed: HTTP ${res.status}`);
  return (await res.json()) as RawAyah[];
}

function loadRawCorpusCached(): Promise<RawAyah[]> {
  if (!rawCorpusPromise) {
    rawCorpusPromise = loadRawCorpus().catch((err) => {
      rawCorpusPromise = null;
      throw err;
    });
  }
  return rawCorpusPromise;
}

async function loadCorpus(): Promise<CorpusEntry[]> {
  const raw = await loadRawCorpusCached();
  return raw.map((r) => {
    const { norm, map } = normalizeWithMap(r.t);
    return { raw: r, norm, map };
  });
}

/** Exact local QPC Hafs text for one complete Surah, in canonical Ayah order. */
export async function getSurahAyahs(surahNumber: number): Promise<SurahAyah[]> {
  const meta = getSurahMeta(surahNumber);
  if (!meta) throw new Error("invalid_surah");
  const raw = await loadRawCorpusCached();
  const ayahs = raw
    .filter((ayah) => ayah.s === surahNumber)
    .map((ayah) => ({
      verseKey: ayah.k,
      surahNumber: ayah.s,
      ayahNumber: ayah.a,
      pageNumber: ayah.p,
      text: ayah.t,
    }));
  if (
    ayahs.length !== meta.ayah_count ||
    ayahs.some((ayah, index) => ayah.ayahNumber !== index + 1)
  ) {
    throw new Error(`incomplete_surah_${surahNumber}`);
  }
  return ayahs;
}

function loadCorpusCached(): Promise<CorpusEntry[]> {
  if (!corpusPromise) {
    // Reset the cache on failure so a later retry can succeed.
    corpusPromise = loadCorpus().catch((err) => {
      corpusPromise = null;
      throw err;
    });
  }
  return corpusPromise;
}

const MAX_RESULTS = 50;
const MAX_QUERY_LEN = 80;
const MAX_SURAH_HITS = 5;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** Parse "2:255" or "<surah name> 255" into a verse reference, if it is one. */
function parseReference(raw: string): { surah: number; ayah: number } | null {
  const s = toLatinDigits(raw.trim());
  const colon = s.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/);
  if (colon) return validRef(Number(colon[1]), Number(colon[2]));
  const nameNum = s.match(/^(.+?)\s+(\d{1,3})$/);
  if (nameNum) {
    const qName = normalizeArabic(nameNum[1]);
    if (qName.length >= 2) {
      const match = getSurahIndex().find((su) =>
        normalizeArabic(su.name_ar).includes(qName)
      );
      if (match) return validRef(match.id, Number(nameNum[2]));
    }
  }
  return null;
}

function validRef(surah: number, ayah: number): { surah: number; ayah: number } | null {
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return { surah, ayah };
}

/**
 * Deterministic tier (lower = better), or -1 to reject:
 *   0  exact normalized phrase (contiguous — also covers single words/prefixes)
 *   1  all query words present, in order (gaps allowed)
 *   2  all query words present, any order
 */
function rankTier(
  norm: string,
  q: string,
  tokens: string[],
  orderRe: RegExp | null
): number {
  if (norm.includes(q)) return 0;
  if (tokens.length > 1) {
    if (orderRe && orderRe.test(norm)) return 1;
    if (tokens.every((t) => norm.includes(t))) return 2;
  }
  return -1;
}

function collectOccurrences(hay: string, needle: string, out: [number, number][]) {
  if (!needle) return;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    out.push([i, i + needle.length]);
    i = hay.indexOf(needle, i + needle.length);
  }
}

/** Map a [a,b) range in normalized space to [start,end) in the original,
 *  extending end over any trailing marks so a letter's harakat stay included. */
function normRangeToOriginal(entry: CorpusEntry, a: number, b: number): [number, number] {
  const start = entry.map[a];
  let end = entry.map[b - 1] + 1;
  const t = entry.raw.t;
  while (end < t.length && REMOVE_RE.test(t[end])) end++;
  return [start, end];
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) last[1] = Math.max(last[1], sorted[i][1]);
    else merged.push(sorted[i]);
  }
  return merged;
}

function toVerseResult(entry: CorpusEntry, q: string, tokens: string[]): SearchResult {
  const normRanges: [number, number][] = [];
  if (entry.norm.includes(q)) {
    collectOccurrences(entry.norm, q, normRanges);
  } else {
    for (const t of tokens) collectOccurrences(entry.norm, t, normRanges);
  }
  const matchRanges = mergeRanges(
    normRanges.map(([a, b]) => normRangeToOriginal(entry, a, b))
  );
  return {
    kind: "verse",
    ayahKey: entry.raw.k,
    surah: indexes.surahs[entry.raw.s - 1].name_ar,
    surahNumber: entry.raw.s,
    ayahNo: entry.raw.a,
    page: entry.raw.p,
    juz: indexes.pages[entry.raw.p - 1].juz,
    text: entry.raw.t,
    matchRanges,
  };
}

/**
 * Client-side verse search over the bundled index. Returns verse-text matches
 * plus, when the query looks like one, a direct-reference hit and surah-name
 * hits as separate result kinds. Deterministic ranking; no network per call
 * after the one-time index fetch. alquran.cloud's search endpoint was tested
 * and rejected — it 404s on Quran text and only matches tafsir.
 */
export async function search(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LEN);
  const q = normalizeArabic(trimmed);
  const hits: SearchHit[] = [];

  // Surah-name matches (sync, from the static index) — a separate section.
  if (q.length >= 2) {
    for (const s of getSurahIndex()) {
      if (normalizeArabic(s.name_ar).includes(q)) {
        hits.push({ kind: "surah", surahNumber: s.id, surah: s.name_ar, page: s.first_page });
        if (hits.length >= MAX_SURAH_HITS) break;
      }
    }
  }

  if (q.length < 2) return hits;

  const corpus = await loadCorpusCached();

  // Direct reference ("2:255" / "البقرة 255") — pinned to the top.
  const ref = parseReference(trimmed);
  if (ref) {
    const entry = corpus.find((c) => c.raw.k === `${ref.surah}:${ref.ayah}`);
    if (entry) {
      hits.unshift({
        kind: "reference",
        ayahKey: entry.raw.k,
        surah: indexes.surahs[entry.raw.s - 1].name_ar,
        surahNumber: entry.raw.s,
        ayahNo: entry.raw.a,
        page: entry.raw.p,
      });
    }
  }

  // Verse-text search.
  const tokens = q.split(" ").filter(Boolean);
  const orderRe =
    tokens.length > 1
      ? new RegExp(tokens.map(escapeRegExp).join("[\\s\\S]*?"))
      : null;

  const scored: { entry: CorpusEntry; tier: number }[] = [];
  for (const entry of corpus) {
    const tier = rankTier(entry.norm, q, tokens, orderRe);
    if (tier >= 0) scored.push({ entry, tier });
  }
  scored.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.entry.raw.s - b.entry.raw.s ||
      a.entry.raw.a - b.entry.raw.a
  );

  for (const { entry } of scored.slice(0, MAX_RESULTS)) {
    hits.push(toVerseResult(entry, q, tokens));
  }
  return hits;
}

const pageAyahPromises = new Map<number, Promise<PageAyah[]>>();

export async function getPageAyahs(pageNumber: number): Promise<PageAyah[]> {
  const n = clampPage(pageNumber);
  if (!pageAyahPromises.has(n)) {
    const file = String(n).padStart(3, "0");
    pageAyahPromises.set(
      n,
      fetch(`/data/page-ayaat/${file}.json`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`page ayahs fetch failed: HTTP ${res.status}`);
          const data: { ayahs?: PageAyah[] } = await res.json();
          if (!Array.isArray(data.ayahs)) {
            throw new Error(`page ayahs ${file}.json has an invalid shape`);
          }
          return data.ayahs;
        })
        .catch((err) => {
          pageAyahPromises.delete(n);
          throw err;
        })
    );
  }
  return pageAyahPromises.get(n)!;
}
