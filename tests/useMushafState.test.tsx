import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMushafState } from "@/lib/useMushafState";

describe("useMushafState", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps explicit closing and opening overlap phases before settling", () => {
    const { result } = renderHook(() => useMushafState());
    expect(result.current.phase).toBe("open");

    act(() => result.current.close("start"));
    expect(result.current.phase).toBe("closing-to-start");
    expect(result.current.isSettledClosed).toBe(false);

    act(() => vi.advanceTimersByTime(940));
    expect(result.current.phase).toBe("closed-from-start");

    act(() => result.current.open());
    expect(result.current.phase).toBe("opening-from-start");
    expect(result.current.isSettledClosed).toBe(false);

    act(() => vi.advanceTimersByTime(940));
    expect(result.current.phase).toBe("open");
  });

  it("ignores duplicate commands while a transition is active", () => {
    const { result } = renderHook(() => useMushafState());
    act(() => {
      result.current.close("end");
      result.current.close("start");
    });
    expect(result.current.phase).toBe("closing-to-end");

    act(() => result.current.open());
    expect(result.current.phase).toBe("closing-to-end");
  });
});
