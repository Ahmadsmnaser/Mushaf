import { describe, expect, it } from "vitest";
import { reconstructKsuAyahRegions, type ExpectedAyah } from "@/lib/mushaf/ayahRegions";

const ayah = (verseKey: `${number}:${number}`): ExpectedAyah => {
  const [surahNumber, ayahNumber] = verseKey.split(":").map(Number);
  return { verseKey, surahNumber, ayahNumber, text: verseKey };
};

describe("KSU Ayah coordinate reconstruction", () => {
  it("reconstructs same-line, two-line, and long multi-line Ayahs", () => {
    const result = reconstructKsuAyahRegions(50, [ayah("2:1"), ayah("2:2"), ayah("2:3")], {
      50: { "2_1": [310, 52], "2_2": [210, 82], "2_3": [110, 142] },
    });
    expect(result.map((record) => record.regions.length)).toEqual([1, 2, 3]);
    expect(result[0].regions[0].x).toBeCloseTo(300 * (622 / 456));
    expect(result[0].regions[0].height).toBeCloseTo(30 * (917 / 672));
  });

  it("uses the 20px opening-page metadata on pages 1 and 2", () => {
    const [record] = reconstructKsuAyahRegions(1, [ayah("1:1")], {
      1: { "1_1": [181, 301] },
    });
    expect(record.regions).toHaveLength(2);
    expect(record.regions[0].height).toBeCloseTo(20 * (917 / 672));
    expect(record.regions[0].x).toBeCloseTo(80 * (622 / 456));
  });

  it("applies KSU's 110px Surah-opening separator rule", () => {
    const result = reconstructKsuAyahRegions(48, [ayah("2:286"), ayah("3:1")], {
      48: { "2_286": [310, 52], "3_1": [210, 162] },
    });
    expect(result[1].regions).toHaveLength(1);
    expect(result[1].regions[0].y).toBeCloseTo(147 * (917 / 672));
  });

  it("rejects invalid pages, keys, duplicates, mismatches, and bad geometry", () => {
    expect(() => reconstructKsuAyahRegions(0, [ayah("1:1")], {})).toThrow(/page/i);
    expect(() =>
      reconstructKsuAyahRegions(50, [ayah("2:1"), ayah("2:1")], {
        50: { "2_1": [310, 52], "2_2": [210, 82] },
      })
    ).toThrow(/duplicate/i);
    expect(() =>
      reconstructKsuAyahRegions(50, [ayah("2:1")], { 50: { "2_2": [310, 52] } })
    ).toThrow(/missing/i);
    expect(() =>
      reconstructKsuAyahRegions(50, [ayah("2:1")], { 50: { "2_1": [-20, 52] } })
    ).toThrow(/geometry/i);
  });
});
