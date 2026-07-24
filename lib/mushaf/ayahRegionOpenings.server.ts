import "server-only";

import openingRowCounts from "./data/ksu-surah-opening-rows.json";
import { isVerseKey, type VerseKey } from "./ayahRegions";

const rows = new Map<VerseKey, number>();
for (const [key, count] of Object.entries(openingRowCounts as Record<string, number>)) {
  if (!isVerseKey(key)) throw new Error(`Invalid generated opening row key ${key}.`);
  if (!Number.isInteger(count) || count < 2) {
    throw new Error(`Invalid generated opening row count ${count} for ${key}.`);
  }
  rows.set(key, count);
}

export function getKsuOpeningRowCounts(): ReadonlyMap<VerseKey, number> {
  return rows;
}
