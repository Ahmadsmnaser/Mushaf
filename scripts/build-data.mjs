// Build static mushaf data from packaged QUL JSON resources.
//
// Required local inputs:
//   scripts/qul/raw/qpc-hafs-ayah-by-ayah.json
//     QUL resource 86: QPC Hafs script - Ayah by Ayah
//     Shape documented by QUL:
//       { "1:1": { verse_key, text, page_number, juz_number, hizb_number, ... } }
//
//   scripts/qul/raw/surah-names.json
//     QUL resource 70: Surah names
//     Shape documented by QUL:
//       { "1": { id, name, name_simple, name_arabic, ... } }
//
// Outputs:
//   lib/mushaf/data/indexes.json
//   public/data/search-index.json
//   public/data/page-ayaat/{001..604}.json

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGE_COUNT = 604;
const AYAH_COUNT = 6236;
const JUZ_COUNT = 30;
const SURAH_COUNT = 114;

const ROOT = path.join(import.meta.dirname, "..");
const RAW_DIR = path.join(import.meta.dirname, "qul", "raw");
const SCRIPT_FILE = path.join(RAW_DIR, "qpc-hafs-ayah-by-ayah.json");
const SURAHS_FILE = path.join(RAW_DIR, "surah-names.json");

const dataDir = path.join(ROOT, "lib", "mushaf", "data");
const publicDataDir = path.join(ROOT, "public", "data");
const pageAyatDir = path.join(publicDataDir, "page-ayaat");

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        [
          `Missing ${label}: ${path.relative(ROOT, file)}`,
          "Download the JSON resource from QUL and place it at that path.",
          "QUL resource pages:",
          "  - https://qul.tarteel.ai/resources/quran-script/86",
          "  - https://qul.tarteel.ai/resources/quran-metadata/70",
        ].join("\n")
      );
    }
    throw new Error(`Could not parse ${label} at ${file}: ${err.message}`);
  }
}

function asArray(raw, label) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.verses)) return raw.verses;
  if (Array.isArray(raw?.chapters)) return raw.chapters;
  if (raw && typeof raw === "object") return Object.values(raw);
  throw new Error(`${label} must be an array, keyed object, or wrapper object`);
}

function parseVerseKey(key) {
  const match = String(key).match(/^(\d+):(\d+)$/);
  if (!match) throw new Error(`Bad verse_key: ${key}`);
  return { surah: Number(match[1]), ayah: Number(match[2]) };
}

function readInt(value, field, key) {
  if (!Number.isInteger(value)) throw new Error(`${key} has bad ${field}: ${value}`);
  return value;
}

function normalizeAyahs(rawScript) {
  return asArray(rawScript, "QPC Hafs script")
    .map((raw) => {
      const verseKey = raw.verse_key ?? raw.verseKey ?? raw.key;
      const { surah, ayah } = parseVerseKey(verseKey);
      const page = readInt(raw.page_number ?? raw.pageNumber, "page_number", verseKey);
      const juz = readInt(raw.juz_number ?? raw.juzNumber, "juz_number", verseKey);
      const hizb = readInt(raw.hizb_number ?? raw.hizbNumber, "hizb_number", verseKey);
      const text = raw.text;
      if (typeof text !== "string" || text.length === 0) {
        throw new Error(`${verseKey} has missing text`);
      }
      if (page < 1 || page > PAGE_COUNT) {
        throw new Error(`${verseKey} has page_number outside 1..${PAGE_COUNT}: ${page}`);
      }
      if (juz < 1 || juz > JUZ_COUNT) {
        throw new Error(`${verseKey} has juz_number outside 1..${JUZ_COUNT}: ${juz}`);
      }
      if (hizb < 1 || hizb > 60) {
        throw new Error(`${verseKey} has hizb_number outside 1..60: ${hizb}`);
      }
      return { verseKey, surah, ayah, page, juz, hizb, text };
    })
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

function normalizeSurahs(rawSurahs) {
  return asArray(rawSurahs, "Surah names")
    .map((raw) => {
      const id = readInt(raw.id ?? raw.chapter_id ?? raw.chapterId, "id", "surah");
      const nameArabic = raw.name_arabic ?? raw.name_ar ?? raw.arabic_name;
      const nameSimple = raw.name_simple ?? raw.name_en ?? raw.name ?? raw.transliteration;
      const revelationOrder = readInt(raw.revelation_order, "revelation_order", `surah ${id}`);
      const ayahCount = readInt(raw.verses_count, "verses_count", `surah ${id}`);
      const revelationPlace = raw.revelation_place;
      if (typeof nameArabic !== "string" || nameArabic.length === 0) {
        throw new Error(`Surah ${id} has missing name_arabic`);
      }
      if (typeof nameSimple !== "string" || nameSimple.length === 0) {
        throw new Error(`Surah ${id} has missing name_simple/name`);
      }
      if (revelationPlace !== "makkah" && revelationPlace !== "madinah") {
        throw new Error(`Surah ${id} has invalid revelation_place`);
      }
      return {
        id,
        name_ar: nameArabic,
        name_en: nameSimple,
        revelation_place: revelationPlace,
        revelation_order: revelationOrder,
        ayah_count: ayahCount,
        first_page: Infinity,
        last_page: 0,
      };
    })
    .sort((a, b) => a.id - b.id);
}

function validateSurahs(surahs) {
  if (surahs.length !== SURAH_COUNT) {
    throw new Error(`Expected ${SURAH_COUNT} surahs, got ${surahs.length}`);
  }
  for (let i = 0; i < SURAH_COUNT; i++) {
    if (surahs[i]?.id !== i + 1) throw new Error(`Missing surah ${i + 1}`);
  }
}

const rawScript = await readJson(SCRIPT_FILE, "QUL QPC Hafs script JSON");
const rawSurahs = await readJson(SURAHS_FILE, "QUL surah names JSON");
const ayahs = normalizeAyahs(rawScript);
const surahs = normalizeSurahs(rawSurahs);
validateSurahs(surahs);

const seen = new Set();
const juzs = Array.from({ length: JUZ_COUNT }, (_, i) => ({
  number: i + 1,
  first_page: Infinity,
}));
const pages = Array.from({ length: PAGE_COUNT }, () => ({
  surahs: [],
  juz: 0,
  hizb: 0,
}));
const pageAyat = Array.from({ length: PAGE_COUNT }, (_, i) => ({
  page: i + 1,
  ayahs: [],
}));
const searchIndex = [];

for (const ayah of ayahs) {
  if (seen.has(ayah.verseKey)) throw new Error(`Duplicate verse_key: ${ayah.verseKey}`);
  seen.add(ayah.verseKey);

  const surah = surahs[ayah.surah - 1];
  if (!surah || surah.id !== ayah.surah) {
    throw new Error(`${ayah.verseKey} points to missing surah ${ayah.surah}`);
  }
  surah.first_page = Math.min(surah.first_page, ayah.page);
  surah.last_page = Math.max(surah.last_page, ayah.page);
  juzs[ayah.juz - 1].first_page = Math.min(juzs[ayah.juz - 1].first_page, ayah.page);

  const page = pages[ayah.page - 1];
  if (!page.surahs.includes(ayah.surah)) page.surahs.push(ayah.surah);
  if (page.juz === 0) {
    page.juz = ayah.juz;
    page.hizb = ayah.hizb;
  }

  searchIndex.push({
    k: ayah.verseKey,
    s: ayah.surah,
    a: ayah.ayah,
    p: ayah.page,
    t: ayah.text,
  });
  pageAyat[ayah.page - 1].ayahs.push({
    verseKey: ayah.verseKey,
    surah: ayah.surah,
    ayah: ayah.ayah,
    text: ayah.text,
  });
}

if (ayahs.length !== AYAH_COUNT) throw new Error(`Expected ${AYAH_COUNT} ayahs, got ${ayahs.length}`);
if (seen.size !== AYAH_COUNT) throw new Error(`Expected ${AYAH_COUNT} unique verse keys, got ${seen.size}`);
for (const surah of surahs) {
  if (!Number.isFinite(surah.first_page)) throw new Error(`Surah ${surah.id} has no ayahs`);
  const actualCount = ayahs.filter((ayah) => ayah.surah === surah.id).length;
  if (actualCount !== surah.ayah_count) {
    throw new Error(
      `Surah ${surah.id} metadata says ${surah.ayah_count} ayahs, corpus has ${actualCount}`
    );
  }
}
for (let i = 0; i < PAGE_COUNT; i++) {
  if (pages[i].juz === 0 || pages[i].surahs.length === 0) {
    throw new Error(`Page ${i + 1} has no ayahs`);
  }
}
for (const juz of juzs) {
  if (!Number.isFinite(juz.first_page)) throw new Error(`Juz ${juz.number} has no first page`);
}

await mkdir(dataDir, { recursive: true });
await mkdir(publicDataDir, { recursive: true });
await rm(pageAyatDir, { recursive: true, force: true });
await mkdir(pageAyatDir, { recursive: true });

await writeFile(
  path.join(dataDir, "indexes.json"),
  JSON.stringify({ surahs, juzs, pages })
);
await writeFile(
  path.join(dataDir, "surah-details.json"),
  JSON.stringify(
    surahs.map((surah) => ({
      id: surah.id,
      revelationOrder: surah.revelation_order,
      revelationPlace: surah.revelation_place,
      ayahCount: surah.ayah_count,
    }))
  )
);
await writeFile(path.join(publicDataDir, "search-index.json"), JSON.stringify(searchIndex));

for (const page of pageAyat) {
  await writeFile(
    path.join(pageAyatDir, `${String(page.page).padStart(3, "0")}.json`),
    JSON.stringify(page)
  );
}

console.log(`Read QUL inputs from ${path.relative(ROOT, RAW_DIR)}`);
console.log(`Wrote indexes.json (${surahs.length} surahs, ${juzs.length} juzs, ${pages.length} pages)`);
console.log(`Wrote surah-details.json (${surahs.length} surahs)`);
console.log(`Wrote search-index.json (${searchIndex.length} ayahs)`);
console.log(`Wrote page-ayaat (${pageAyat.length} pages)`);
