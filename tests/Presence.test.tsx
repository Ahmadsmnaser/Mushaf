import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Presence from "@/components/motion/Presence";

function Surface({ open }: { open: boolean }) {
  return (
    <Presence present={open} duration={280}>
      {({ phase }) => <div data-testid="surface" data-phase={phase} />}
    </Presence>
  );
}

describe("Presence", () => {
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

  it("mounts for entrance, remains through exit, then unmounts", () => {
    const view = render(<Surface open={false} />);
    expect(screen.queryByTestId("surface")).not.toBeInTheDocument();

    view.rerender(<Surface open />);
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByTestId("surface")).toHaveAttribute("data-phase", "entering");

    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByTestId("surface")).toHaveAttribute("data-phase", "visible");

    view.rerender(<Surface open={false} />);
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByTestId("surface")).toHaveAttribute("data-phase", "exiting");

    act(() => vi.advanceTimersByTime(279));
    expect(screen.getByTestId("surface")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("surface")).not.toBeInTheDocument();
  });

  it("cancels a stale exit when rapidly reopened", () => {
    const view = render(<Surface open />);
    view.rerender(<Surface open={false} />);
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByTestId("surface")).toHaveAttribute("data-phase", "exiting");

    view.rerender(<Surface open />);
    act(() => vi.advanceTimersByTime(32));
    expect(screen.getByTestId("surface")).toHaveAttribute("data-phase", "visible");

    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId("surface")).toBeInTheDocument();
  });

  it("uses a short fade-only lifecycle for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const view = render(<Surface open={false} />);
    view.rerender(<Surface open />);
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByTestId("surface")).toHaveAttribute("data-phase", "visible");

    view.rerender(<Surface open={false} />);
    act(() => vi.advanceTimersByTime(16));
    act(() => vi.advanceTimersByTime(119));
    expect(screen.getByTestId("surface")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("surface")).not.toBeInTheDocument();
  });
});
