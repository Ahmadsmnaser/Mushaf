// Server-only tafsir providers, called exclusively from app/api/tafsir/*.
// Never import this from client code: it reads API tokens from process.env,
// and those must not reach the browser bundle.
//
// Every provider returns the source's text VERBATIM. The single allowed
// transformation is toPlainText(): stripping HTML markup and collapsing
// whitespace for safe plain-text rendering — the wording itself is never
// touched, and nothing is ever generated or paraphrased.
//
// Upstreams (verified 2026-07-05):
//   - muyassar: Quran.com v4 public API — GET
//     https://api.quran.com/api/v4/tafsirs/ar-tafsir-muyassar/by_page/{page}
//     returns { tafsirs: [{ verse_key, text }] } in Madani 604-page numbering
//     (same pagination as our KSU page images; spot-checked page 3 = 2:6..).
//   - mokhtasar: official API per https://mokhtasr.com/ar/api-doc — base
//     https://admin.mokhtasr.com/api/v1, Bearer token from registration,
//     GET /book-contents?books={id}&sura={s}&aya={a} (ayah-based, so we fan
//     out over the page's verse keys). Requires MOKHTASAR_API_TOKEN.
//     Response shape (verified 2026-07-07 with a live token): data[] items
//     carry the AYAH in `text` and the tafsir nested in `books[].text`
//     (HTML with <br/>); «المختصر (آية وتفسير)-عربي» is book id 200.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PageTafsir, TafsirEntry, TafsirErrorCode, TafsirSourceId } from "./types";
import { TAFSIR_SOURCES } from "./sources";

const QURAN_COM_V4 = "https://api.quran.com/api/v4";
const MOKHTASAR_API = "https://admin.mokhtasr.com/api/v1";
// Tafsir text is effectively immutable; cache upstream responses for 30 days.
const REVALIDATE_S = 60 * 60 * 24 * 30;

export class TafsirProviderError extends Error {
  constructor(
    public code: TafsirErrorCode,
    message: string
  ) {
    super(message);
    this.name = "TafsirProviderError";
  }
}

export function isTafsirSourceConfigured(id: TafsirSourceId): boolean {
  if (id === "mokhtasar") return Boolean(process.env.MOKHTASAR_API_TOKEN);
  if (id === "muyassar") return true;
  return false;
}

/**
 * Markup-stripping only: <br> and paragraph breaks become newlines (the
 * panel renders them with whitespace-pre-line), other tags are removed and
 * the handful of entities the upstreams use are decoded. The words are
 * never altered.
 */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseVerseKey(key: string): { surah: number; ayah: number } | null {
  const m = /^(\d+):(\d+)$/.exec(key);
  return m ? { surah: Number(m[1]), ayah: Number(m[2]) } : null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: REVALIDATE_S }, ...init });
  } catch {
    throw new TafsirProviderError("upstream_error", `Could not reach ${new URL(url).host}`);
  }
  if (!res.ok) {
    throw new TafsirProviderError(
      "upstream_error",
      `${new URL(url).host} responded with HTTP ${res.status}`
    );
  }
  try {
    return await res.json();
  } catch {
    throw new TafsirProviderError("upstream_shape", `${new URL(url).host} returned non-JSON`);
  }
}

// ---------------------------------------------------------------------------
// Page → verse keys. Prefer the locally baked page-ayaat file (same QUL data
// the reader uses); fall back to Quran.com's verse listing when the local
// data hasn't been generated yet. Both use Madani 604-page numbering.
// ---------------------------------------------------------------------------

async function getPageVerseKeys(page: number): Promise<string[]> {
  const file = path.join(
    process.cwd(),
    "public",
    "data",
    "page-ayaat",
    `${String(page).padStart(3, "0")}.json`
  );
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as {
      ayahs?: { verseKey?: string }[];
    };
    const keys = (data.ayahs ?? [])
      .map((a) => a.verseKey)
      .filter((k): k is string => typeof k === "string" && parseVerseKey(k) !== null);
    if (keys.length > 0) return keys;
  } catch {
    // fall through to the remote listing
  }

  const data = (await fetchJson(
    `${QURAN_COM_V4}/verses/by_page/${page}?fields=&per_page=50`
  )) as { verses?: { verse_key?: string }[] };
  const keys = (data.verses ?? [])
    .map((v) => v.verse_key)
    .filter((k): k is string => typeof k === "string" && parseVerseKey(k) !== null);
  if (keys.length === 0) {
    throw new TafsirProviderError("upstream_shape", `No verse keys resolved for page ${page}`);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function fetchMuyassarPage(page: number): Promise<TafsirEntry[]> {
  const sourceName = TAFSIR_SOURCES.muyassar!.name;
  const data = (await fetchJson(
    `${QURAN_COM_V4}/tafsirs/ar-tafsir-muyassar/by_page/${page}`
  )) as { tafsirs?: { verse_key?: string; text?: string }[] };
  if (!Array.isArray(data.tafsirs)) {
    throw new TafsirProviderError("upstream_shape", "Quran.com by_page: missing tafsirs array");
  }
  const entries: TafsirEntry[] = [];
  for (const t of data.tafsirs) {
    const key = typeof t.verse_key === "string" ? parseVerseKey(t.verse_key) : null;
    if (!key || typeof t.text !== "string") continue;
    const text = toPlainText(t.text);
    if (!text) continue;
    entries.push({
      source: "muyassar",
      sourceName,
      surahNumber: key.surah,
      ayahNumber: key.ayah,
      verseKey: t.verse_key!,
      text,
    });
  }
  return entries;
}

/**
 * A book-contents item's top-level `text` is the AYAH (Quranic script) —
 * never show that as tafsir. The tafsir itself is nested in `books[].text`,
 * one entry per requested book; an empty `books` array means the book has
 * no tafsir recorded for this ayah (or the book id is wrong).
 */
function extractMokhtasarText(item: unknown): string | null {
  if (item === null || typeof item !== "object") return null;
  const books = (item as { books?: unknown }).books;
  if (!Array.isArray(books)) return null;
  for (const book of books) {
    const text = (book as { text?: unknown })?.text;
    if (typeof text === "string" && text.trim()) return toPlainText(text);
  }
  return null;
}

async function fetchMokhtasarAyah(
  token: string,
  bookId: string,
  verseKey: string
): Promise<TafsirEntry | null> {
  const key = parseVerseKey(verseKey);
  if (!key) return null;
  const url = `${MOKHTASAR_API}/book-contents?books=${encodeURIComponent(bookId)}&sura=${key.surah}&aya=${key.ayah}`;
  const data = (await fetchJson(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })) as { data?: unknown };
  const items = Array.isArray(data.data) ? data.data : data.data != null ? [data.data] : [];
  if (items.length === 0) return null; // ayah not in this book's contents
  const text = extractMokhtasarText(items[0]);
  if (!text) return null; // no tafsir entry for this ayah in the requested book
  return {
    source: "mokhtasar",
    sourceName: TAFSIR_SOURCES.mokhtasar!.name,
    surahNumber: key.surah,
    ayahNumber: key.ayah,
    verseKey,
    text,
  };
}

async function fetchMokhtasarPage(page: number): Promise<TafsirEntry[]> {
  const token = process.env.MOKHTASAR_API_TOKEN;
  if (!token) {
    throw new TafsirProviderError(
      "source_not_configured",
      "MOKHTASAR_API_TOKEN is not set; register at https://mokhtasr.com/ar/api-doc"
    );
  }
  // 200 = «المختصر (آية وتفسير)-عربي» in the mokhtasr.com catalogue.
  const bookId = process.env.MOKHTASAR_BOOK_ID ?? "200";
  const keys = await getPageVerseKeys(page);
  const entries = await Promise.all(
    keys.map((k) => fetchMokhtasarAyah(token, bookId, k))
  );
  return entries.filter((e): e is TafsirEntry => e !== null);
}

// ---------------------------------------------------------------------------

export async function getPageTafsir(
  source: TafsirSourceId,
  page: number
): Promise<PageTafsir> {
  const info = TAFSIR_SOURCES[source];
  if (!info) throw new TafsirProviderError("unknown_source", `Unknown source: ${source}`);
  const entries =
    source === "muyassar" ? await fetchMuyassarPage(page) : await fetchMokhtasarPage(page);
  return { pageNumber: page, sourceName: info.name, entries };
}
