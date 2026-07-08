// Quran audio domain types, shared by the client (panel, hook, service) and
// the server route — a sibling of lib/tafsir/types.ts. The audio itself is
// ALWAYS a real recitation fetched from the source's own CDN, never generated
// or altered; this layer only resolves WHERE each ayah's file lives.

export type ReciterId = "minshawi";

export interface Reciter {
  id: ReciterId;
  /** Latin display name, for logs/dev surfaces. */
  label: string;
  /** Arabic display name, shown verbatim in the UI. */
  arabicName: string;
  /** Which catalogue the recitation ids below belong to. */
  source: "quran-foundation";
  /**
   * Ayah-by-ayah recitation id in the Quran.com / Quran Foundation catalogue
   * (GET /resources/recitations). Undefined = not yet confirmed against the
   * live catalogue; the server refuses to serve it rather than guess.
   */
  recitationId?: number;
}

export interface AyahAudio {
  /** "surah:ayah", e.g. "2:255" — same key the tafsir entries carry. */
  verseKey: string;
  /** Absolute URL of the recitation mp3 on the source's CDN. */
  audioUrl: string;
  durationMs?: number;
  /** Word-level timing segments, passed through untouched when provided. */
  segments?: unknown;
}

export interface PageAudio {
  pageNumber: number;
  reciterId: ReciterId;
  ayahs: AyahAudio[];
}

/** Machine-readable error codes from /api/audio; the UI maps them to Arabic. */
export type AudioErrorCode =
  | "invalid_params"
  | "unknown_reciter"
  | "reciter_not_configured"
  | "ayah_not_found"
  | "upstream_error"
  | "upstream_shape"
  | "network";

export interface AudioApiError {
  error: { code: AudioErrorCode; message: string };
}
