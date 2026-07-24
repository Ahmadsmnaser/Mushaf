import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurahGuideData } from "@/lib/surahGuide/types";

const { fetchSurahGuideMock } = vi.hoisted(() => ({
  fetchSurahGuideMock: vi.fn(),
}));

vi.mock("@/lib/surahGuide/service", () => ({
  fetchSurahGuide: fetchSurahGuideMock,
  SurahGuideError: class SurahGuideError extends Error {},
}));

import { useSurahGuide } from "@/lib/surahGuide/useSurahGuide";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function guide(surahNumber: number): SurahGuideData {
  return { surahNumber, sections: [] };
}

describe("useSurahGuide", () => {
  beforeEach(() => {
    fetchSurahGuideMock.mockReset();
  });

  it("ignores a stale response after the user switches Surahs", async () => {
    const first = deferred<SurahGuideData>();
    const second = deferred<SurahGuideData>();
    fetchSurahGuideMock.mockImplementation((surahNumber: number) =>
      surahNumber === 85 ? first.promise : second.promise
    );
    const { result, rerender } = renderHook(
      ({ surahNumber }) => useSurahGuide(surahNumber, true),
      { initialProps: { surahNumber: 85 } }
    );
    rerender({ surahNumber: 86 });

    await act(async () => second.resolve(guide(86)));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    if (result.current.state.status === "success") {
      expect(result.current.state.data.surahNumber).toBe(86);
    }

    await act(async () => first.resolve(guide(85)));
    if (result.current.state.status === "success") {
      expect(result.current.state.data.surahNumber).toBe(86);
    }
  });
});
