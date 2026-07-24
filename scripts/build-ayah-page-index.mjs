import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const searchPath = join(root, "public", "data", "search-index.json");
const pageKeyPath = join(root, "lib", "mushaf", "data", "ksu-page-verse-keys.json");
const pageSurahPath = join(root, "lib", "mushaf", "data", "ksu-page-surahs.json");
const pageDataDir = join(root, "public", "data", "page-ayaat");

const verses = JSON.parse(await readFile(searchPath, "utf8"));
const pageKeys = JSON.parse(await readFile(pageKeyPath, "utf8"));
if (!Array.isArray(verses) || verses.length !== 6236) {
  throw new Error(`Expected 6,236 QUL verses, received ${verses?.length ?? "invalid data"}.`);
}

if (!Array.isArray(pageKeys) || pageKeys.length !== 604) {
  throw new Error("Expected the verified 604-page KSU key boundary map.");
}
const pages = Array.from({ length: 604 }, () => []);
const seen = new Set();
const verseByKey = new Map();
for (const verse of verses) {
  const expectedKey = `${verse.s}:${verse.a}`;
  if (
    verse.k !== expectedKey ||
    !Number.isInteger(verse.s) ||
    !Number.isInteger(verse.a) ||
    !Number.isInteger(verse.p) ||
    verse.p < 1 ||
    verse.p > 604 ||
    typeof verse.t !== "string" ||
    seen.has(verse.k)
  ) {
    throw new Error(`Invalid or duplicate QUL verse record: ${JSON.stringify(verse)}`);
  }
  seen.add(verse.k);
  verseByKey.set(verse.k, verse);
}

const correctedPageByKey = new Map();
for (const page of pageKeys) {
  if (page.pageNumber < 1 || page.pageNumber > 604 || !Array.isArray(page.verseKeys)) {
    throw new Error(`Invalid KSU page-key entry: ${JSON.stringify(page)}`);
  }
  for (const verseKey of page.verseKeys) {
    const verse = verseByKey.get(verseKey);
    if (!verse || correctedPageByKey.has(verseKey)) {
      throw new Error(`Unknown or duplicate KSU page key: ${verseKey}`);
    }
    correctedPageByKey.set(verseKey, page.pageNumber);
    pages[page.pageNumber - 1].push({
      verseKey: verse.k,
      surahNumber: verse.s,
      ayahNumber: verse.a,
      text: verse.t,
    });
  }
}
if (correctedPageByKey.size !== 6236) {
  throw new Error(`Expected 6,236 verified KSU page keys, received ${correctedPageByKey.size}.`);
}

await mkdir(pageDataDir, { recursive: true });
await Promise.all(
  pages.map((ayahs, index) =>
    writeFile(
      join(pageDataDir, `${String(index + 1).padStart(3, "0")}.json`),
      `${JSON.stringify({ pageNumber: index + 1, ayahs: ayahs.map(({ verseKey, surahNumber, ayahNumber, text }) => ({ verseKey, surah: surahNumber, ayah: ayahNumber, text })) })}\n`,
      "utf8"
    )
  )
);
await writeFile(
  searchPath,
  `${JSON.stringify(verses.map((verse) => ({ ...verse, p: correctedPageByKey.get(verse.k) })))}\n`,
  "utf8"
);
await writeFile(
  pageSurahPath,
  `${JSON.stringify(
    pages.map((ayahs, index) => ({
      pageNumber: index + 1,
      surahs: [...new Set(ayahs.map((ayah) => ayah.surahNumber))],
    })),
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  `Generated ${pages.length} page records and Surah boundaries from ${seen.size} QUL verses.`
);
