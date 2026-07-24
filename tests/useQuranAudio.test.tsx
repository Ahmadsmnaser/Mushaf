import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuranAudio } from "@/lib/audio/useQuranAudio";
import { fetchChapterAudio, resolveAyahAudioUrl } from "@/lib/audio/service";

vi.mock("@/lib/audio/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audio/service")>(
    "@/lib/audio/service"
  );
  return {
    ...actual,
    resolveAyahAudioUrl: vi.fn().mockResolvedValue("https://audio.test/1.mp3"),
    fetchChapterAudio: vi.fn().mockResolvedValue({
      surahNumber: 85,
      reciterId: "minshawi",
      audioUrl: "https://audio.test/085.mp3",
    }),
  };
});

class FakeAudio extends EventTarget {
  preload = "";
  currentSrc = "";
  private source = "";
  play = vi.fn(async () => {});
  pause = vi.fn();

  get src() {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    this.currentSrc = value;
  }

  removeAttribute(name: string) {
    if (name === "src") {
      this.source = "";
      this.currentSrc = "";
    }
  }
}

describe("useQuranAudio Surah playback", () => {
  let instances: FakeAudio[];

  beforeEach(() => {
    vi.clearAllMocks();
    instances = [];
    vi.stubGlobal(
      "Audio",
      class extends FakeAudio {
        constructor() {
          super();
          instances.push(this);
        }
      }
    );
  });

  it("plays, pauses, and resumes one gapless Surah in the shared element", async () => {
    const { result } = renderHook(() => useQuranAudio());
    act(() => result.current.toggleSurah(85));
    await waitFor(() => expect(fetchChapterAudio).toHaveBeenCalledWith("minshawi", 85));
    await waitFor(() => expect(result.current.isPlaying).toBe(true));
    expect(result.current.playbackMode).toBe("surah");
    expect(result.current.currentSurahNumber).toBe(85);
    expect(result.current.currentVerseKey).toBeNull();
    expect(instances).toHaveLength(1);

    act(() => result.current.toggleSurah(85));
    expect(instances[0].pause).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);

    act(() => result.current.toggleSurah(85));
    await waitFor(() => expect(result.current.isPlaying).toBe(true));
    expect(instances).toHaveLength(1);
  });
});

describe("useQuranAudio repetition", () => {
  let instances: FakeAudio[];

  beforeEach(() => {
    vi.clearAllMocks();
    instances = [];
    vi.stubGlobal(
      "Audio",
      class extends FakeAudio {
        constructor() {
          super();
          instances.push(this);
        }
      }
    );
  });

  it("plays the exact Ayah three times with one shared audio element", async () => {
    const { result } = renderHook(() => useQuranAudio());
    act(() => result.current.repeatAyah({ verseKey: "1:1", pageNumber: 1 }, 3));
    await waitFor(() => expect(resolveAyahAudioUrl).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(instances[0].play).toHaveBeenCalledTimes(1));

    act(() => instances[0].dispatchEvent(new Event("ended")));
    await waitFor(() => expect(resolveAyahAudioUrl).toHaveBeenCalledTimes(2));
    act(() => instances[0].dispatchEvent(new Event("ended")));
    await waitFor(() => expect(resolveAyahAudioUrl).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(instances[0].play).toHaveBeenCalledTimes(3));
    act(() => instances[0].dispatchEvent(new Event("ended")));

    await waitFor(() => expect(result.current.isPlaying).toBe(false));
    expect(instances).toHaveLength(1);
    expect(result.current.currentVerseKey).toBe("1:1");
    expect(result.current.playbackMode).toBe("repeat-ayah");
  });
});
