import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSpreadPageNumbers,
  isPageImageReady,
  loadPageImages,
  loadSpreadImages,
  resetPageImageCache,
} from "@/lib/mushaf/pageImageLoader";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class MockImage {
  static instances: MockImage[] = [];
  decoding = "";
  complete = false;
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  decoded = deferred();

  constructor() {
    MockImage.instances.push(this);
  }

  decode() {
    return this.decoded.promise;
  }

  fireLoad() {
    this.complete = true;
    this.naturalWidth = 622;
    this.onload?.();
  }

  fireError() {
    this.onerror?.();
  }
}

describe("page image loader", () => {
  beforeEach(() => {
    resetPageImageCache();
    MockImage.instances = [];
    vi.stubGlobal("Image", MockImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetPageImageCache();
  });

  it("waits for every image to load and decode before an atomic spread resolves", async () => {
    let ready = false;
    const loading = loadSpreadImages(11, false).then(() => {
      ready = true;
    });
    expect(MockImage.instances).toHaveLength(2);

    MockImage.instances[0].fireLoad();
    MockImage.instances[1].fireLoad();
    MockImage.instances[0].decoded.resolve();
    await Promise.resolve();
    expect(ready).toBe(false);

    MockImage.instances[1].decoded.resolve();
    await loading;
    expect(ready).toBe(true);
    expect(isPageImageReady(11)).toBe(true);
    expect(isPageImageReady(12)).toBe(true);
  });

  it("deduplicates concurrent requests and rejects only the aborted waiter", async () => {
    const controller = new AbortController();
    const stale = loadPageImages([20], controller.signal);
    const current = loadPageImages([20]);
    expect(MockImage.instances).toHaveLength(1);

    controller.abort();
    await expect(stale).rejects.toMatchObject({ name: "AbortError" });
    MockImage.instances[0].fireLoad();
    MockImage.instances[0].decoded.resolve();
    await expect(current).resolves.toBeUndefined();
    expect(isPageImageReady(20)).toBe(true);
  });

  it("does not mark a failed target ready and permits a controlled retry", async () => {
    const failed = loadPageImages([30]);
    MockImage.instances[0].fireError();
    await expect(failed).rejects.toThrow("Unable to load Mushaf page image");
    expect(isPageImageReady(30)).toBe(false);

    const retry = loadPageImages([30]);
    expect(MockImage.instances).toHaveLength(2);
    MockImage.instances[1].fireLoad();
    MockImage.instances[1].decoded.resolve();
    await expect(retry).resolves.toBeUndefined();
  });

  it("respects first/last boundaries and single-page mode", () => {
    expect(getSpreadPageNumbers(1, false)).toEqual([1, 2]);
    expect(getSpreadPageNumbers(604, false)).toEqual([603, 604]);
    expect(getSpreadPageNumbers(604, true)).toEqual([604]);
  });
});
