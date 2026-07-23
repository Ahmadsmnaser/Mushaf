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

const SOURCE_WIDTH = 456;
const SOURCE_HEIGHT = 672;
const SCALE_X = PAGE_WIDTH / SOURCE_WIDTH;
const SCALE_Y = PAGE_HEIGHT / SOURCE_HEIGHT;

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

/** Reconstruct KSU's page-aware line rectangles exactly, then scale axes. */
export function reconstructKsuAyahRegions(
  pageNumber: number,
  expectedAyahs: readonly ExpectedAyah[],
  payload: unknown
): AyahOverlayRecord[] {
  validatePageNumber(pageNumber);
  if (expectedAyahs.length === 0) throw new Error("Expected page has no QUL Ayahs.");
  const raw = parseRawPage(payload, pageNumber);
  if (raw.size !== expectedAyahs.length) {
    throw new Error(`KSU/QUL Ayah count mismatch on page ${pageNumber}.`);
  }

  const openingPage = pageNumber <= 2;
  const height = openingPage ? 20 : 30;
  const marginWidth = openingPage ? 80 : 40;
  const textWidth = openingPage ? 376 : 416;
  const offsetWidth = openingPage ? 5 : 10;
  const offsetHeight = openingPage ? 10 : 15;
  let previousLeft = textWidth;
  let previousTop = openingPage ? 270 : 37;
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

    if (ayah.ayahNumber === 1 && seen.size > 1) {
      previousTop += 110;
      previousLeft = textWidth;
    }

    const left = point[0] - offsetWidth;
    const top = point[1] - offsetHeight;
    const difference = top - previousTop;
    const regions: AyahBounds[] = [];
    if (difference > height * 1.6) {
      regions.push(scaleRegion(marginWidth, previousTop, previousLeft - marginWidth, height));
      regions.push(scaleRegion(left, top, textWidth - left, height));
      regions.push(
        scaleRegion(marginWidth, previousTop + height, textWidth - marginWidth, difference - height)
      );
    } else if (difference > height * 0.6) {
      regions.push(scaleRegion(marginWidth, previousTop, previousLeft - marginWidth, height));
      regions.push(scaleRegion(left, top, textWidth - left, height));
    } else {
      regions.push(scaleRegion(left, top, previousLeft - left, height));
    }
    previousTop = top;
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
