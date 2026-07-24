export type SurahGuideSectionId =
  | "overview"
  | "names"
  | "themes"
  | "purposes"
  | "virtues"
  | "prophetic-guidance"
  | "revelation-context";

export interface SurahGuideSource {
  id: "quranpedia-surah-info-v1";
  name: "الموسوعة القرآنية (Quranpedia)";
  language: "ar";
  resourceUrl: string;
  indexUrl: "https://quranpedia.net/surah-info";
}

export interface SurahGuideSection {
  id: SurahGuideSectionId;
  title: string;
  /** Provider-authored Arabic converted conservatively from HTML to plain text. */
  text: string;
  contentFormat: "plain-text";
  source: SurahGuideSource;
}

export interface SurahGuideData {
  surahNumber: number;
  sections: SurahGuideSection[];
}

export type SurahGuideErrorCode =
  | "invalid_params"
  | "upstream_error"
  | "upstream_shape"
  | "network";

export interface SurahGuideApiError {
  error: {
    code: SurahGuideErrorCode;
    message: string;
  };
}
