import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AyahContextMenu from "@/components/reader/AyahContextMenu";
import type { AyahOverlayRecord } from "@/lib/mushaf/ayahRegions";

const record: AyahOverlayRecord = {
  verseKey: "1:1",
  surahNumber: 1,
  ayahNumber: 1,
  pageNumber: 1,
  text: "بسم الله",
  regions: [{ x: 1, y: 1, width: 1, height: 1 }],
};

describe("AyahContextMenu", () => {
  it("offers every action in logical order and closes on Escape", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <AyahContextMenu
        record={record}
        anchor={{ left: -50, top: -50, right: 1, bottom: 1, width: 1, height: 1 }}
        layoutKey="1-false"
        bookmarked={false}
        onAction={onAction}
        onClose={onClose}
      />
    );
    expect(screen.getAllByRole("menuitem")).toHaveLength(7);
    await user.click(screen.getByRole("menuitem", { name: "تكرار ٣ مرات" }));
    expect(onAction).toHaveBeenCalledWith("repeat");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("closes on outside pointer interaction", () => {
    const onClose = vi.fn();
    render(
      <AyahContextMenu
        record={record}
        anchor={{ left: 10, top: 10, right: 20, bottom: 20, width: 10, height: 10 }}
        layoutKey="1-false"
        bookmarked
        onAction={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledWith(true);
    expect(screen.getByRole("menuitem", { name: "إزالة العلامة" })).toBeInTheDocument();
  });
});
