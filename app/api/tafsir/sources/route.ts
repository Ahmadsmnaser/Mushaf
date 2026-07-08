// GET /api/tafsir/sources — the registry plus server-side readiness, so the
// client can pick a default source and label unconfigured ones without ever
// seeing the credentials themselves.

import { TAFSIR_SOURCE_PRIORITY, TAFSIR_SOURCES } from "@/lib/tafsir/sources";
import { isTafsirSourceConfigured } from "@/lib/tafsir/server";
import type { TafsirSourceAvailability } from "@/lib/tafsir/types";

export async function GET() {
  const sources: TafsirSourceAvailability[] = TAFSIR_SOURCE_PRIORITY.flatMap((id) => {
    const info = TAFSIR_SOURCES[id];
    return info ? [{ ...info, available: isTafsirSourceConfigured(id) }] : [];
  });
  return Response.json({ sources });
}
