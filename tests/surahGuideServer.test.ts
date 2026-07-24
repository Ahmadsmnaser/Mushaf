import { describe, expect, it } from "vitest";
import {
  htmlToPlainText,
  normalizeQuranpediaSurahInfo,
  SurahGuideProviderError,
} from "@/lib/surahGuide/server";

describe("Quranpedia Surah information adapter", () => {
  it("removes executable and presentation HTML while preserving Arabic paragraphs", () => {
    const text = htmlToPlainText(
      '<p onclick="bad()">الفقرة الأولى &amp; الثانية</p>' +
        '<script>alert("bad")</script>' +
        '<p>{<span style="font: 16pt">نص قرآني</span>}<br>سطر تالٍ</p>'
    );
    expect(text).toBe(
      "الفقرة الأولى & الثانية\n\nنص قرآني\nسطر تالٍ"
    );
    expect(text).not.toMatch(/script|onclick|alert|[{}]/);
  });

  it("keeps only supplied sections, preserves source wording, and attributes every section", () => {
    const data = normalizeQuranpediaSurahInfo(
      {
        surah_number: { title: "ترتيبها المصحفي", value: "85" },
        introduction: {
          title: "نبذة عن السورة",
          value: "<p>نبذة موثقة.</p>",
        },
        topics: {
          title: "موضوعاتها",
          value: "<p>1. الموضوع الأول (١-٩).</p>",
        },
        revelation: { title: "أسباب النزول", value: null },
      },
      85
    );
    expect(data.sections.map((section) => section.id)).toEqual([
      "overview",
      "themes",
    ]);
    expect(data.sections[1].text).toBe("1. الموضوع الأول (١-٩).");
    expect(
      data.sections.every(
        (section) =>
          section.source.name === "الموسوعة القرآنية (Quranpedia)" &&
          section.contentFormat === "plain-text"
      )
    ).toBe(true);
  });

  it("rejects a mismatched or empty provider response", () => {
    expect(() =>
      normalizeQuranpediaSurahInfo(
        {
          surah_number: { value: "86" },
          introduction: { value: "<p>سورة أخرى</p>" },
        },
        85
      )
    ).toThrow(SurahGuideProviderError);
    expect(() =>
      normalizeQuranpediaSurahInfo(
        { surah_number: { value: "85" }, introduction: { value: null } },
        85
      )
    ).toThrow("No Arabic Surah sections returned");
  });
});
