import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import continuationIndex from "../lib/mushaf/data/ksu-ayah-continuations.json";
import openingRowIndex from "../lib/mushaf/data/ksu-surah-opening-rows.json";
import pageKeyIndex from "../lib/mushaf/data/ksu-page-verse-keys.json";
import searchIndex from "../public/data/search-index.json";
import {
  getKsuPageLineModel,
  getKsuVerseKeys,
  reconstructKsuAyahRegions,
  surahHasBasmala,
  surahOpeningFirstLine,
  type AyahBounds,
  type ExpectedAyah,
  type VerseKey,
} from "../lib/mushaf/ayahRegions";

const PAGE_COUNT = 604;
const PAGE_WIDTH = 622;
const PAGE_HEIGHT = 917;
const SOURCE_WIDTH = 456;
const SOURCE_HEIGHT = 672;
const EXPECTED_VERSE_COUNT = 6236;
const DELAY_MS = 35;
const INK_ALPHA_MINIMUM = 64;
const INK_RGB_MAXIMUM = 190;
const MINIMUM_INK_PIXELS = 18;
const MINIMUM_INK_COLUMNS = 3;
// A wrapped Ayah-1 text row fills the right margin with hundreds of ink pixels
// (~460+ observed); a centred basmala leaves it near-empty (≤~90, allowing for
// faint cartouche-ornament bleed). 200 sits in that gap with wide margin on
// both sides, so the row walk stops exactly at the basmala.
const OPENING_ROW_MIN_INK = 200;
// Display normalization — must match AyahOverlay's VISUAL_BAND_SCALE. Every line
// segment is rendered as an inset band of this fraction of its line-pitch hit
// box, so stacked segments stay visually separated. The audit confirms the
// resulting bands are uniform in height and never crowd their neighbours.
const VISUAL_BAND_SCALE = 0.78;
const MIN_DISPLAY_GAP = 12;

interface PageRecord {
  pageNumber: number;
  ayahs: ExpectedAyah[];
}

interface PageKeyRecord {
  pageNumber: number;
  verseKeys: string[];
}

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

interface RawPoint {
  x: number;
  y: number;
}

interface AuditCounters {
  pages: number;
  ayahs: number;
  regions: number;
  legacyContinuousGapAyahs: number;
  legacyBlankTailSpills: number;
  suspicious: string[];
}

const requested = process.argv.find((arg) => arg.startsWith("--pages="));
const writeIndex = process.argv.includes("--write-index");
const writeContinuations = process.argv.includes("--write-continuations");
const writeOpenings = process.argv.includes("--write-openings");
const requestedPages = requested
  ? requested.slice("--pages=".length).split(",").map(Number)
  : Array.from({ length: PAGE_COUNT }, (_, index) => index + 1);

if (writeContinuations && requested) {
  throw new Error("--write-continuations requires a complete 604-page audit.");
}
if (writeOpenings && requested) {
  throw new Error("--write-openings requires a complete 604-page audit.");
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function pageImagePath(pageNumber: number) {
  return resolve("public", "pages", `${String(pageNumber).padStart(3, "0")}.png`);
}

async function readPageImage(pageNumber: number): Promise<RawImage> {
  const path = pageImagePath(pageNumber);
  const file = await readFile(path);
  if (file.toString("ascii", 1, 4) !== "PNG") throw new Error(`Page ${pageNumber}: invalid PNG.`);
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  if (width !== PAGE_WIDTH || height !== PAGE_HEIGHT) {
    throw new Error(
      `Page ${pageNumber}: expected ${PAGE_WIDTH}x${PAGE_HEIGHT} image, received ${width}x${height}.`
    );
  }
  const decoded = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: decoded.data,
    width: decoded.info.width,
    height: decoded.info.height,
    channels: decoded.info.channels,
  };
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
        headers: { Accept: "application/json", "User-Agent": "Mushaf-coordinate-verifier/2.0" },
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

function rawPoints(payload: unknown, pageNumber: number): Map<VerseKey, RawPoint> {
  const wrapper = payload as Record<string, unknown>;
  const page = wrapper?.[String(pageNumber)] as Record<string, unknown> | undefined;
  if (!page || typeof page !== "object" || Array.isArray(page)) {
    throw new Error(`Page ${pageNumber}: malformed KSU point payload.`);
  }
  return new Map(
    Object.entries(page).map(([key, value]) => {
      if (
        !/^\d+_\d+$/.test(key) ||
        !Array.isArray(value) ||
        value.length !== 2 ||
        !value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
      ) {
        throw new Error(`Page ${pageNumber}: malformed KSU point ${key}.`);
      }
      return [key.replace("_", ":") as VerseKey, { x: value[0], y: value[1] }];
    })
  );
}

function nearestLineIndex(pageNumber: number, pointY: number): number {
  const model = getKsuPageLineModel(pageNumber);
  let result = 0;
  for (let index = 1; index < model.lineCenters.length; index++) {
    if (
      Math.abs(model.lineCenters[index] - pointY) <
      Math.abs(model.lineCenters[result] - pointY)
    ) {
      result = index;
    }
  }
  return result;
}

function isInk(image: RawImage, x: number, y: number): boolean {
  const offset = (y * image.width + x) * image.channels;
  const red = image.data[offset];
  const green = image.data[offset + 1];
  const blue = image.data[offset + 2];
  const alpha = image.data[offset + 3];
  return (
    alpha >= INK_ALPHA_MINIMUM &&
    (red + green + blue) / 3 <= INK_RGB_MAXIMUM
  );
}

function inkMetrics(
  image: RawImage,
  sourceLeft: number,
  sourceTop: number,
  sourceRight: number,
  sourceBottom: number
): { pixels: number; columns: number } {
  const left = Math.max(0, Math.floor((sourceLeft * PAGE_WIDTH) / SOURCE_WIDTH));
  const right = Math.min(
    image.width,
    Math.ceil((sourceRight * PAGE_WIDTH) / SOURCE_WIDTH)
  );
  const top = Math.max(0, Math.floor((sourceTop * PAGE_HEIGHT) / SOURCE_HEIGHT));
  const bottom = Math.min(
    image.height,
    Math.ceil((sourceBottom * PAGE_HEIGHT) / SOURCE_HEIGHT)
  );
  const columnPixels: number[] = [];
  for (let x = left; x < right; x++) {
    let pixels = 0;
    for (let y = top; y < bottom; y++) {
      if (isInk(image, x, y)) pixels++;
    }
    columnPixels.push(pixels);
  }
  // The illuminated opening-page cartouche and regular page frame can touch
  // the left crop edge. Discard that edge-connected run; Quran text farther
  // into the line remains separated by at least one empty column.
  if (columnPixels[0] > 0) {
    const firstEmpty = columnPixels.findIndex((pixels) => pixels === 0);
    if (firstEmpty === -1) return { pixels: 0, columns: 0 };
    columnPixels.fill(0, 0, firstEmpty);
  }
  const pixels = columnPixels.reduce((sum, count) => sum + count, 0);
  const columns = columnPixels.filter((count) => count > 0).length;
  return { pixels, columns };
}

function regionInkPixels(image: RawImage, region: AyahBounds): number {
  const left = Math.max(0, Math.floor(region.x));
  const right = Math.min(image.width, Math.ceil(region.x + region.width));
  const top = Math.max(0, Math.floor(region.y));
  const bottom = Math.min(image.height, Math.ceil(region.y + region.height));
  let pixels = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (isInk(image, x, y)) pixels++;
    }
  }
  return pixels;
}

function rawStripInk(
  image: RawImage,
  sourceLeft: number,
  sourceTop: number,
  sourceRight: number,
  sourceBottom: number
): number {
  const left = Math.max(0, Math.floor((sourceLeft * PAGE_WIDTH) / SOURCE_WIDTH));
  const right = Math.min(image.width, Math.ceil((sourceRight * PAGE_WIDTH) / SOURCE_WIDTH));
  const top = Math.max(0, Math.floor((sourceTop * PAGE_HEIGHT) / SOURCE_HEIGHT));
  const bottom = Math.min(image.height, Math.ceil((sourceBottom * PAGE_HEIGHT) / SOURCE_HEIGHT));
  let pixels = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (isInk(image, x, y)) pixels++;
    }
  }
  return pixels;
}

/**
 * How many text rows a surah's first Ayah occupies, measured from the page ink.
 * Walk up from the marker row while the row above still carries text ink in the
 * right margin *beyond* the basmala's centred extent — a wrapped Ayah-1 line is
 * full-width there, whereas the basmala is not, so the walk stops exactly at the
 * basmala and never counts it or the surah-name cartouche above it.
 *
 * The basmala is the sentinel that halts the walk. At-Tawbah (surah 9) has no
 * basmala, and its cartouche IS drawn inline with full-width ornament ink, so
 * without a sentinel the walk would wrongly swallow the cartouche. At-Tawbah's
 * first Ayah is a single row in this edition, so no-basmala openings return 1.
 */
function detectOpeningRowCount(
  markerLineIndex: number,
  model: ReturnType<typeof getKsuPageLineModel>,
  image: RawImage,
  hasBasmala: boolean
): number {
  if (!hasBasmala) return 1;
  let rows = 1;
  for (let line = markerLineIndex - 1; line >= 0; line--) {
    const center = model.lineCenters[line];
    const rightMargin = rawStripInk(
      image,
      model.basmalaRight + 4,
      center - model.lineHeight / 2,
      model.textRight - 2,
      center + model.lineHeight / 2
    );
    if (rightMargin < OPENING_ROW_MIN_INK) break;
    rows++;
  }
  return rows;
}

function detectContinuationKeys(
  pageNumber: number,
  ayahs: readonly ExpectedAyah[],
  points: ReadonlyMap<VerseKey, RawPoint>,
  image: RawImage
): Set<VerseKey> {
  const model = getKsuPageLineModel(pageNumber);
  const result = new Set<VerseKey>();
  let previousPoint: RawPoint | null = null;
  let previousLineIndex = 0;

  for (const ayah of ayahs) {
    const point = points.get(ayah.verseKey);
    if (!point) throw new Error(`Page ${pageNumber}: missing point ${ayah.verseKey}.`);
    const currentLineIndex = nearestLineIndex(pageNumber, point.y);
    if (
      previousPoint &&
      ayah.ayahNumber !== 1 &&
      currentLineIndex > previousLineIndex
    ) {
      const tailRight = previousPoint.x - model.markerHalfWidth - 2;
      const tailLeft = model.textLeft + 2;
      if (tailRight > tailLeft) {
        const center = model.lineCenters[previousLineIndex];
        const metrics = inkMetrics(
          image,
          tailLeft,
          center - model.lineHeight / 2,
          tailRight,
          center + model.lineHeight / 2
        );
        if (
          metrics.pixels >= MINIMUM_INK_PIXELS &&
          metrics.columns >= MINIMUM_INK_COLUMNS
        ) {
          result.add(ayah.verseKey);
        }
      }
    }
    previousPoint = point;
    previousLineIndex = currentLineIndex;
  }
  return result;
}

function countLegacyAnomalies(
  pageNumber: number,
  ayahs: readonly ExpectedAyah[],
  points: ReadonlyMap<VerseKey, RawPoint>,
  detectedContinuations: ReadonlySet<VerseKey>,
  counters: AuditCounters
) {
  const openingPage = pageNumber <= 2;
  const height = openingPage ? 20 : 30;
  const marginWidth = openingPage ? 80 : 40;
  const textWidth = openingPage ? 376 : 416;
  const offsetWidth = openingPage ? 5 : 10;
  const offsetHeight = openingPage ? 10 : 15;
  let previousLeft = textWidth;
  let previousTop = openingPage ? 270 : 37;
  let previousLineIndex = 0;

  ayahs.forEach((ayah, index) => {
    const point = points.get(ayah.verseKey)!;
    if (ayah.ayahNumber === 1 && index > 0) {
      previousTop += 110;
      previousLeft = textWidth;
    }
    const left = point.x - offsetWidth;
    const top = point.y - offsetHeight;
    const difference = top - previousTop;
    const currentLineIndex = nearestLineIndex(pageNumber, point.y);
    if (difference > height * 1.6) {
      counters.legacyContinuousGapAyahs++;
    }
    if (
      ayah.ayahNumber !== 1 &&
      currentLineIndex > previousLineIndex &&
      !detectedContinuations.has(ayah.verseKey) &&
      previousLeft - marginWidth >= 2
    ) {
      counters.legacyBlankTailSpills++;
    }
    previousTop = top;
    previousLeft = left;
    previousLineIndex = currentLineIndex;
  });
}

function auditRecords(
  pageNumber: number,
  ayahs: readonly ExpectedAyah[],
  points: ReadonlyMap<VerseKey, RawPoint>,
  records: ReturnType<typeof reconstructKsuAyahRegions>,
  detectedContinuations: ReadonlySet<VerseKey>,
  openingRows: ReadonlyMap<VerseKey, number>,
  image: RawImage,
  counters: AuditCounters
) {
  const model = getKsuPageLineModel(pageNumber);
  const expectedHeight = (model.lineHeight * PAGE_HEIGHT) / SOURCE_HEIGHT;
  const expectedByKey = new Set(ayahs.map((ayah) => ayah.verseKey));
  const actualByKey = new Set(records.map((record) => record.verseKey));
  if (expectedByKey.size !== actualByKey.size) {
    counters.suspicious.push(`page ${pageNumber}: Ayah coverage count mismatch`);
  }

  let previousLineIndex = 0;
  for (const [recordIndex, record] of records.entries()) {
    const point = points.get(record.verseKey)!;
    const currentLineIndex = nearestLineIndex(pageNumber, point.y);
    if (!expectedByKey.has(record.verseKey)) {
      counters.suspicious.push(`page ${pageNumber}: unexpected ${record.verseKey}`);
    }
    if (record.regions.length === 0) {
      counters.suspicious.push(`page ${pageNumber}: missing geometry for ${record.verseKey}`);
    }
    const signatures = new Set<string>();
    for (const region of record.regions) {
      const signature = [region.x, region.y, region.width, region.height]
        .map((value) => value.toFixed(5))
        .join(":");
      if (signatures.has(signature)) {
        counters.suspicious.push(`page ${pageNumber}: duplicate region for ${record.verseKey}`);
      }
      signatures.add(signature);
      if (
        ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
        region.x < 0 ||
        region.y < 0 ||
        region.width <= 0 ||
        region.height <= 0 ||
        region.x + region.width > PAGE_WIDTH + 0.01 ||
        region.y + region.height > PAGE_HEIGHT + 0.01
      ) {
        counters.suspicious.push(`page ${pageNumber}: out-of-bounds ${record.verseKey}`);
      }
      if (Math.abs(region.height - expectedHeight) > 0.01) {
        counters.suspicious.push(`page ${pageNumber}: non-line-height ${record.verseKey}`);
      }
      if (regionInkPixels(image, region) < MINIMUM_INK_PIXELS) {
        counters.suspicious.push(`page ${pageNumber}: blank region ${record.verseKey}`);
      }
      counters.regions++;
    }

    if (
      record.ayahNumber !== 1 &&
      currentLineIndex > previousLineIndex &&
      !detectedContinuations.has(record.verseKey)
      && recordIndex > 0
    ) {
      const previousCenter = model.lineCenters[previousLineIndex];
      const previousTop =
        ((previousCenter - model.lineHeight / 2) * PAGE_HEIGHT) / SOURCE_HEIGHT;
      if (record.regions.some((region) => Math.abs(region.y - previousTop) < 0.01)) {
        counters.suspicious.push(`page ${pageNumber}: preceding-line spill ${record.verseKey}`);
      }
    }

    if (recordIndex === 0 && record.ayahNumber !== 1 && currentLineIndex > 0) {
      const firstLineTop =
        ((model.lineCenters[0] - model.lineHeight / 2) * PAGE_HEIGHT) / SOURCE_HEIGHT;
      if (!record.regions.some((region) => Math.abs(region.y - firstLineTop) < 0.01)) {
        counters.suspicious.push(`page ${pageNumber}: carried Ayah misses first line`);
      }
    }

    if (record.ayahNumber === 1) {
      const hasBasmala = surahHasBasmala(record.surahNumber);
      const rows = openingRows.get(record.verseKey) ?? 1;
      const firstAyahLine = surahOpeningFirstLine(currentLineIndex, rows);
      const rowTop = (lineIndex: number) =>
        ((model.lineCenters[lineIndex] - model.lineHeight / 2) * PAGE_HEIGHT) / SOURCE_HEIGHT;
      // Every wrapped row of Ayah 1 (plus the basmala) must carry a rectangle;
      // a missing middle row is the multi-line-opening spill class.
      const expectedRows: number[] = [];
      if (hasBasmala) expectedRows.push(firstAyahLine - 1);
      for (let line = firstAyahLine; line <= currentLineIndex; line++) expectedRows.push(line);
      for (const line of expectedRows) {
        if (line < 0 || !record.regions.some((region) => Math.abs(region.y - rowTop(line)) < 0.01)) {
          counters.suspicious.push(
            `page ${pageNumber}: opening row ${line} uncovered for ${record.verseKey}`
          );
        }
      }
      // Nothing above the basmala (the surah-name cartouche) may be painted.
      const topBoundary = hasBasmala ? firstAyahLine - 1 : firstAyahLine;
      if (topBoundary - 1 >= 0) {
        const forbiddenTop = rowTop(topBoundary - 1);
        if (record.regions.some((region) => region.y < forbiddenTop + 0.01)) {
          counters.suspicious.push(`page ${pageNumber}: header included in ${record.verseKey}`);
        }
      }
    }
    previousLineIndex = currentLineIndex;
  }
}

/**
 * Display-consistency audit: the whole book must highlight with one uniform,
 * well-separated band thickness. Confirms every region on the page shares the
 * line-pitch band height, and that the inset display band (VISUAL_BAND_SCALE)
 * leaves at least MIN_DISPLAY_GAP between adjacent line rows so stacked segments
 * never look merged or unevenly thick.
 */
function auditDisplayConsistency(
  pageNumber: number,
  records: ReturnType<typeof reconstructKsuAyahRegions>,
  counters: AuditCounters
) {
  const model = getKsuPageLineModel(pageNumber);
  const heights = records.flatMap((record) => record.regions.map((region) => region.height));
  if (heights.length === 0) return;
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  if (max - min > 0.01) {
    counters.suspicious.push(
      `page ${pageNumber}: non-uniform band height (${(max - min).toFixed(2)}px spread)`
    );
  }
  const renderedPitch =
    ((model.lineCenters[1] - model.lineCenters[0]) * PAGE_HEIGHT) / SOURCE_HEIGHT;
  const displayGap = renderedPitch - max * VISUAL_BAND_SCALE;
  if (displayGap < MIN_DISPLAY_GAP) {
    counters.suspicious.push(
      `page ${pageNumber}: display bands crowd (${displayGap.toFixed(2)}px inter-line gap)`
    );
  }
}

async function main() {
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
  const storedContinuations = new Set(continuationIndex as VerseKey[]);
  const detectedContinuationUnion = new Set<VerseKey>();
  const storedOpenings = new Map<VerseKey, number>(
    Object.entries(openingRowIndex as Record<string, number>) as [VerseKey, number][]
  );
  const detectedOpenings = new Map<VerseKey, number>();
  const verifiedKeys = new Set<string>();
  const correctedPages: PageRecord[] = [];
  const counters: AuditCounters = {
    pages: 0,
    ayahs: 0,
    regions: 0,
    legacyContinuousGapAyahs: 0,
    legacyBlankTailSpills: 0,
    suspicious: [],
  };

  for (const pageNumber of requestedPages) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > PAGE_COUNT) {
      throw new Error(`Invalid --pages entry: ${pageNumber}`);
    }
    const image = await readPageImage(pageNumber);
    const payload = await fetchPage(pageNumber);
    const expectedAyahs = getKsuVerseKeys(payload, pageNumber).map((verseKey) => {
      const ayah = ayahByKey.get(verseKey);
      if (!ayah) throw new Error(`Page ${pageNumber}: KSU returned unknown key ${verseKey}.`);
      if (verifiedKeys.has(verseKey)) throw new Error(`KSU duplicated ${verseKey} across pages.`);
      verifiedKeys.add(verseKey);
      return ayah;
    });
    const points = rawPoints(payload, pageNumber);
    const detectedContinuations = detectContinuationKeys(
      pageNumber,
      expectedAyahs,
      points,
      image
    );
    for (const key of detectedContinuations) detectedContinuationUnion.add(key);
    const model = getKsuPageLineModel(pageNumber);
    // The two illuminated opening pages carry heavy decorative ink that the
    // margin-ink heuristic cannot separate from text; both their first Ayahs
    // (1:1 "basmala", 2:1 "الم") are single-row, so they need no detection.
    if (pageNumber > 2) {
      for (const ayah of expectedAyahs) {
        if (ayah.ayahNumber !== 1) continue;
        const point = points.get(ayah.verseKey)!;
        const rows = detectOpeningRowCount(
          nearestLineIndex(pageNumber, point.y),
          model,
          image,
          surahHasBasmala(ayah.surahNumber)
        );
        if (rows > 1) detectedOpenings.set(ayah.verseKey, rows);
      }
    }
    const reconstructionContinuations = writeContinuations
      ? detectedContinuations
      : storedContinuations;
    const reconstructionOpenings = writeOpenings ? detectedOpenings : storedOpenings;
    const records = reconstructKsuAyahRegions(pageNumber, expectedAyahs, payload, {
      continuationVerseKeys: reconstructionContinuations,
      openingRowCounts: reconstructionOpenings,
    });
    correctedPages.push({ pageNumber, ayahs: expectedAyahs });
    countLegacyAnomalies(
      pageNumber,
      expectedAyahs,
      points,
      detectedContinuations,
      counters
    );
    auditRecords(
      pageNumber,
      expectedAyahs,
      points,
      records,
      detectedContinuations,
      reconstructionOpenings,
      image,
      counters
    );
    auditDisplayConsistency(pageNumber, records, counters);
    counters.pages++;
    counters.ayahs += records.length;
    if (pageNumber % 25 === 0 || requestedPages.length < 25) {
      console.log(
        `Audited page ${pageNumber}: ${records.length} Ayahs, ` +
          `${records.reduce((sum, record) => sum + record.regions.length, 0)} regions.`
      );
    }
    await sleep(DELAY_MS);
  }

  if (!requested && counters.ayahs !== EXPECTED_VERSE_COUNT) {
    throw new Error(`Expected ${EXPECTED_VERSE_COUNT} verified Ayahs, found ${counters.ayahs}.`);
  }
  if (!requested && verifiedKeys.size !== EXPECTED_VERSE_COUNT) {
    const missing = [...allKeys].filter((key) => !verifiedKeys.has(key));
    throw new Error(`KSU key union mismatch: ${verifiedKeys.size} unique; missing ${missing.join(", ")}.`);
  }

  if (!requested && !writeContinuations) {
    const missing = [...detectedContinuationUnion].filter((key) => !storedContinuations.has(key));
    const stale = [...storedContinuations].filter((key) => !detectedContinuationUnion.has(key));
    if (missing.length || stale.length) {
      counters.suspicious.push(
        `continuation index mismatch: ${missing.length} missing, ${stale.length} stale`
      );
    }
  }

  if (!requested && !writeOpenings) {
    const keys = new Set([...detectedOpenings.keys(), ...storedOpenings.keys()]);
    const drift = [...keys].filter(
      (key) => (detectedOpenings.get(key) ?? 1) !== (storedOpenings.get(key) ?? 1)
    );
    if (drift.length) {
      counters.suspicious.push(`opening row index mismatch: ${drift.length} keys (${drift.join(", ")})`);
    }
  }

  if (writeContinuations) {
    const orderedKeys = pages
      .flatMap((page) => page.ayahs)
      .map((ayah) => ayah.verseKey)
      .filter((key) => detectedContinuationUnion.has(key));
    await writeFile(
      resolve("lib", "mushaf", "data", "ksu-ayah-continuations.json"),
      `${JSON.stringify(orderedKeys)}\n`,
      "utf8"
    );
    console.log(`Wrote ${orderedKeys.length} genuine preceding-line continuations.`);
  }

  if (writeOpenings) {
    const ordered = pages
      .flatMap((page) => page.ayahs)
      .filter((ayah) => detectedOpenings.has(ayah.verseKey))
      .reduce<Record<string, number>>((accumulator, ayah) => {
        accumulator[ayah.verseKey] = detectedOpenings.get(ayah.verseKey)!;
        return accumulator;
      }, {});
    await writeFile(
      resolve("lib", "mushaf", "data", "ksu-surah-opening-rows.json"),
      `${JSON.stringify(ordered, null, 0)}\n`,
      "utf8"
    );
    console.log(`Wrote ${Object.keys(ordered).length} multi-row surah openings.`);
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
      correctedPages.flatMap((page) =>
        page.ayahs.map((ayah) => [ayah.verseKey, page.pageNumber] as const)
      )
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
    `Legacy anomaly baseline: ${counters.legacyContinuousGapAyahs} continuous vertical-gap ` +
      `Ayahs, ${counters.legacyBlankTailSpills} blank preceding-line tails.`
  );
  console.log(
    `Coordinate audit complete: ${counters.pages} pages, ${counters.ayahs} Ayahs, ` +
      `${counters.regions} line regions, ${detectedContinuationUnion.size} genuine continuations, ` +
      `${detectedOpenings.size} multi-row openings, ${counters.suspicious.length} suspicious cases.`
  );
  if (counters.suspicious.length) {
    for (const issue of counters.suspicious.slice(0, 100)) console.error(`- ${issue}`);
    if (counters.suspicious.length > 100) {
      console.error(`- ... ${counters.suspicious.length - 100} additional cases`);
    }
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
