import "server-only";

import continuationKeys from "./data/ksu-ayah-continuations.json";
import { isVerseKey, type VerseKey } from "./ayahRegions";

const keys = new Set<VerseKey>();
for (const key of continuationKeys) {
  if (!isVerseKey(key)) throw new Error(`Invalid generated Ayah continuation key ${key}.`);
  keys.add(key);
}

export function getKsuContinuationVerseKeys(): ReadonlySet<VerseKey> {
  return keys;
}
