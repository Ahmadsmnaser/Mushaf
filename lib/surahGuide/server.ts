import type {
  SurahGuideData,
  SurahGuideErrorCode,
  SurahGuideSection,
  SurahGuideSectionId,
  SurahGuideSource,
} from "./types";

const QURANPEDIA_API = "https://api.quranpedia.net/v1";
// Verified across all 114 responses on 2026-07-24. Al-Baqarah's sourced
// revelation-context field is the largest at 106,192 characters.
const MAX_SECTION_LENGTH = 120_000;

interface RawField {
  title?: unknown;
  value?: unknown;
}

interface RawSurahInformation {
  introduction?: RawField;
  surah_number?: RawField;
  asmaoha?: RawField;
  topics?: RawField;
  purposes?: RawField;
  grace?: RawField;
  prophet?: RawField;
  revelation?: RawField;
}

export class SurahGuideProviderError extends Error {
  constructor(
    public code: SurahGuideErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SurahGuideProviderError";
  }
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,
    (entity, key: string) => {
      if (key.startsWith("#")) {
        const hexadecimal = key[1]?.toLowerCase() === "x";
        const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
        return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }
      return named[key.toLowerCase()] ?? entity;
    }
  );
}

/**
 * Quranpedia returns editorial HTML. The Guide deliberately renders plain
 * text, so all markup and executable/embedded content are removed server-side.
 */
export function htmlToPlainText(html: string): string {
  if (html.length > MAX_SECTION_LENGTH) {
    throw new SurahGuideProviderError("upstream_shape", "Surah section is unexpectedly large");
  }
  const withoutUnsafeBlocks = html.replace(
    /<(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  const withBreaks = withoutUnsafeBlocks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(?:p|div|section|article|h[1-6]|blockquote|ul|ol)\s*>/gi,
      "\n\n"
    )
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/li\s*>/gi, "\n");
  return decodeEntities(
    withBreaks
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]*>/g, "")
      // Quranpedia wraps some Quran spans in presentation-only braces.
      .replace(/[{}]/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sourceFor(surahNumber: number): SurahGuideSource {
  return {
    id: "quranpedia-surah-info-v1",
    name: "الموسوعة القرآنية (Quranpedia)",
    language: "ar",
    resourceUrl: `${QURANPEDIA_API}/surah/information/${surahNumber}`,
    indexUrl: "https://quranpedia.net/surah-info",
  };
}

function toSection(
  raw: RawField | undefined,
  id: SurahGuideSectionId,
  fallbackTitle: string,
  source: SurahGuideSource
): SurahGuideSection | null {
  if (!raw || typeof raw.value !== "string" || !raw.value.trim()) return null;
  const text = htmlToPlainText(raw.value);
  if (!text) return null;
  return {
    id,
    title:
      id === "revelation-context"
        ? "سياق النزول والروايات المرتبطة بآيات السورة"
        : typeof raw.title === "string" && raw.title.trim()
          ? raw.title.trim()
          : fallbackTitle,
    text,
    contentFormat: "plain-text",
    source,
  };
}

/** Validate and convert one documented Quranpedia response without rewriting it. */
export function normalizeQuranpediaSurahInfo(
  value: unknown,
  surahNumber: number
): SurahGuideData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SurahGuideProviderError("upstream_shape", "Invalid Quranpedia response");
  }
  const raw = value as RawSurahInformation;
  const returnedNumber = Number(raw.surah_number?.value);
  if (returnedNumber !== surahNumber) {
    throw new SurahGuideProviderError("upstream_shape", "Quranpedia returned another Surah");
  }
  const source = sourceFor(surahNumber);
  const candidates: Array<SurahGuideSection | null> = [
    toSection(raw.introduction, "overview", "نبذة عن السورة", source),
    toSection(raw.asmaoha, "names", "أسماء السورة", source),
    toSection(raw.topics, "themes", "موضوعات السورة", source),
    toSection(raw.purposes, "purposes", "مقاصد السورة", source),
    toSection(raw.grace, "virtues", "فضائل السورة", source),
    toSection(
      raw.prophet,
      "prophetic-guidance",
      "الهدي النبوي المرتبط بالسورة",
      source
    ),
    toSection(
      raw.revelation,
      "revelation-context",
      "سياق النزول والروايات المرتبطة بآيات السورة",
      source
    ),
  ];
  const sections = candidates.filter(
    (section): section is SurahGuideSection => section !== null
  );
  if (sections.length === 0) {
    throw new SurahGuideProviderError("upstream_shape", "No Arabic Surah sections returned");
  }
  return { surahNumber, sections };
}

export async function getSurahGuideData(surahNumber: number): Promise<SurahGuideData> {
  let response: Response;
  try {
    response = await fetch(
      `${QURANPEDIA_API}/surah/information/${surahNumber}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 604_800 },
        signal: AbortSignal.timeout(8_000),
      }
    );
  } catch {
    throw new SurahGuideProviderError("network", "Quranpedia request failed");
  }
  if (!response.ok) {
    throw new SurahGuideProviderError(
      "upstream_error",
      `Quranpedia returned HTTP ${response.status}`
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SurahGuideProviderError("upstream_shape", "Quranpedia returned invalid JSON");
  }
  return normalizeQuranpediaSurahInfo(body, surahNumber);
}
