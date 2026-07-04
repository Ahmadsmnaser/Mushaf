// One-time data build: fetches the full Quran (quran-simple edition) from
// api.alquran.cloud and generates:
//   lib/mushaf/data/indexes.json   — surah/juz/page indexes (small, imported statically)
//   public/data/search-index.json  — per-ayah text for client-side search (lazy-loaded)
//
// Run: node scripts/build-data.mjs
// Verified 2026-07-04: 6236 ayahs, each with { page, juz, hizbQuarter, numberInSurah }.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.alquran.cloud/v1/quran/quran-simple";
const PAGE_COUNT = 604;
const ROOT = path.join(import.meta.dirname, "..");

console.log("Fetching", API);
const res = await fetch(API);
if (!res.ok) throw new Error(`API returned ${res.status}`);
const { data } = await res.json();

if (!Array.isArray(data?.surahs) || data.surahs.length !== 114) {
  throw new Error("Unexpected response shape: expected data.surahs[114]");
}

/** @type {{ id:number; name_ar:string; name_en:string; first_page:number; last_page:number }[]} */
const surahs = [];
/** @type {{ number:number; first_page:number }[]} */
const juzs = Array.from({ length: 30 }, (_, i) => ({ number: i + 1, first_page: Infinity }));
// pages[i] = meta for page i+1. Surah ids in reading order; juz/hizb from the first ayah on the page.
/** @type {{ surahs:number[]; juz:number; hizb:number }[]} */
const pages = Array.from({ length: PAGE_COUNT }, () => ({ surahs: [], juz: 0, hizb: 0 }));
/** @type {{ k:string; s:number; a:number; p:number; t:string }[]} */
const searchIndex = [];

for (const surah of data.surahs) {
  let first = Infinity;
  let last = 0;
  for (const ayah of surah.ayahs) {
    const { page, juz, hizbQuarter, numberInSurah, text } = ayah;
    if (!Number.isInteger(page) || page < 1 || page > PAGE_COUNT) {
      throw new Error(`Ayah ${surah.number}:${numberInSurah} has bad page ${page}`);
    }
    first = Math.min(first, page);
    last = Math.max(last, page);
    juzs[juz - 1].first_page = Math.min(juzs[juz - 1].first_page, page);

    const p = pages[page - 1];
    if (!p.surahs.includes(surah.number)) p.surahs.push(surah.number);
    if (p.juz === 0) {
      p.juz = juz;
      p.hizb = Math.ceil(hizbQuarter / 4);
    }

    searchIndex.push({ k: `${surah.number}:${numberInSurah}`, s: surah.number, a: numberInSurah, p: page, t: text });
  }
  surahs.push({
    id: surah.number,
    name_ar: surah.name,
    name_en: surah.englishName,
    first_page: first,
    last_page: last,
  });
}

// Sanity checks before writing anything.
if (searchIndex.length !== 6236) throw new Error(`Expected 6236 ayahs, got ${searchIndex.length}`);
for (const p of pages) if (p.juz === 0 || p.surahs.length === 0) throw new Error("A page has no ayahs");
for (const j of juzs) if (!Number.isFinite(j.first_page)) throw new Error(`Juz ${j.number} has no first page`);

const dataDir = path.join(ROOT, "lib", "mushaf", "data");
const publicDataDir = path.join(ROOT, "public", "data");
await mkdir(dataDir, { recursive: true });
await mkdir(publicDataDir, { recursive: true });

await writeFile(path.join(dataDir, "indexes.json"), JSON.stringify({ surahs, juzs, pages }));
await writeFile(path.join(publicDataDir, "search-index.json"), JSON.stringify(searchIndex));

console.log(`Wrote indexes.json (${surahs.length} surahs, ${juzs.length} juzs, ${pages.length} pages)`);
console.log(`Wrote search-index.json (${searchIndex.length} ayahs)`);
