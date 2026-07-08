// Tafsir domain types, shared by the client (panel, hook, service) and the
// server route. The text in TafsirEntry is ALWAYS the source's own words —
// fetched verbatim from a trusted publisher, never generated, paraphrased or
// mixed with anything else. Presentation-only cleanup (stripping HTML markup,
// collapsing runs of whitespace) is the only transformation allowed anywhere
// in this pipeline.

export type TafsirSourceId = "mokhtasar" | "muyassar" | "quran-foundation";

export interface TafsirEntry {
  source: TafsirSourceId;
  /** Display name of the tafsir, e.g. «المختصر في التفسير». */
  sourceName: string;
  surahNumber: number;
  ayahNumber: number;
  /** "surah:ayah", e.g. "2:255". */
  verseKey: string;
  /** The tafsir text, verbatim from the source. */
  text: string;
}

export interface PageTafsir {
  pageNumber: number;
  sourceName: string;
  entries: TafsirEntry[];
}

export interface TafsirSourceInfo {
  id: TafsirSourceId;
  /** Arabic display name, shown verbatim in the UI. */
  name: string;
  /** Who authored/published the tafsir text. */
  publisher: string;
  /** Where our server fetches it from (shown as attribution detail). */
  providerNote: string;
  /** Needs a server-side API token before it can serve content. */
  requiresToken: boolean;
}

/** What /api/tafsir/sources reports: registry info + server-side readiness. */
export interface TafsirSourceAvailability extends TafsirSourceInfo {
  /** False when the source needs a token that isn't configured on the server. */
  available: boolean;
}

/** Machine-readable error codes from /api/tafsir; the UI maps them to Arabic. */
export type TafsirErrorCode =
  | "invalid_params"
  | "unknown_source"
  | "source_not_configured"
  | "upstream_error"
  | "upstream_shape"
  | "network";

export interface TafsirApiError {
  error: { code: TafsirErrorCode; message: string };
}
