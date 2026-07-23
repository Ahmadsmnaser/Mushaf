import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pageKeyIndex from "../lib/mushaf/data/ksu-page-verse-keys.json";
import searchIndex from "../public/data/search-index.json";
import {
  getKsuVerseKeys,
  reconstructKsuAyahRegions,
  type ExpectedAyah,
} from "../lib/mushaf/ayahRegions";

const PAGE_COUNT = 604;
const EXPECTED_VERSE_COUNT = 6236;
const DELAY_MS = 35;

interface PageRecord {
  pageNumber: number;
  ayahs: ExpectedAyah[];
}

interface PageKeyRecord {
  pageNumber: number;
  verseKeys: string[];
}

const requested = process.argv.find((arg) => arg.startsWith("--pages="));
const writeIndex = process.argv.includes("--write-index");
const requestedPages = requested
  ? requested.slice("--pages=".length).split(",").map(Number)
  : Array.from({ length: PAGE_COUNT }, (_, index) => index + 1);

const sleep = (milliseconds: number) =>
  new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function verifyPng(pageNumber: number) {
  const path = resolve("public", "pages", `${String(pageNumber).padStart(3, "0")}.png`);
  const file = await readFile(path);
  if (file.toString("ascii", 1, 4) !== "PNG") throw new Error(`Page ${pageNumber}: invalid PNG.`);
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  if (width !== 622 || height !== 917) {
    throw new Error(`Page ${pageNumber}: expected 622x917 image, received ${width}x${height}.`);
  }
}

async function fetchPage(pageNumber: number): Promise<unknown> {
  const url = new URL("https://quran.ksu.edu.sa/interface.php");
  url.search = new URLSearchParams({
    ui: "pc",
    do: "hilites",
    mosshaf: "hafs",
    t: "28",
    page: String(pageNumber),
  }).toString();
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Mushaf-coordinate-verifier/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

async function main() {
const searchByKey = new Map(
  searchIndex.map(
    (ayah) =>
      [
        ayah.k,
        {
          verseKey: ayah.k as `${number}:${number}`,
          surahNumber: ayah.s,
          ayahNumber: ayah.a,
          text: ayah.t,
        },
      ] as const
  )
);
const pages = (pageKeyIndex as PageKeyRecord[]).map((page) => ({
  pageNumber: page.pageNumber,
  ayahs: page.verseKeys.map((verseKey) => {
    const ayah = searchByKey.get(verseKey);
    if (!ayah) throw new Error(`KSU page map contains unknown key ${verseKey}.`);
    return ayah;
  }),
}));
if (pages.length !== PAGE_COUNT) throw new Error(`Expected ${PAGE_COUNT} indexed pages.`);
const allKeys = new Set(pages.flatMap((page) => page.ayahs.map((ayah) => ayah.verseKey)));
if (allKeys.size !== EXPECTED_VERSE_COUNT) {
  throw new Error(`Expected ${EXPECTED_VERSE_COUNT} unique QUL verse keys, found ${allKeys.size}.`);
}
const ayahByKey = new Map(
  pages.flatMap((page) => page.ayahs).map((ayah) => [ayah.verseKey, ayah] as const)
);
const verifiedKeys = new Set<string>();
const correctedPages: PageRecord[] = [];

let verifiedVerses = 0;
let verifiedRegions = 0;
for (const pageNumber of requestedPages) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > PAGE_COUNT) {
    throw new Error(`Invalid --pages entry: ${pageNumber}`);
  }
  await verifyPng(pageNumber);
  const payload = await fetchPage(pageNumber);
  const expectedAyahs = getKsuVerseKeys(payload, pageNumber).map((verseKey) => {
    const ayah = ayahByKey.get(verseKey);
    if (!ayah) throw new Error(`Page ${pageNumber}: KSU returned unknown key ${verseKey}.`);
    if (verifiedKeys.has(verseKey)) throw new Error(`KSU duplicated ${verseKey} across pages.`);
    verifiedKeys.add(verseKey);
    return ayah;
  });
  const records = reconstructKsuAyahRegions(pageNumber, expectedAyahs, payload);
  correctedPages.push({ pageNumber, ayahs: expectedAyahs });
  const regionSet = new Set<string>();
  for (const record of records) {
    for (const region of record.regions) {
      const signature = [region.x, region.y, region.width, region.height]
        .map((value) => value.toFixed(5))
        .join(":");
      const unique = `${record.verseKey}:${signature}`;
      if (regionSet.has(unique)) throw new Error(`Page ${pageNumber}: duplicate region ${unique}.`);
      regionSet.add(unique);
      verifiedRegions++;
    }
  }
  verifiedVerses += records.length;
  if (pageNumber % 25 === 0 || requestedPages.length < 25) {
    console.log(`Verified page ${pageNumber}: ${records.length} Ayahs, ${regionSet.size} regions.`);
  }
  await sleep(DELAY_MS);
}

if (!requested && verifiedVerses !== EXPECTED_VERSE_COUNT) {
  throw new Error(`Expected ${EXPECTED_VERSE_COUNT} verified Ayahs, found ${verifiedVerses}.`);
}
if (!requested && verifiedKeys.size !== EXPECTED_VERSE_COUNT) {
  const missing = [...allKeys].filter((key) => !verifiedKeys.has(key));
  throw new Error(`KSU key union mismatch: ${verifiedKeys.size} unique; missing ${missing.join(", ")}.`);
}
if (writeIndex) {
  if (requested) throw new Error("--write-index requires a complete 604-page verification.");
  const keyMapPath = resolve("lib", "mushaf", "data", "ksu-page-verse-keys.json");
  const pageDataDir = resolve("public", "data", "page-ayaat");
  await mkdir(pageDataDir, { recursive: true });
  await writeFile(
    keyMapPath,
    `${JSON.stringify(
      correctedPages.map((page) => ({
        pageNumber: page.pageNumber,
        verseKeys: page.ayahs.map((ayah) => ayah.verseKey),
      }))
    )}\n`,
    "utf8"
  );
  await Promise.all(
    correctedPages.map((page) =>
      writeFile(
        resolve(pageDataDir, `${String(page.pageNumber).padStart(3, "0")}.json`),
        `${JSON.stringify({
          pageNumber: page.pageNumber,
          ayahs: page.ayahs.map((ayah) => ({
            verseKey: ayah.verseKey,
            surah: ayah.surahNumber,
            ayah: ayah.ayahNumber,
            text: ayah.text,
          })),
        })}\n`,
        "utf8"
      )
    )
  );
  const correctedPageByKey = new Map<string, number>(
    correctedPages.flatMap((page) => page.ayahs.map((ayah) => [ayah.verseKey, page.pageNumber] as const))
  );
  const searchPath = resolve("public", "data", "search-index.json");
  const search = JSON.parse(await readFile(searchPath, "utf8")) as Array<{
    k: string;
    s: number;
    a: number;
    p: number;
    t: string;
  }>;
  await writeFile(
    searchPath,
    `${JSON.stringify(search.map((ayah) => ({ ...ayah, p: correctedPageByKey.get(ayah.k) })))}\n`,
    "utf8"
  );
  console.log("Synchronized compact/page-scoped indexes to verified KSU page boundaries.");
}
console.log(
  `Coordinate verification complete: ${requestedPages.length} pages, ${verifiedVerses} Ayahs, ${verifiedRegions} regions, ${requestedPages.length} local images.`
);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
