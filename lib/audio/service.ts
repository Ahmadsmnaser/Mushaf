// Client-side audio service: the panel and hook never talk to upstreams
// directly — audio metadata goes through our /api/audio proxy (mirroring
// lib/tafsir/service.ts). Resolved pages are promise-cached per
// (reciter, page) for the session; failures evict themselves so a retry can
// succeed. Only the mp3 STREAM goes straight to the CDN, via <audio src>.

import type { AudioApiError, AudioErrorCode, PageAudio, ReciterId } from "./types";

export class AudioError extends Error {
  constructor(
    public code: AudioErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AudioError";
  }
}

/** Arabic UI copy per error code — about the fetch, never about the content. */
export const AUDIO_ERROR_MESSAGES: Record<AudioErrorCode, string> = {
  invalid_params: "طلب غير صالح.",
  unknown_reciter: "القارئ غير معروف.",
  reciter_not_configured: "لم يُحدَّد معرّف التلاوة لهذا القارئ بعد. راجع lib/audio/reciters.ts.",
  ayah_not_found: "لا تتوفر تلاوة لهذه الآية من هذا القارئ.",
  upstream_error: "تعذر تحميل التلاوة الآن.",
  upstream_shape: "تعذر تحميل التلاوة الآن.",
  network: "تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.",
};

const isErrorPayload = (v: unknown): v is AudioApiError =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as AudioApiError).error === "object" &&
  (v as AudioApiError).error !== null &&
  typeof (v as AudioApiError).error.code === "string";

async function requestJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new AudioError("network", AUDIO_ERROR_MESSAGES.network);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // handled below by status check
  }
  if (!res.ok) {
    if (isErrorPayload(body)) throw new AudioError(body.error.code, body.error.message);
    throw new AudioError("upstream_error", `HTTP ${res.status}`);
  }
  return body;
}

const pageCache = new Map<string, Promise<PageAudio>>();

export function fetchPageAudio(reciter: ReciterId, page: number): Promise<PageAudio> {
  const key = `${reciter}:${page}`;
  if (!pageCache.has(key)) {
    const p = requestJson(`/api/audio?reciter=${reciter}&page=${page}`).then((body) => {
      const data = body as PageAudio;
      if (!data || !Array.isArray(data.ayahs)) {
        throw new AudioError("upstream_shape", AUDIO_ERROR_MESSAGES.upstream_shape);
      }
      return data;
    });
    p.catch(() => pageCache.delete(key));
    pageCache.set(key, p);
  }
  return pageCache.get(key)!;
}

/** Resolve one ayah's mp3 URL from its page's (cached) audio manifest. */
export async function resolveAyahAudioUrl(
  reciter: ReciterId,
  verseKey: string,
  pageNumber: number
): Promise<string> {
  const pageAudio = await fetchPageAudio(reciter, pageNumber);
  const ayah = pageAudio.ayahs.find((a) => a.verseKey === verseKey);
  if (!ayah) {
    throw new AudioError("ayah_not_found", AUDIO_ERROR_MESSAGES.ayah_not_found);
  }
  return ayah.audioUrl;
}
