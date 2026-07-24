import type {
  SurahGuideApiError,
  SurahGuideData,
  SurahGuideErrorCode,
} from "./types";

export class SurahGuideError extends Error {
  constructor(
    public code: SurahGuideErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SurahGuideError";
  }
}

export const SURAH_GUIDE_ERROR_MESSAGES: Record<SurahGuideErrorCode, string> = {
  invalid_params: "رقم السورة غير صالح.",
  upstream_error: "تعذّر الوصول إلى مصدر معلومات السورة.",
  upstream_shape: "أعاد مصدر معلومات السورة بيانات غير متوقعة.",
  network: "تعذّر الاتصال بالخادم. تحقّق من الاتصال ثم أعد المحاولة.",
};

function isErrorCode(value: unknown): value is SurahGuideErrorCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SURAH_GUIDE_ERROR_MESSAGES, value)
  );
}

function isErrorPayload(value: unknown): value is SurahGuideApiError {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(
    error &&
      typeof error === "object" &&
      isErrorCode((error as { code?: unknown }).code)
  );
}

const cache = new Map<number, Promise<SurahGuideData>>();

export function fetchSurahGuide(surahNumber: number): Promise<SurahGuideData> {
  if (!cache.has(surahNumber)) {
    const request = fetch(`/api/surah-info?surah=${surahNumber}&v=1`)
      .then(async (response) => {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          // Shape/status validation below produces the calm public error.
        }
        if (!response.ok) {
          if (isErrorPayload(body)) {
            throw new SurahGuideError(
              body.error.code,
              SURAH_GUIDE_ERROR_MESSAGES[body.error.code]
            );
          }
          throw new SurahGuideError(
            "upstream_error",
            SURAH_GUIDE_ERROR_MESSAGES.upstream_error
          );
        }
        const data = body as SurahGuideData;
        if (
          !data ||
          data.surahNumber !== surahNumber ||
          !Array.isArray(data.sections)
        ) {
          throw new SurahGuideError(
            "upstream_shape",
            SURAH_GUIDE_ERROR_MESSAGES.upstream_shape
          );
        }
        return data;
      })
      .catch((error) => {
        cache.delete(surahNumber);
        if (error instanceof SurahGuideError) throw error;
        throw new SurahGuideError("network", SURAH_GUIDE_ERROR_MESSAGES.network);
      });
    cache.set(surahNumber, request);
  }
  return cache.get(surahNumber)!;
}
