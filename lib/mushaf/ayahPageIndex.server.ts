import "server-only";

import pageIndex from "./data/ksu-page-verse-keys.json";
import searchIndex from "../../public/data/search-index.json";
import { isVerseKey, validatePageNumber, type ExpectedAyah } from "./ayahRegions";

interface PageIndexRecord {
  pageNumber: number;
  verseKeys: string[];
}

const textByKey = new Map(
  searchIndex.map((ayah) => [
    ayah.k,
    { verseKey: ayah.k, surahNumber: ayah.s, ayahNumber: ayah.a, text: ayah.t },
  ] as const)
);
const byPage = new Map<number, ExpectedAyah[]>();
for (const page of pageIndex as PageIndexRecord[]) {
  validatePageNumber(page.pageNumber);
  const ayahs = page.verseKeys.map((verseKey) => {
    const ayah = textByKey.get(verseKey);
    if (
      !ayah ||
      !isVerseKey(ayah.verseKey) ||
      ayah.verseKey !== `${ayah.surahNumber}:${ayah.ayahNumber}` ||
      typeof ayah.text !== "string" ||
      ayah.text.length === 0
    ) {
      throw new Error(`Invalid generated Ayah index entry on page ${page.pageNumber}.`);
    }
    return { ...ayah, verseKey: ayah.verseKey };
  });
  byPage.set(page.pageNumber, ayahs);
}

export function getExpectedPageAyahs(pageNumber: number): readonly ExpectedAyah[] {
  validatePageNumber(pageNumber);
  const ayahs = byPage.get(pageNumber);
  if (!ayahs?.length) throw new Error(`Missing generated Ayah index for page ${pageNumber}.`);
  return ayahs;
}

export function pageContainsVerse(pageNumber: number, verseKey: string): boolean {
  return getExpectedPageAyahs(pageNumber).some((ayah) => ayah.verseKey === verseKey);
}
