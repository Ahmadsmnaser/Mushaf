// Client-safe tafsir source registry: display metadata only. Endpoints and
// credentials live server-side in lib/tafsir/server.ts — nothing here may
// ever hold a token or secret.

import type { TafsirSourceId, TafsirSourceInfo } from "./types";

export const TAFSIR_SOURCES: Partial<Record<TafsirSourceId, TafsirSourceInfo>> = {
  mokhtasar: {
    id: "mokhtasar",
    name: "المختصر في التفسير",
    publisher: "مركز تفسير للدراسات القرآنية",
    providerNote: "عبر الواجهة الرسمية mokhtasr.com",
    requiresToken: true,
  },
  muyassar: {
    id: "muyassar",
    name: "التفسير الميسر",
    publisher: "مجمع الملك فهد لطباعة المصحف الشريف",
    providerNote: "عبر واجهة Quran.com (Quran Foundation)",
    requiresToken: false,
  },
  // "quran-foundation": reserved for further tafsirs served from
  // apis.quran.foundation (OAuth). Add its entry + a server provider when
  // credentials are provisioned; the rest of the pipeline needs no changes.
};

/** Preferred order when picking a default: المختصر first when configured. */
export const TAFSIR_SOURCE_PRIORITY: TafsirSourceId[] = ["mokhtasar", "muyassar"];

export const TAFSIR_SOURCE_OPTIONS = Object.values(TAFSIR_SOURCES);

export const isTafsirSourceId = (v: unknown): v is TafsirSourceId =>
  typeof v === "string" && v in TAFSIR_SOURCES;
