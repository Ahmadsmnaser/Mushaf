// GET /api/audio?reciter={id}&page={1..604}
// GET /api/audio?reciter={id}&surah={1..114}
//
// Server-side adapter for recitation audio metadata: either the ayah files on
// a page or one verified gapless chapter file. The mp3 bytes stream straight
// from the source CDN to the shared <audio> element.

import type { NextRequest } from "next/server";
import { PAGE_COUNT } from "@/lib/mushaf/source";
import { getReciter, isReciterId } from "@/lib/audio/reciters";
import { AudioProviderError, getChapterAudio, getPageAudio } from "@/lib/audio/server";
import type { AudioErrorCode } from "@/lib/audio/types";

const ERROR_STATUS: Record<AudioErrorCode, number> = {
  invalid_params: 400,
  unknown_reciter: 400,
  reciter_not_configured: 503,
  ayah_not_found: 404,
  upstream_error: 502,
  upstream_shape: 502,
  network: 502,
};

function errorResponse(code: AudioErrorCode, message: string): Response {
  return Response.json({ error: { code, message } }, { status: ERROR_STATUS[code] });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const reciter = params.get("reciter");
  const page = Number(params.get("page"));
  const surah = Number(params.get("surah"));

  if (!reciter || !isReciterId(reciter)) {
    return errorResponse("unknown_reciter", "reciter must be one of the registered reciters");
  }
  const wantsSurah = params.has("surah");
  if (wantsSurah && (!Number.isInteger(surah) || surah < 1 || surah > 114)) {
    return errorResponse("invalid_params", "surah must be an integer in 1..114");
  }
  if (!wantsSurah && (!Number.isInteger(page) || page < 1 || page > PAGE_COUNT)) {
    return errorResponse("invalid_params", `page must be an integer in 1..${PAGE_COUNT}`);
  }

  try {
    const data = wantsSurah
      ? getChapterAudio(getReciter(reciter), surah)
      : await getPageAudio(getReciter(reciter), page);
    return Response.json(data, {
      // A published recitation's file layout never changes: let browsers keep
      // it for a day and shared caches for a month (same policy as tafsir).
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000" },
    });
  } catch (err) {
    if (err instanceof AudioProviderError) return errorResponse(err.code, err.message);
    return errorResponse("upstream_error", "Unexpected error while fetching audio data");
  }
}
