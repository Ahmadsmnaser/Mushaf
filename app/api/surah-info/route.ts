import type { NextRequest } from "next/server";
import {
  getSurahGuideData,
  SurahGuideProviderError,
} from "@/lib/surahGuide/server";
import type {
  SurahGuideApiError,
  SurahGuideErrorCode,
} from "@/lib/surahGuide/types";

const ERROR_STATUS: Record<SurahGuideErrorCode, number> = {
  invalid_params: 400,
  upstream_error: 502,
  upstream_shape: 502,
  network: 502,
};

function errorResponse(code: SurahGuideErrorCode, message: string): Response {
  return Response.json(
    { error: { code, message } } satisfies SurahGuideApiError,
    { status: ERROR_STATUS[code] }
  );
}

export async function GET(request: NextRequest) {
  const surahNumber = Number(request.nextUrl.searchParams.get("surah"));
  if (
    !Number.isInteger(surahNumber) ||
    surahNumber < 1 ||
    surahNumber > 114
  ) {
    return errorResponse("invalid_params", "surah must be an integer in 1..114");
  }
  try {
    const data = await getSurahGuideData(surahNumber);
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=2592000",
      },
    });
  } catch (error) {
    if (error instanceof SurahGuideProviderError) {
      return errorResponse(error.code, error.message);
    }
    return errorResponse("upstream_error", "Unexpected Surah information error");
  }
}
