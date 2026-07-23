import { NextResponse } from "next/server";
import {
  AYAH_REGION_SOURCE,
  reconstructKsuAyahRegions,
  validatePageNumber,
  type AyahRegionResponse,
} from "@/lib/mushaf/ayahRegions";
import { getExpectedPageAyahs } from "@/lib/mushaf/ayahPageIndex.server";

const CACHE_SECONDS = 60 * 60 * 24 * 30;
const KSU_ENDPOINT = "https://quran.ksu.edu.sa/interface.php";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const rawPage = (await params).page;
  const pageNumber = Number(rawPage);
  try {
    validatePageNumber(pageNumber);
  } catch {
    return NextResponse.json({ error: "invalid_page" }, { status: 400 });
  }

  const url = new URL(KSU_ENDPOINT);
  url.search = new URLSearchParams({
    ui: "pc",
    do: "hilites",
    mosshaf: "hafs",
    t: "28",
    page: String(pageNumber),
  }).toString();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) throw new Error(`KSU returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    const records = reconstructKsuAyahRegions(
      pageNumber,
      getExpectedPageAyahs(pageNumber),
      payload
    );
    const body: AyahRegionResponse = {
      pageNumber,
      source: AYAH_REGION_SOURCE,
      records,
    };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`,
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ayah_regions_fetch_failed",
        pageNumber,
        source: KSU_ENDPOINT,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json(
      { error: "regions_unavailable", pageNumber },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
