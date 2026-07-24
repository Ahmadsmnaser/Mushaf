import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AyahOverlay from "@/components/reader/AyahOverlay";
import { getPageAyahRegions } from "@/lib/mushaf/ayahRegions.client";
import type { AyahOverlayRecord, VerseKey } from "@/lib/mushaf/ayahRegions";

vi.mock("@/lib/mushaf/ayahRegions.client", () => ({ getPageAyahRegions: vi.fn() }));

const records: AyahOverlayRecord[] = [
  {
    verseKey: "1:1",
    surahNumber: 1,
    ayahNumber: 1,
    pageNumber: 1,
    text: "بسم الله",
    regions: [
      { x: 10, y: 10, width: 50, height: 20 },
      { x: 60, y: 40, width: 80, height: 20 },
    ],
  },
];

function setup(overrides: Partial<React.ComponentProps<typeof AyahOverlay>> = {}) {
  const props: React.ComponentProps<typeof AyahOverlay> = {
    page: 1,
    enabled: true,
    imageReady: true,
    hoveredVerseKey: null,
    focusedVerseKey: null,
    selectedVerseKey: null,
    onHover: vi.fn(),
    onFocus: vi.fn(),
    onActivate: vi.fn(),
    onRecords: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<AyahOverlay {...props} />) };
}

describe("AyahOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPageAyahRegions).mockResolvedValue(records);
  });

  it("does not load or render for a non-settled page", () => {
    setup({ enabled: false });
    expect(getPageAyahRegions).not.toHaveBeenCalled();
    expect(document.querySelector("svg")).not.toBeInTheDocument();
  });

  it("waits for image and verified data, then shares state across all regions", async () => {
    const { rerender, props } = setup({ imageReady: false });
    await waitFor(() => expect(props.onRecords).toHaveBeenCalledWith(1, records));
    expect(document.querySelector("svg")).not.toBeInTheDocument();
    rerender(<AyahOverlay {...props} imageReady hoveredVerseKey={"1:1" as VerseKey} />);
    // Each segment renders a visible inset band plus a full-height hit target.
    const fills = document.querySelectorAll(".ayah-region-fill");
    const hits = document.querySelectorAll(".ayah-region-hit");
    expect(fills).toHaveLength(2);
    expect(hits).toHaveLength(2);
    // Hit target is intrinsically transparent (never paints, even with no CSS).
    expect([...hits].every((h) => h.getAttribute("fill") === "transparent")).toBe(true);
    expect([...fills].every((f) => f.getAttribute("data-state") === "hovered")).toBe(true);
    // The hovered strip's fill is applied inline (not via a stylesheet), so it is
    // visible regardless of whether globals.css is fresh — guards the "no hover
    // strip" regression.
    expect(
      [...fills].every((f) => {
        const fill = (f as SVGElement).style.fill;
        return fill.includes("color-mix") && fill.includes("--accent");
      })
    ).toBe(true);
    expect([...fills].every((f) => f.getAttribute("rx") === "6")).toBe(true);
    expect([...fills].every((f) => f.getAttribute("ry") === "6")).toBe(true);
    // The visible band is shorter than, and vertically centred within, its hit target.
    fills.forEach((fill, index) => {
      const hit = hits[index];
      const fh = Number(fill.getAttribute("height"));
      const hh = Number(hit.getAttribute("height"));
      expect(fh).toBeLessThan(hh);
      const fillMid = Number(fill.getAttribute("y")) + fh / 2;
      const hitMid = Number(hit.getAttribute("y")) + hh / 2;
      expect(fillMid).toBeCloseTo(hitMid);
    });
    // The whole line pitch stays clickable via the full-height hit target.
    fireEvent.click(hits[1]);
    expect(props.onActivate).toHaveBeenCalledWith(records[0], expect.any(Object), null);
  });

  it("exposes one keyboard button per Ayah and activates the reading-order segment", async () => {
    const user = userEvent.setup();
    const { props } = setup();
    const button = await screen.findByRole("button", { name: /الآية 1/ });
    await user.tab();
    expect(button).toHaveFocus();
    expect(props.onFocus).toHaveBeenCalledWith("1:1");
    await user.keyboard("{Enter}");
    expect(props.onActivate).toHaveBeenCalledWith(records[0], expect.any(Object), button);
  });

  it("falls back silently when coordinate loading fails", async () => {
    vi.mocked(getPageAyahRegions).mockRejectedValueOnce(new Error("offline"));
    const { props } = setup();
    await waitFor(() => expect(props.onRecords).toHaveBeenCalledWith(1, []));
    expect(document.querySelector("svg")).not.toBeInTheDocument();
  });
});
