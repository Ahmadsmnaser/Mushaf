import { describe, expect, it } from "vitest";
import { getPageMeta, getSurahMeta, type SurahAyah } from "@/lib/mushaf/source";
import { getReciter } from "@/lib/audio/reciters";
import { getChapterAudio } from "@/lib/audio/server";
import {
  bareSurahName,
  canonicalSurahUrl,
  formatSurahCopy,
  revelationPlaceLabel,
} from "@/lib/surah";

describe("Surah metadata and actions", () => {
  it("keeps every Surah on a shared page addressable", () => {
    expect(getPageMeta(590).surahNumbers).toEqual([84, 85]);
    expect(getPageMeta(604).surahNumbers).toEqual([112, 113, 114]);
  });

  it("exposes verified Al-Buruj metadata and a canonical start link", () => {
    const meta = getSurahMeta(85)!;
    expect(meta.name_ar).toContain("البُرُوجِ");
    expect(meta.ayah_count).toBe(22);
    expect(meta.revelation_order).toBe(27);
    expect(revelationPlaceLabel(meta.revelation_place)).toBe("مكية");
    expect(meta.first_page).toBe(590);
    expect(meta.last_page).toBe(590);
    expect(canonicalSurahUrl("https://example.test", meta)).toBe(
      "https://example.test/page/590?surah=85"
    );
  });

  it("formats every Ayah without truncation in all supported copy formats", () => {
    const meta = getSurahMeta(108)!;
    const ayahs: SurahAyah[] = [
      { verseKey: "108:1", surahNumber: 108, ayahNumber: 1, pageNumber: 602, text: "أ" },
      { verseKey: "108:2", surahNumber: 108, ayahNumber: 2, pageNumber: 602, text: "ب" },
      { verseKey: "108:3", surahNumber: 108, ayahNumber: 3, pageNumber: 602, text: "ج" },
    ];
    expect(formatSurahCopy(meta, ayahs, "text")).toBe("أ\nب\nج");
    expect(formatSurahCopy(meta, ayahs, "numbered")).toContain("﴿٣﴾");
    expect(formatSurahCopy(meta, ayahs, "named")).toContain(
      `سورة ${bareSurahName(meta.name_ar)}`
    );
    expect(() => formatSurahCopy(meta, ayahs.slice(0, 2), "text")).toThrow(
      "incomplete_surah"
    );
  });

  it("rejects unsupported Surah numbers safely", () => {
    expect(getSurahMeta(0)).toBeNull();
    expect(getSurahMeta(115)).toBeNull();
    expect(getSurahMeta(Number.NaN)).toBeNull();
  });

  it("resolves the verified gapless Minshawi chapter file without guessed timestamps", () => {
    const chapter = getChapterAudio(getReciter("minshawi"), 85);
    expect(chapter).toEqual({
      surahNumber: 85,
      reciterId: "minshawi",
      audioUrl:
        "https://download.quranicaudio.com/quran/muhammad_siddeeq_al-minshaawee/085.mp3",
    });
    expect(chapter.timestamps).toBeUndefined();
  });
});
