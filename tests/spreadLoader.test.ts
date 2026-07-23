import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPageImageUrl } from "@/lib/mushaf/source";
import {
  decodePage,
  isPageDecoded,
  isSpreadDecoded,
  loadSpread,
  preloadSpread,
  __resetSpreadLoader,
} from "@/lib/mushaf/spreadLoader";

// jsdom has no real image decoding, so drive it with a controllable fake:
// every `new Image()` records its src and hands back a decode() promise we
// resolve or reject per URL from the test.
type Deferred = { resolve: () => void; reject: (e: unknown) => void };
const controls = new Map<string, Deferred>();
let created: string[] = [];

class FakeImage {
  decoding = "";
  private _src = "";
  set src(value: string) {
    this._src = value;
    created.push(value);
  }
  get src() {
    return this._src;
  }
  decode(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      controls.set(this._src, { resolve, reject });
    });
  }
}

/** Resolve the pending decode for a page and let its microtasks settle. */
async function settleDecode(page: number) {
  controls.get(getPageImageUrl(page))?.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function failDecode(page: number) {
  controls.get(getPageImageUrl(page))?.reject(new Error("decode failed"));
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.stubGlobal("Image", FakeImage);
  controls.clear();
  created = [];
  __resetSpreadLoader();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decodePage", () => {
  it("resolves and marks the page decoded only once decode() settles", async () => {
    const p = decodePage(5);
    expect(isPageDecoded(5)).toBe(false); // not ready before decode resolves
    await settleDecode(5);
    await p;
    expect(isPageDecoded(5)).toBe(true);
  });

  it("dedupes concurrent requests for the same page into one image/decode", async () => {
    const a = decodePage(7);
    const b = decodePage(7);
    expect(created.filter((u) => u === getPageImageUrl(7))).toHaveLength(1);
    await settleDecode(7);
    await Promise.all([a, b]);
    expect(isPageDecoded(7)).toBe(true);
  });

  it("resolves invalid page numbers as a no-op without loading", async () => {
    await decodePage(0);
    await decodePage(9999);
    expect(created).toHaveLength(0);
    expect(isPageDecoded(0)).toBe(false);
  });

  it("does not cache a page whose decode rejects, so it can retry", async () => {
    const first = decodePage(9).catch(() => "failed");
    await failDecode(9);
    await expect(first).resolves.toBe("failed");
    expect(isPageDecoded(9)).toBe(false);
    // A later attempt creates a fresh image (not blocked by the failed one).
    const retry = decodePage(9);
    expect(created.filter((u) => u === getPageImageUrl(9))).toHaveLength(2);
    await settleDecode(9);
    await retry;
    expect(isPageDecoded(9)).toBe(true);
  });
});

describe("loadSpread / isSpreadDecoded", () => {
  it("resolves only after every page of the spread is decoded", async () => {
    let done = false;
    const p = loadSpread([11, 12]).then(() => {
      done = true;
    });
    await settleDecode(11);
    expect(done).toBe(false); // still waiting on the left page
    await settleDecode(12);
    await p;
    expect(done).toBe(true);
    expect(isSpreadDecoded([11, 12])).toBe(true);
  });

  it("rejects if any page of the spread fails to decode", async () => {
    const p = loadSpread([13, 14]);
    await settleDecode(13);
    await failDecode(14);
    await expect(p).rejects.toBeInstanceOf(Error);
    expect(isSpreadDecoded([13, 14])).toBe(false);
  });

  it("treats invalid page numbers in a spread as already satisfied", () => {
    // Single-page spreads / bounds pass e.g. [PAGE_COUNT] only; guards never
    // block navigation on a non-existent facing page.
    expect(isSpreadDecoded([0])).toBe(true);
  });
});

describe("bounded LRU cache", () => {
  it("evicts the least-recently-decoded pages past the cap", async () => {
    // MAX_DECODED is 16; decode 18 distinct pages in order.
    for (let page = 1; page <= 18; page++) {
      const p = decodePage(page);
      await settleDecode(page);
      await p;
    }
    // The two oldest fell out; the most recent stay.
    expect(isPageDecoded(1)).toBe(false);
    expect(isPageDecoded(2)).toBe(false);
    expect(isPageDecoded(3)).toBe(true);
    expect(isPageDecoded(18)).toBe(true);
  });
});

describe("preloadSpread", () => {
  it("warms pages without throwing on failure", async () => {
    preloadSpread([20, 21]);
    expect(created).toContain(getPageImageUrl(20));
    await failDecode(20); // swallowed — no unhandled rejection
    await settleDecode(21);
    expect(isPageDecoded(21)).toBe(true);
    expect(isPageDecoded(20)).toBe(false);
  });
});
