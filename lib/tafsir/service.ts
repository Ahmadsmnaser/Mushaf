// Client-side tafsir service: the panel and hook never talk to upstreams
// directly — everything goes through our /api/tafsir proxy so credentials
// stay server-side. Successful pages are promise-cached per (source, page);
// failures evict themselves so a retry can succeed.

import type {
  PageTafsir,
  TafsirApiError,
  TafsirErrorCode,
  TafsirSourceAvailability,
} from "./types";
import type { TafsirSourceId } from "./types";

export class TafsirError extends Error {
  constructor(
    public code: TafsirErrorCode,
    message: string
  ) {
    super(message);
    this.name = "TafsirError";
  }
}

/** Arabic UI copy per error code — about the fetch, never invented content. */
export const TAFSIR_ERROR_MESSAGES: Record<TafsirErrorCode, string> = {
  invalid_params: "طلب غير صالح.",
  unknown_source: "مصدر التفسير غير معروف.",
  source_not_configured:
    "هذا المصدر يتطلب مفتاح API على الخادم ولم يُعَدّ بعد. راجع ملف ‎.env.example‎.",
  upstream_error: "تعذّر الوصول إلى خادم المصدر. تحقّق من الاتصال ثم أعد المحاولة.",
  upstream_shape: "أعاد خادم المصدر استجابة غير متوقعة.",
  network: "تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.",
};

const isErrorPayload = (v: unknown): v is TafsirApiError =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as TafsirApiError).error === "object" &&
  (v as TafsirApiError).error !== null &&
  typeof (v as TafsirApiError).error.code === "string";

async function requestJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new TafsirError("network", TAFSIR_ERROR_MESSAGES.network);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // handled below by status check
  }
  if (!res.ok) {
    if (isErrorPayload(body)) throw new TafsirError(body.error.code, body.error.message);
    throw new TafsirError("upstream_error", `HTTP ${res.status}`);
  }
  return body;
}

// Bump to invalidate long-lived browser caches of /api/tafsir responses
// whenever the server-side mapping changes shape or fixes content.
const API_VERSION = 2;

const pageCache = new Map<string, Promise<PageTafsir>>();

export function fetchPageTafsir(
  source: TafsirSourceId,
  page: number
): Promise<PageTafsir> {
  const key = `${source}:${page}`;
  if (!pageCache.has(key)) {
    const p = requestJson(
      `/api/tafsir?source=${source}&page=${page}&v=${API_VERSION}`
    ).then((body) => {
      const data = body as PageTafsir;
      if (!data || !Array.isArray(data.entries)) {
        throw new TafsirError("upstream_shape", TAFSIR_ERROR_MESSAGES.upstream_shape);
      }
      return data;
    });
    p.catch(() => pageCache.delete(key));
    pageCache.set(key, p);
  }
  return pageCache.get(key)!;
}

let sourcesPromise: Promise<TafsirSourceAvailability[]> | null = null;

export function fetchTafsirSources(): Promise<TafsirSourceAvailability[]> {
  if (!sourcesPromise) {
    sourcesPromise = requestJson("/api/tafsir/sources").then((body) => {
      const data = body as { sources?: TafsirSourceAvailability[] };
      if (!Array.isArray(data.sources)) {
        throw new TafsirError("upstream_shape", TAFSIR_ERROR_MESSAGES.upstream_shape);
      }
      return data.sources;
    });
    sourcesPromise.catch(() => {
      sourcesPromise = null;
    });
  }
  return sourcesPromise;
}
