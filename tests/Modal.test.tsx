import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Modal from "@/components/chrome/Modal";

function View({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button type="button">trigger</button>
      <Modal open={open} onClose={onClose} title="Test dialog">
        <input data-autofocus aria-label="field" />
      </Modal>
    </>
  );
}

describe("Modal presence and focus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 16)
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id: number) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps backdrop and card through exit, then restores focus", () => {
    const onClose = vi.fn();
    const view = render(<View open={false} onClose={onClose} />);
    const trigger = screen.getByRole("button", { name: "trigger" });
    trigger.focus();

    view.rerender(<View open onClose={onClose} />);
    act(() => vi.advanceTimersByTime(16));
    act(() => vi.advanceTimersByTime(16));
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    expect(screen.getByRole("textbox", { name: "field" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<View open={false} onClose={onClose} />);
    act(() => vi.advanceTimersByTime(16));
    expect(dialog).toHaveAttribute("aria-hidden", "true");
    expect(dialog).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(239));
    expect(dialog).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });
});
