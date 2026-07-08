// GET /api/tafsir?source={id}&page={1..604}
//
// Server-side proxy for tafsir content: upstream credentials (e.g. the
// mokhtasr.com Bearer token) stay in process.env here and never reach the
// client. Responds with a PageTafsir JSON, or { error: { code, message } }.

import type { NextRequest } from "next/server";
import { PAGE_COUNT } from "@/lib/mushaf/source";
import { isTafsirSourceId } from "@/lib/tafsir/sources";
import { getPageTafsir, TafsirProviderError } from "@/lib/tafsir/server";
import type { TafsirErrorCode } from "@/lib/tafsir/types";

const ERROR_STATUS: Record<TafsirErrorCode, number> = {
  invalid_params: 400,
  unknown_source: 400,
  source_not_configured: 503,
  upstream_error: 502,
  upstream_shape: 502,
  network: 502,
};

function errorResponse(code: TafsirErrorCode, message: string): Response {
  return Response.json({ error: { code, message } }, { status: ERROR_STATUS[code] });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const source = params.get("source");
  const page = Number(params.get("page"));

  if (!source || !isTafsirSourceId(source)) {
    return errorResponse("unknown_source", `source must be one of the registered tafsir sources`);
  }
  if (!Number.isInteger(page) || page < 1 || page > PAGE_COUNT) {
    return errorResponse("invalid_params", `page must be an integer in 1..${PAGE_COUNT}`);
  }

  try {
    const data = await getPageTafsir(source, page);
    return Response.json(data, {
      // The text never changes: let browsers keep it for a day and shared
      // caches for a month, on top of the upstream fetch cache.
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000" },
    });
  } catch (err) {
    if (err instanceof TafsirProviderError) return errorResponse(err.code, err.message);
    return errorResponse("upstream_error", "Unexpected error while fetching tafsir");
  }
}
