import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import continuationIndex from "../lib/mushaf/data/ksu-ayah-continuations.json";
import openingRowIndex from "../lib/mushaf/data/ksu-surah-opening-rows.json";
import pageIndex from "../lib/mushaf/data/ksu-page-verse-keys.json";
import searchIndex from "../public/data/search-index.json";
import {
  reconstructKsuAyahRegions,
  type ExpectedAyah,
  type VerseKey,
} from "../lib/mushaf/ayahRegions";

const DEFAULT_CASES: VerseKey[] = [
  "1:1",
  "1:2",
  "2:1",
  "2:2",
  "2:6",
  "77:35",
  "78:1",
  "114:6",
];

// Keep in sync with AyahOverlay's VISUAL_BAND_SCALE.
const scaleArgument = process.argv.find((argument) => argument.startsWith("--scale="));
const VISUAL_BAND_SCALE = scaleArgument ? Number(scaleArgument.slice("--scale=".length)) : 0.78;
const caseArgument = process.argv.find((argument) => argument.startsWith("--cases="));
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const cases = caseArgument
  ? (caseArgument.slice("--cases=".length).split(",") as VerseKey[])
  : DEFAULT_CASES;
const outputDirectory = outputArgument
  ? resolve(outputArgument.slice("--output=".length))
  : resolve(tmpdir(), "mushaf-ayah-overlay-audit");

const searchByKey = new Map(
  searchIndex.map(
    (ayah) =>
      [
        ayah.k,
        {
          verseKey: ayah.k as VerseKey,
          surahNumber: ayah.s,
          ayahNumber: ayah.a,
          text: ayah.t,
          pageNumber: ayah.p,
        },
      ] as const
  )
);
const pageKeys = new Map(
  pageIndex.map((page) => [page.pageNumber, page.verseKeys as VerseKey[]] as const)
);
const continuations = new Set(continuationIndex as VerseKey[]);
const openingRowCounts = new Map<VerseKey, number>(
  Object.entries(openingRowIndex as Record<string, number>) as [VerseKey, number][]
);

async function fetchPage(pageNumber: number): Promise<unknown> {
  const url = new URL("https://quran.ksu.edu.sa/interface.php");
  url.search = new URLSearchParams({
    ui: "pc",
    do: "hilites",
    mosshaf: "hafs",
    t: "28",
    page: String(pageNumber),
  }).toString();
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mushaf-overlay-renderer/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Page ${pageNumber}: KSU returned HTTP ${response.status}.`);
  return response.json();
}

function expectedPageAyahs(pageNumber: number): ExpectedAyah[] {
  const keys = pageKeys.get(pageNumber);
  if (!keys) throw new Error(`Missing page index ${pageNumber}.`);
  return keys.map((key) => {
    const ayah = searchByKey.get(key);
    if (!ayah) throw new Error(`Missing search metadata ${key}.`);
    return ayah;
  });
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const payloads = new Map<number, unknown>();
  for (const verseKey of cases) {
    const ayah = searchByKey.get(verseKey);
    if (!ayah) throw new Error(`Unknown audit case ${verseKey}.`);
    let payload = payloads.get(ayah.pageNumber);
    if (!payload) {
      payload = await fetchPage(ayah.pageNumber);
      payloads.set(ayah.pageNumber, payload);
    }
    const records = reconstructKsuAyahRegions(
      ayah.pageNumber,
      expectedPageAyahs(ayah.pageNumber),
      payload,
      { continuationVerseKeys: continuations, openingRowCounts }
    );
    const selected = records.find((record) => record.verseKey === verseKey);
    if (!selected) throw new Error(`Page ${ayah.pageNumber}: missing ${verseKey}.`);
    const rectangles = selected.regions
      .map((region) => {
        // Mirror AyahOverlay's inset display band (VISUAL_BAND_SCALE).
        const height = region.height * VISUAL_BAND_SCALE;
        const y = region.y + (region.height - height) / 2;
        return (
          `<rect x="${region.x}" y="${y}" width="${region.width}" ` +
          `height="${height}" rx="6" ry="6" fill="#1b8f82" fill-opacity="0.18" ` +
          `stroke="#12675f" stroke-opacity="0.7" stroke-width="1.25"/>`
        );
      })
      .join("");
    const overlay = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="622" height="917" viewBox="0 0 622 917">` +
        rectangles +
        `</svg>`
    );
    const fileName = `page-${String(ayah.pageNumber).padStart(3, "0")}-${verseKey.replace(":", "-")}.png`;
    const outputPath = resolve(outputDirectory, fileName);
    await sharp(
      resolve("public", "pages", `${String(ayah.pageNumber).padStart(3, "0")}.png`)
    )
      .composite([{ input: overlay }])
      .png()
      .toFile(outputPath);
    console.log(
      `Rendered ${verseKey} on page ${ayah.pageNumber}: ${selected.regions.length} line regions -> ${outputPath}`
    );
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
