// Standalone integrity check for the committed search dataset — runs without
// a rebuild, so it can guard the search feature in isolation.
//
//   node scripts/verify-search-data.mjs
//
// Validates: 114 surahs, 6236 unique ayahs, page range 1..604, every ayah maps
// to a valid page, and known anchor verses land on their expected Mushaf pages.

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SEARCH_INDEX = path.join(ROOT, "public", "data", "search-index.json");
const INDEXES = path.join(ROOT, "lib", "mushaf", "data", "indexes.json");

const PAGE_COUNT = 604;
const AYAH_COUNT = 6236;
const SURAH_COUNT = 114;

// Anchor verses with independently-known Madani 604 page numbers.
const ANCHORS = [
  { key: "1:1", page: 1 },
  { key: "2:255", page: 42 },
  { key: "114:6", page: 604 },
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const search = JSON.parse(await readFile(SEARCH_INDEX, "utf8"));
const indexes = JSON.parse(await readFile(INDEXES, "utf8"));

// --- search-index.json ---
console.log("search-index.json");
if (search.length === AYAH_COUNT) ok(`${AYAH_COUNT} ayahs`);
else fail(`expected ${AYAH_COUNT} ayahs, got ${search.length}`);

const keys = new Set();
let dupCount = 0;
let badPage = 0;
let badText = 0;
let minPage = Infinity;
let maxPage = -Infinity;
for (const r of search) {
  if (keys.has(r.k)) dupCount++;
  keys.add(r.k);
  if (!Number.isInteger(r.p) || r.p < 1 || r.p > PAGE_COUNT) badPage++;
  else {
    minPage = Math.min(minPage, r.p);
    maxPage = Math.max(maxPage, r.p);
  }
  if (typeof r.t !== "string" || r.t.length === 0) badText++;
}
if (keys.size === AYAH_COUNT) ok(`${keys.size} unique verse keys`);
else fail(`expected ${AYAH_COUNT} unique keys, got ${keys.size}`);
if (dupCount === 0) ok("no duplicate verse keys");
else fail(`${dupCount} duplicate verse keys`);
if (badPage === 0) ok(`all pages within 1..${PAGE_COUNT} (range ${minPage}..${maxPage})`);
else fail(`${badPage} ayahs have an out-of-range page`);
if (badText === 0) ok("every ayah has non-empty text");
else fail(`${badText} ayahs have missing text`);

// --- indexes.json ---
console.log("indexes.json");
if (indexes.surahs?.length === SURAH_COUNT) ok(`${SURAH_COUNT} surahs`);
else fail(`expected ${SURAH_COUNT} surahs, got ${indexes.surahs?.length}`);
if (indexes.pages?.length === PAGE_COUNT) ok(`${PAGE_COUNT} page-meta entries`);
else fail(`expected ${PAGE_COUNT} pages, got ${indexes.pages?.length}`);

let badJuz = 0;
for (const p of indexes.pages ?? []) {
  if (!Number.isInteger(p.juz) || p.juz < 1 || p.juz > 30) badJuz++;
}
if (badJuz === 0) ok("every page has a valid juz");
else fail(`${badJuz} pages have an invalid juz`);

// --- anchors ---
console.log("anchor verses");
const byKey = new Map(search.map((r) => [r.k, r]));
for (const a of ANCHORS) {
  const r = byKey.get(a.key);
  if (!r) fail(`${a.key} missing from index`);
  else if (r.p !== a.page) fail(`${a.key} on page ${r.p}, expected ${a.page}`);
  else ok(`${a.key} → page ${a.page}`);
}

console.log("");
if (failures === 0) {
  console.log("All search-data checks passed.");
} else {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
