import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import BottomPageScrubber from "@/components/reader/page-scrubber/BottomPageScrubber";

function Host({
  onCommit,
  disabled = false,
}: {
  onCommit: (page: number) => void;
  disabled?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={viewportRef} data-testid="viewport" style={{ height: 800 }} />
      <BottomPageScrubber
        currentPage={50}
        pageCount={604}
        disabled={disabled}
        onCommit={onCommit}
        isPageBookmarked={() => false}
        lastReadPage={null}
        viewportRef={viewportRef}
      />
    </div>
  );
}

function useCoarsePointer(coarse: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: coarse && query.includes("hover"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("BottomPageScrubber", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16)
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id: number) =>
      window.clearTimeout(id)
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is hidden during normal reading on a hover-capable pointer", () => {
    useCoarsePointer(false);
    render(<Host onCommit={vi.fn()} />);
    act(() => vi.advanceTimersByTime(20));
    expect(screen.queryByRole("group", { name: "مستعرض الصفحات السريع" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("offers a labelled touch trigger and opens an accessible slider surface", () => {
    useCoarsePointer(true);
    render(<Host onCommit={vi.fn()} />);
    act(() => vi.advanceTimersByTime(20));

    const trigger = screen.getByRole("button", { name: /الانتقال السريع/ });
    expect(trigger).toBeInTheDocument();

    act(() => trigger.click());
    act(() => vi.advanceTimersByTime(40));

    const slider = screen.getByRole("slider", {
      name: "الانتقال السريع بين صفحات المصحف",
    });
    expect(slider).toHaveAttribute("aria-valuemin", "1");
    expect(slider).toHaveAttribute("aria-valuemax", "604");
    expect(slider).toHaveAttribute("aria-valuenow", "50");
    expect(slider.getAttribute("aria-valuetext")).toContain("صفحة");
  });
});
