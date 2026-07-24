import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import {
  usePageScrubber,
  type PageScrubberController,
} from "@/components/reader/page-scrubber/usePageScrubber";
import { PAGE_COUNT } from "@/lib/mushaf/pageScrubber";

const key = (k: string) =>
  ({ key: k, preventDefault: () => {}, stopPropagation: () => {} }) as unknown as React.KeyboardEvent;

let latest: PageScrubberController;

function Harness({
  onCommit,
  startPage = 50,
  disabled = false,
}: {
  onCommit: (page: number) => void;
  startPage?: number;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(startPage);
  const controller = usePageScrubber({
    currentPage: current,
    pageCount: PAGE_COUNT,
    disabled,
    // Simulate the reader committing: the real page changes only AFTER the
    // target spread loads/decodes — modelled here as a short async delay, so
    // the `committing` lock is observable just as it is in the reader.
    onCommit: (page) => {
      onCommit(page);
      window.setTimeout(() => setCurrent(page), 10);
    },
  });
  useEffect(() => {
    latest = controller;
  });
  return (
    <div>
      <span data-testid="preview">{controller.previewPage}</span>
      <span data-testid="current">{current}</span>
      <span data-testid="mounted">{String(controller.mounted)}</span>
      <span data-testid="visible">{String(controller.visible)}</span>
      <span data-testid="committing">{String(controller.committing)}</span>
    </div>
  );
}

function flush(ms = 40) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("usePageScrubber", () => {
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

  it("starts hidden and reveals with the preview at the current page", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    expect(latest.mounted).toBe(false);

    act(() => latest.reveal());
    flush();
    expect(latest.mounted).toBe(true);
    expect(latest.visible).toBe(true);
    expect(latest.previewPage).toBe(50);
  });

  it("drags change the preview only, never the reader page or onCommit", () => {
    const onCommit = vi.fn();
    const view = render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();

    act(() => latest.onRulerPointerDown(0));
    act(() => latest.onRulerPointerMove(52 * 5)); // +5 pages (rightward → next)
    expect(latest.previewPage).toBe(55);
    expect(onCommit).not.toHaveBeenCalled();
    expect(view.getByTestId("current").textContent).toBe("50");
  });

  it("commits exactly once on pointer up, to the previewed page", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    act(() => latest.onRulerPointerDown(0));
    act(() => latest.onRulerPointerMove(52 * 3));
    act(() => latest.onRulerPointerUp());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(53);
  });

  it("wheel changes the preview only; commit stays explicit", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    act(() => latest.onWheel(50, 0)); // wheel-down advances
    expect(latest.previewPage).toBe(51);
    expect(onCommit).not.toHaveBeenCalled();
    act(() => latest.commitPreview());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(51);
  });

  it("uses RTL keyboard semantics and commits on Enter", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    act(() => latest.onKeyDown(key("ArrowLeft"))); // left = next (higher)
    expect(latest.previewPage).toBe(51);
    act(() => latest.onKeyDown(key("ArrowRight"))); // right = previous
    expect(latest.previewPage).toBe(50);
    act(() => latest.onKeyDown(key("End")));
    expect(latest.previewPage).toBe(PAGE_COUNT);
    act(() => latest.onKeyDown(key("Home")));
    expect(latest.previewPage).toBe(1);
    act(() => latest.onKeyDown(key("Enter")));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("cancels on Escape without navigating and restores the preview", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    act(() => latest.onWheel(50, 0));
    expect(latest.previewPage).toBe(51);
    act(() => latest.onKeyDown(key("Escape")));
    flush(300);
    expect(onCommit).not.toHaveBeenCalled();
    expect(latest.visible).toBe(false);
    expect(latest.previewPage).toBe(50); // restored to the reader page
  });

  it("treats a same-page confirmation as a no-op cancel", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    act(() => latest.commitPreview()); // preview still equals current page
    flush(300);
    expect(onCommit).not.toHaveBeenCalled();
    expect(latest.committing).toBe(false);
  });

  it("locks against overlapping commits until the destination settles", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    act(() => latest.onWheel(50, 0)); // preview → 51
    act(() => latest.commitPreview());
    expect(latest.committing).toBe(true);
    // Further inputs are ignored while committing.
    act(() => latest.onWheel(50, 0));
    act(() => latest.commitPreview());
    act(() => latest.onKeyDown(key("ArrowLeft")));
    expect(onCommit).toHaveBeenCalledTimes(1);

    // The reader page reaching the target settles the commit and hides.
    flush(60);
    expect(latest.committing).toBe(false);
    expect(latest.visible).toBe(false);
  });

  it("hides after inactivity once the pointer leaves", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    expect(latest.visible).toBe(true);
    act(() => latest.scheduleHide());
    flush(1500); // past HIDE_DELAY
    expect(latest.visible).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("stays open while a drag is in progress even if a hide is scheduled", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    act(() => latest.reveal());
    flush();
    act(() => latest.onRulerPointerDown(0));
    act(() => latest.onRulerPointerMove(52));
    act(() => latest.scheduleHide());
    flush(1500);
    expect(latest.visible).toBe(true); // drag keeps it alive
    act(() => latest.onRulerPointerUp());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(51);
  });

  it("does not open while disabled", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} disabled />);
    act(() => latest.reveal());
    flush();
    expect(latest.mounted).toBe(false);
  });
});
