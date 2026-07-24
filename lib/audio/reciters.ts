// Client-safe reciter registry: display metadata + catalogue ids only, no
// secrets (mirrors lib/tafsir/sources.ts). To add a reciter later: extend
// ReciterId in ./types.ts, confirm the ayah-by-ayah recitation id via
// GET https://api.quran.com/api/v4/resources/recitations, and add an entry
// here — the route, service, hook and panel need no changes.

import type { Reciter, ReciterId } from "./types";

export const RECITERS: Partial<Record<ReciterId, Reciter>> = {
  minshawi: {
    id: "minshawi",
    label: "Muhammad Siddiq Al-Minshawi",
    arabicName: "محمد صديق المنشاوي",
    source: "quran-foundation",
    // Confirmed 2026-07-07 against GET /resources/recitations on
    // api.quran.com/api/v4: id 9 = "Mohamed Siddiq al-Minshawi", Murattal
    // (ayah-by-ayah; id 8 is his Mujawwad set).
    recitationId: 9,
    // QUL recitation resource 396 / QuranicAudio gapless Murattal set.
    // Representative files (001, 075, 085, 114) were verified as audio/mpeg.
    chapterAudio: {
      provider: "quranicaudio",
      directory: "muhammad_siddeeq_al-minshaawee",
    },
  },
};

export const DEFAULT_RECITER_ID: ReciterId = "minshawi";

export const isReciterId = (v: unknown): v is ReciterId =>
  typeof v === "string" && v in RECITERS;

export function getReciter(id: ReciterId): Reciter {
  return RECITERS[id]!;
}
