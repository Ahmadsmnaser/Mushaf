import { describe, expect, it } from "vitest";
import {
  getKsuPageLineModel,
  reconstructKsuAyahRegions,
  type ExpectedAyah,
  type VerseKey,
} from "@/lib/mushaf/ayahRegions";

const ayah = (verseKey: VerseKey): ExpectedAyah => {
  const [surahNumber, ayahNumber] = verseKey.split(":").map(Number);
  return { verseKey, surahNumber, ayahNumber, text: verseKey };
};

const scaledY = (sourceY: number) => sourceY * (917 / 672);

describe("KSU Ayah coordinate reconstruction", () => {
  it("emits separate line bands instead of a continuous multi-line block", () => {
    const result = reconstructKsuAyahRegions(
      50,
      [ayah("3:10"), ayah("3:11"), ayah("3:12")],
      {
        50: { "3_10": [310, 64], "3_11": [210, 64], "3_12": [110, 143] },
      }
    );
    expect(result.map((record) => record.regions.length)).toEqual([1, 1, 2]);
    expect(result[2].regions[0].y).toBeCloseTo(
      scaledY(getKsuPageLineModel(50).lineCenters[1] - 15)
    );
    expect(result[2].regions[1].y).toBeCloseTo(
      scaledY(getKsuPageLineModel(50).lineCenters[2] - 15)
    );
    expect(result[2].regions[0].y + result[2].regions[0].height).toBeLessThan(
      result[2].regions[1].y
    );
  });

  it("keeps every row of an Ayah carried over at a page boundary", () => {
    const [record] = reconstructKsuAyahRegions(3, [ayah("2:6")], {
      3: { "2_6": [335, 106] },
    });
    expect(record.regions).toHaveLength(2);
    expect(record.regions[0].width).toBeCloseTo(360 * (622 / 456));
    expect(record.regions[0].y + record.regions[0].height).toBeLessThan(
      record.regions[1].y
    );
  });

  it("keeps a genuine wrapped-Ayah tail only when page-ink metadata confirms it", () => {
    const expected = [ayah("3:10"), ayah("3:11")];
    const payload = { 50: { "3_10": [310, 64], "3_11": [210, 143] } };
    const withoutTail = reconstructKsuAyahRegions(50, expected, payload);
    const withTail = reconstructKsuAyahRegions(50, expected, payload, {
      continuationVerseKeys: new Set<VerseKey>(["3:11"]),
    });
    expect(withoutTail[1].regions).toHaveLength(2);
    expect(withTail[1].regions).toHaveLength(3);
    expect(withTail[1].regions[0].y).toBe(withTail[0].regions[0].y);
  });

  it("regresses page 582: basmala and first Ayah are two rows, never a top block", () => {
    const [record] = reconstructKsuAyahRegions(582, [ayah("78:1")], {
      582: { "78_1": [316, 141] },
    });
    const model = getKsuPageLineModel(582);
    expect(record.regions).toHaveLength(2);
    expect(record.regions.map((region) => region.y)).toEqual([
      scaledY(model.lineCenters[1] - model.lineHeight / 2),
      scaledY(model.lineCenters[2] - model.lineHeight / 2),
    ]);
    expect(record.regions.every((region) => region.height < 42)).toBe(true);
  });

  it("does not invent a pre-Ayah band on Al-Fatihah's opening page", () => {
    const [record] = reconstructKsuAyahRegions(1, [ayah("1:1")], {
      1: { "1_1": [181, 301] },
    });
    expect(record.regions).toHaveLength(1);
    expect(record.regions[0].height).toBeCloseTo(20 * (917 / 672));
    expect(record.regions[0].x).toBeCloseTo((181 - 8) * (622 / 456));
  });

  it("covers the basmala and every wrapped row of a multi-line first Ayah", () => {
    const model = getKsuPageLineModel(50);
    // Marker sits on Ayah 1's LAST (2nd) row; the row count fills the rest.
    const [record] = reconstructKsuAyahRegions(
      50,
      [ayah("50:1")],
      { 50: { "50_1": [310, Math.round(model.lineCenters[3])] } },
      { openingRowCounts: new Map<VerseKey, number>([["50:1", 2]]) }
    );
    // basmala row, the full wrapped first row, then the marker row — no gap.
    expect(record.regions).toHaveLength(3);
    expect(record.regions.map((region) => Math.round(region.y))).toEqual([
      Math.round(scaledY(model.lineCenters[1] - 15)),
      Math.round(scaledY(model.lineCenters[2] - 15)),
      Math.round(scaledY(model.lineCenters[3] - 15)),
    ]);
    expect(record.regions[0].width).toBeCloseTo(
      (model.basmalaRight - model.basmalaLeft) * (622 / 456)
    );
    expect(record.regions[1].width).toBeCloseTo(
      (model.textRight - model.textLeft) * (622 / 456)
    );
  });

  it("anchors a multi-line opening on its marker row regardless of the cartouche", () => {
    const model = getKsuPageLineModel(50);
    const result = reconstructKsuAyahRegions(
      50,
      [ayah("50:5"), ayah("51:1")],
      {
        50: {
          "50_5": [310, Math.round(model.lineCenters[4])],
          "51_1": [200, Math.round(model.lineCenters[8])],
        },
      },
      { openingRowCounts: new Map<VerseKey, number>([["51:1", 2]]) }
    );
    expect(result[1].regions.map((region) => Math.round(region.y))).toEqual([
      Math.round(scaledY(model.lineCenters[6] - 15)), // basmala
      Math.round(scaledY(model.lineCenters[7] - 15)), // wrapped first text row
      Math.round(scaledY(model.lineCenters[8] - 15)), // marker row
    ]);
  });

  it("defaults a single-row opening to basmala plus the marker row", () => {
    // Yunus-style: cartouche only in the running header, basmala on row 0.
    const [record] = reconstructKsuAyahRegions(208, [ayah("10:1")], {
      208: { "10_1": [172, 101] },
    });
    const model = getKsuPageLineModel(208);
    expect(record.regions).toHaveLength(2);
    expect(record.regions.map((region) => Math.round(region.y))).toEqual([
      Math.round(scaledY(model.lineCenters[0] - 15)), // basmala row 0
      Math.round(scaledY(model.lineCenters[1] - 15)), // marker row 1
    ]);
  });

  it("resets a mid-page Surah opening to basmala plus first-Ayah rows", () => {
    const result = reconstructKsuAyahRegions(
      583,
      [ayah("78:40"), ayah("79:1")],
      { 583: { "78_40": [62, 299], "79_1": [310, 419] } }
    );
    expect(result[1].regions).toHaveLength(2);
    expect(result[1].regions[0].y).toBeCloseTo(
      scaledY(getKsuPageLineModel(583).lineCenters[8] - 15)
    );
    expect(result[1].regions[1].y).toBeCloseTo(
      scaledY(getKsuPageLineModel(583).lineCenters[9] - 15)
    );
  });

  it("snaps marker jitter on one line to exactly the same vertical band", () => {
    const result = reconstructKsuAyahRegions(
      582,
      [ayah("78:1"), ayah("78:2"), ayah("78:3")],
      { 582: { "78_1": [316, 141], "78_2": [204, 142], "78_3": [59, 139] } }
    );
    const ayahLineY = result[0].regions.at(-1)!.y;
    expect(result[1].regions[0].y).toBe(ayahLineY);
    expect(result[2].regions[0].y).toBe(ayahLineY);
  });

  it("rejects invalid pages, keys, duplicates, mismatches, and off-grid geometry", () => {
    expect(() => reconstructKsuAyahRegions(0, [ayah("1:1")], {})).toThrow(/page/i);
    expect(() =>
      reconstructKsuAyahRegions(50, [ayah("3:10"), ayah("3:10")], {
        50: { "3_10": [310, 64], "3_11": [210, 64] },
      })
    ).toThrow(/duplicate/i);
    expect(() =>
      reconstructKsuAyahRegions(50, [ayah("3:10")], { 50: { "3_11": [310, 64] } })
    ).toThrow(/missing/i);
    expect(() =>
      reconstructKsuAyahRegions(50, [ayah("3:10")], { 50: { "3_10": [310, 80] } })
    ).toThrow(/line grid/i);
  });
});
