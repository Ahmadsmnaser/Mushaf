import type { SurahAyah, SurahMeta } from "@/lib/mushaf/source";

export type SurahCopyFormat = "text" | "numbered" | "named";

export const LONG_SURAH_COPY_THRESHOLD = 50;

export function bareSurahName(name: string): string {
  const [first, ...rest] = name.split(" ");
  return first.replace(/[ً-ْٰـ]/g, "") === "سورة" && rest.length > 0
    ? rest.join(" ")
    : name;
}

export function revelationPlaceLabel(place: SurahMeta["revelation_place"]): string {
  return place === "makkah" ? "مكية" : "مدنية";
}

export function formatSurahCopy(
  meta: Pick<SurahMeta, "name_ar" | "ayah_count">,
  ayahs: readonly SurahAyah[],
  format: SurahCopyFormat
): string {
  if (
    ayahs.length !== meta.ayah_count ||
    ayahs.some((ayah, index) => ayah.ayahNumber !== index + 1)
  ) {
    throw new Error("incomplete_surah");
  }

  const body = ayahs
    .map((ayah) =>
      format === "numbered"
        ? `${ayah.text} ﴿${ayah.ayahNumber.toLocaleString("ar-EG")}﴾`
        : ayah.text
    )
    .join("\n");

  return format === "named" ? `سورة ${bareSurahName(meta.name_ar)}\n\n${body}` : body;
}

export function canonicalSurahUrl(origin: string, meta: SurahMeta): string {
  return `${origin}/page/${meta.first_page}?surah=${meta.id}`;
}

export function verseSurahNumber(verseKey: string | null | undefined): number | null {
  const match = verseKey ? /^(\d+):(\d+)$/.exec(verseKey) : null;
  return match ? Number(match[1]) : null;
}

export function verseAyahNumber(verseKey: string | null | undefined): number | null {
  const match = verseKey ? /^(\d+):(\d+)$/.exec(verseKey) : null;
  return match ? Number(match[2]) : null;
}

