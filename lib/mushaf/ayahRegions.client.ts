import type { AyahOverlayRecord, AyahRegionResponse } from "./ayahRegions";

const pagePromises = new Map<number, Promise<AyahOverlayRecord[]>>();

export function getPageAyahRegions(pageNumber: number): Promise<AyahOverlayRecord[]> {
  const cached = pagePromises.get(pageNumber);
  if (cached) return cached;
  const request = fetch(`/api/ayah-regions/${pageNumber}`, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Ayah regions unavailable (${response.status}).`);
      const payload = (await response.json()) as AyahRegionResponse;
      if (payload.pageNumber !== pageNumber || !Array.isArray(payload.records)) {
        throw new Error("Malformed Ayah region response.");
      }
      return payload.records;
    })
    .catch((error) => {
      pagePromises.delete(pageNumber);
      throw error;
    });
  pagePromises.set(pageNumber, request);
  return request;
}
