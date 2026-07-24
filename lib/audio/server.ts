// Server-only audio provider, called exclusively from app/api/audio/route.ts
// (same layering as lib/tafsir/server.ts). It never touches audio content —
// it only asks the catalogue which file holds each ayah's recitation and
// hands back absolute CDN URLs.
//
// Upstream (verified 2026-07-07):
//   - GET https://api.quran.com/api/v4/recitations/{recitation_id}/by_page/{page}
//     returns { audio_files: [{ verse_key, url }], pagination } in the same
//     Madani 604-page numbering as our page images. `url` is usually relative
//     ("Minshawi/Murattal/mp3/002006.mp3") and resolves against
//     https://verses.quran.com/ (spot-checked: 206 audio/mpeg). The public
//     endpoint needs no credentials — same as the muyassar tafsir provider.

import type {
  AyahAudio,
  AudioErrorCode,
  ChapterAudio,
  PageAudio,
  Reciter,
} from "./types";

const QURAN_COM_V4 = "https://api.quran.com/api/v4";
const AUDIO_CDN = "https://verses.quran.com/";
// The file layout of a published recitation is effectively immutable; cache
// upstream responses for 30 days (same policy as tafsir).
const REVALIDATE_S = 60 * 60 * 24 * 30;

export class AudioProviderError extends Error {
  constructor(
    public code: AudioErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AudioProviderError";
  }
}

async function fetchJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: REVALIDATE_S } });
  } catch {
    throw new AudioProviderError("upstream_error", `Could not reach ${new URL(url).host}`);
  }
  if (!res.ok) {
    throw new AudioProviderError(
      "upstream_error",
      `${new URL(url).host} responded with HTTP ${res.status}`
    );
  }
  try {
    return await res.json();
  } catch {
    throw new AudioProviderError("upstream_shape", `${new URL(url).host} returned non-JSON`);
  }
}

const toAbsoluteUrl = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : AUDIO_CDN + url.replace(/^\/+/, "");

export async function getPageAudio(reciter: Reciter, page: number): Promise<PageAudio> {
  if (reciter.recitationId === undefined) {
    // Developer-facing: the registry entry exists but its catalogue id was
    // never confirmed — refuse loudly instead of guessing an id.
    console.error(
      `[audio] Reciter "${reciter.id}" has no recitationId. Confirm it via ` +
        `GET ${QURAN_COM_V4}/resources/recitations and set it in lib/audio/reciters.ts.`
    );
    throw new AudioProviderError(
      "reciter_not_configured",
      `Reciter "${reciter.id}" has no confirmed recitation id`
    );
  }

  // A mushaf page holds at most ~15 ayahs, so one request suffices — but
  // follow the pagination defensively in case the shape ever changes.
  const ayahs: AyahAudio[] = [];
  for (let apiPage = 1, totalPages = 1; apiPage <= totalPages; apiPage++) {
    const data = (await fetchJson(
      `${QURAN_COM_V4}/recitations/${reciter.recitationId}/by_page/${page}?per_page=50&page=${apiPage}`
    )) as {
      audio_files?: { verse_key?: string; url?: string }[];
      pagination?: { total_pages?: number };
    };
    if (!Array.isArray(data.audio_files)) {
      throw new AudioProviderError(
        "upstream_shape",
        "Quran.com recitations by_page: missing audio_files array"
      );
    }
    for (const f of data.audio_files) {
      if (typeof f.verse_key !== "string" || typeof f.url !== "string" || !f.url) continue;
      ayahs.push({ verseKey: f.verse_key, audioUrl: toAbsoluteUrl(f.url) });
    }
    totalPages = data.pagination?.total_pages ?? 1;
  }

  if (ayahs.length === 0) {
    throw new AudioProviderError(
      "upstream_shape",
      `No audio files resolved for page ${page} (recitation ${reciter.recitationId})`
    );
  }
  return { pageNumber: page, reciterId: reciter.id, ayahs };
}

export function getChapterAudio(reciter: Reciter, surahNumber: number): ChapterAudio {
  if (!reciter.chapterAudio) {
    throw new AudioProviderError(
      "reciter_not_configured",
      `Reciter "${reciter.id}" has no verified chapter-level audio`
    );
  }
  const file = String(surahNumber).padStart(3, "0");
  return {
    surahNumber,
    reciterId: reciter.id,
    audioUrl: `https://download.quranicaudio.com/quran/${reciter.chapterAudio.directory}/${file}.mp3`,
  };
}
