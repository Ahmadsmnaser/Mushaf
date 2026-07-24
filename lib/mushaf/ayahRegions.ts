import { PAGE_COUNT, PAGE_HEIGHT, PAGE_WIDTH } from "./source";

export type VerseKey = `${number}:${number}`;

export interface AyahBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AyahOverlayRecord {
  verseKey: VerseKey;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  text: string;
  regions: AyahBounds[];
}

export interface ExpectedAyah {
  verseKey: VerseKey;
  surahNumber: number;
  ayahNumber: number;
  text: string;
}

export interface AyahRegionResponse {
  pageNumber: number;
  source: {
    name: "KSU Ayat Hafs highlights";
    coordinateCanvas: "456x672";
    renderedCanvas: "622x917";
    scaleX: number;
    scaleY: number;
    basmala: "associated-with-first-ayah";
  };
  records: AyahOverlayRecord[];
}

export interface AyahRegionReconstructionOptions {
  /**
   * Ayahs whose text genuinely starts to the left of the preceding Ayah marker
   * before wrapping to a later line. This is generated from the matching page
   * PNGs; without it, a line change starts cleanly on the next line.
   */
  continuationVerseKeys?: ReadonlySet<VerseKey>;
  /**
   * verseKey → number of text rows a surah's FIRST Ayah occupies, for the
   * (few) surah openings whose first Ayah wraps past a single line. Generated
   * from the page PNGs; a key absent here defaults to one row. The KSU point
   * only marks Ayah 1's LAST row, so this is what lets us fill each wrapped row
   * and place the basmala correctly regardless of whether the surah-name
   * cartouche is drawn inline or only in the page's running header.
   */
  openingRowCounts?: ReadonlyMap<VerseKey, number>;
}

const SOURCE_WIDTH = 456;
const SOURCE_HEIGHT = 672;
const SCALE_X = PAGE_WIDTH / SOURCE_WIDTH;
const SCALE_Y = PAGE_HEIGHT / SOURCE_HEIGHT;

interface PageLineModel {
  lineCenters: readonly number[];
  lineHeight: number;
  textLeft: number;
  textRight: number;
  markerHalfWidth: number;
  basmalaLeft: number;
  basmalaRight: number;
}

const STANDARD_LINE_CENTERS = Array.from(
  { length: 15 },
  (_, index) => 63.5 + index * 39.4
);
const OPENING_LINE_CENTERS = Array.from(
  { length: 7 },
  (_, index) => 300 + index * 26.4
);

/**
 * KSU's point is the center of an Ayah-number marker, not a rectangle.
 * Pages 1-2 use the compact illuminated-page grid; the other 602 pages use
 * the regular 15-line Madani grid.
 */
export function getKsuPageLineModel(pageNumber: number): PageLineModel {
  validatePageNumber(pageNumber);
  if (pageNumber <= 2) {
    return {
      lineCenters: OPENING_LINE_CENTERS,
      lineHeight: 20,
      textLeft: 126,
      textRight: 330,
      markerHalfWidth: 8,
      basmalaLeft: 174,
      basmalaRight: 316,
    };
  }
  return {
    lineCenters: STANDARD_LINE_CENTERS,
    lineHeight: 30,
    textLeft: 48,
    textRight: 408,
    markerHalfWidth: 10,
    basmalaLeft: 118,
    basmalaRight: 338,
  };
}

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

export function isVerseKey(value: string): value is VerseKey {
  return /^[1-9]\d*:[1-9]\d*$/.test(value);
}

export function validatePageNumber(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > PAGE_COUNT) {
    throw new Error(`Invalid Mushaf page: ${value}`);
  }
  return value;
}

type RawPoint = readonly [number, number];

function parseRawPage(payload: unknown, pageNumber: number): Map<string, RawPoint> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Malformed KSU highlight response.");
  }
  const wrapper = payload as Record<string, unknown>;
  const rawPage = wrapper[String(pageNumber)];
  if (!rawPage || typeof rawPage !== "object" || Array.isArray(rawPage)) {
    throw new Error("KSU response did not contain the requested page.");
  }
  const result = new Map<string, RawPoint>();
  for (const [key, point] of Object.entries(rawPage as Record<string, unknown>)) {
    if (
      !/^\d+_\d+$/.test(key) ||
      !Array.isArray(point) ||
      point.length !== 2 ||
      typeof point[0] !== "number" ||
      typeof point[1] !== "number" ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    ) {
      throw new Error(`Malformed KSU highlight point for ${key}.`);
    }
    result.set(key, [point[0], point[1]]);
  }
  return result;
}

export function getKsuVerseKeys(payload: unknown, pageNumber: number): VerseKey[] {
  validatePageNumber(pageNumber);
  return [...parseRawPage(payload, pageNumber).keys()].map((key) => {
    const verseKey = key.replace("_", ":");
    if (!isVerseKey(verseKey)) throw new Error(`Invalid KSU verse key ${key}.`);
    return verseKey;
  });
}

function scaleRegion(x: number, y: number, width: number, height: number): AyahBounds {
  const region = {
    x: x * SCALE_X,
    y: y * SCALE_Y,
    width: width * SCALE_X,
    height: height * SCALE_Y,
  };
  const epsilon = 0.01;
  if (
    ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
    region.x < -epsilon ||
    region.y < -epsilon ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.x + region.width > PAGE_WIDTH + epsilon ||
    region.y + region.height > PAGE_HEIGHT + epsilon
  ) {
    throw new Error(`Out-of-bounds Ayah geometry: ${JSON.stringify(region)}`);
  }
  return region;
}

function nearestLineIndex(model: PageLineModel, pointY: number): number {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < model.lineCenters.length; index++) {
    const distance = Math.abs(pointY - model.lineCenters[index]);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }
  const maximumJitter = model.lineHeight * 0.45;
  if (nearestDistance > maximumJitter) {
    throw new Error(`KSU point ${pointY} does not match the page line grid.`);
  }
  return nearestIndex;
}

function lineRegion(
  model: PageLineModel,
  lineIndex: number,
  left: number,
  right: number
): AyahBounds {
  const center = model.lineCenters[lineIndex];
  if (center === undefined || right <= left) {
    throw new Error(`Invalid Ayah line segment ${lineIndex}: ${left}-${right}.`);
  }
  return scaleRegion(left, center - model.lineHeight / 2, right - left, model.lineHeight);
}

function appendLineRegion(
  regions: AyahBounds[],
  model: PageLineModel,
  lineIndex: number,
  left: number,
  right: number
) {
  // A sub-marker sliver is not a useful visual or pointer target.
  if (right - left < 2) return;
  regions.push(lineRegion(model, lineIndex, left, right));
}

export const surahHasBasmala = (surahNumber: number): boolean =>
  // Al-Fatihah's first Ayah *is* the basmala; At-Tawbah opens without one.
  surahNumber !== 1 && surahNumber !== 9;

/**
 * The grid row on which a surah's first Ayah text begins, anchored on the
 * marker row (its LAST row) and counting the wrapped rows upward. Anchoring at
 * the marker — rather than at the top of the opening stack — keeps this correct
 * whether or not the surah-name cartouche is drawn as an inline grid row.
 */
export function surahOpeningFirstLine(markerLineIndex: number, rows: number): number {
  return markerLineIndex - (rows - 1);
}

/**
 * Reconstruct precise line-level rectangles from KSU's Ayah-marker points.
 *
 * The old KSU demo algorithm filled the entire vertical gap between two
 * markers and always treated the unused tail of the preceding line as part of
 * the next Ayah. That is only correct when the next Ayah really starts there.
 * We instead snap markers to the edition's line grid, emit one rectangle per
 * occupied row, and consult the generated page-ink continuation map for that
 * optional leading tail.
 */
export function reconstructKsuAyahRegions(
  pageNumber: number,
  expectedAyahs: readonly ExpectedAyah[],
  payload: unknown,
  options: AyahRegionReconstructionOptions = {}
): AyahOverlayRecord[] {
  validatePageNumber(pageNumber);
  if (expectedAyahs.length === 0) throw new Error("Expected page has no QUL Ayahs.");
  const raw = parseRawPage(payload, pageNumber);
  if (raw.size !== expectedAyahs.length) {
    throw new Error(`KSU/QUL Ayah count mismatch on page ${pageNumber}.`);
  }

  const model = getKsuPageLineModel(pageNumber);
  let previousLeft = model.textRight;
  let previousLineIndex = 0;
  const seen = new Set<string>();

  return expectedAyahs.map((ayah) => {
    if (
      !isVerseKey(ayah.verseKey) ||
      !isPositiveInteger(ayah.surahNumber) ||
      !isPositiveInteger(ayah.ayahNumber) ||
      ayah.verseKey !== `${ayah.surahNumber}:${ayah.ayahNumber}` ||
      seen.has(ayah.verseKey)
    ) {
      throw new Error(`Invalid or duplicate expected Ayah ${ayah.verseKey}.`);
    }
    seen.add(ayah.verseKey);
    const sourceKey = `${ayah.surahNumber}_${ayah.ayahNumber}`;
    const point = raw.get(sourceKey);
    if (!point) throw new Error(`KSU response is missing ${ayah.verseKey}.`);
    raw.delete(sourceKey);

    const currentLineIndex = nearestLineIndex(model, point[1]);
    const left = point[0] - model.markerHalfWidth;
    if (left < model.textLeft - model.markerHalfWidth || left >= model.textRight) {
      throw new Error(`KSU point ${point[0]} is outside the page text width.`);
    }
    const regions: AyahBounds[] = [];

    if (ayah.ayahNumber === 1) {
      // A surah opening spans the basmala row plus every wrapped row of Ayah 1.
      // The marker only marks Ayah 1's LAST row; the baked row count says how
      // many rows it occupies so we can fill each and place the basmala just
      // above the first — never mislabelling wrapped text as the basmala.
      const rows = options.openingRowCounts?.get(ayah.verseKey) ?? 1;
      if (!Number.isInteger(rows) || rows < 1 || rows > currentLineIndex + 1) {
        throw new Error(`Invalid opening row count ${rows} for ${ayah.verseKey}.`);
      }
      const firstAyahLine = surahOpeningFirstLine(currentLineIndex, rows);
      if (surahHasBasmala(ayah.surahNumber)) {
        const basmalaLineIndex = firstAyahLine - 1;
        if (basmalaLineIndex < 0) {
          throw new Error(`Surah ${ayah.surahNumber} has no line available for its basmala.`);
        }
        appendLineRegion(regions, model, basmalaLineIndex, model.basmalaLeft, model.basmalaRight);
      }
      // Full-width rows for each wrapped line of Ayah 1 before its final row.
      for (let lineIndex = firstAyahLine; lineIndex < currentLineIndex; lineIndex++) {
        appendLineRegion(regions, model, lineIndex, model.textLeft, model.textRight);
      }
      appendLineRegion(regions, model, currentLineIndex, left, model.textRight);
    } else if (seen.size === 1) {
      // The first record can be an Ayah carried over from the previous page.
      // Its page-local text starts at the right edge of row 1.
      for (let lineIndex = 0; lineIndex < currentLineIndex; lineIndex++) {
        appendLineRegion(regions, model, lineIndex, model.textLeft, model.textRight);
      }
      appendLineRegion(regions, model, currentLineIndex, left, model.textRight);
    } else if (currentLineIndex < previousLineIndex) {
      throw new Error(`KSU line order moved backwards at ${ayah.verseKey}.`);
    } else if (currentLineIndex === previousLineIndex) {
      appendLineRegion(regions, model, currentLineIndex, left, previousLeft);
    } else {
      if (options.continuationVerseKeys?.has(ayah.verseKey)) {
        appendLineRegion(
          regions,
          model,
          previousLineIndex,
          model.textLeft,
          previousLeft
        );
      }
      for (let lineIndex = previousLineIndex + 1; lineIndex < currentLineIndex; lineIndex++) {
        appendLineRegion(regions, model, lineIndex, model.textLeft, model.textRight);
      }
      appendLineRegion(regions, model, currentLineIndex, left, model.textRight);
    }

    if (regions.length === 0) {
      throw new Error(`KSU reconstruction produced no region for ${ayah.verseKey}.`);
    }
    previousLineIndex = currentLineIndex;
    previousLeft = left;

    return { ...ayah, pageNumber, regions };
  });
}

export const AYAH_REGION_SOURCE: AyahRegionResponse["source"] = {
  name: "KSU Ayat Hafs highlights",
  coordinateCanvas: "456x672",
  renderedCanvas: "622x917",
  scaleX: SCALE_X,
  scaleY: SCALE_Y,
  basmala: "associated-with-first-ayah",
};
