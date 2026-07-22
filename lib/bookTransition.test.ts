import { describe, expect, it } from "vitest";
import {
  BOOK_TRANSITION,
  getBookRenderPolicy,
  INITIAL_BOOK_VISUAL_STATE,
  reduceBookVisualState,
  type BookVisualEvent,
  type BookVisualState,
} from "./bookTransition";

function send(state: BookVisualState, ...events: BookVisualEvent[]) {
  return events.reduce(reduceBookVisualState, state);
}

describe("book visual state machine", () => {
  it("closes only after preparation and animation completion", () => {
    const state = send(
      INITIAL_BOOK_VISUAL_STATE,
      { type: "CLOSE_REQUESTED", side: "start" },
      { type: "CLOSE_PREPARED" },
      { type: "CLOSE_FINISHED" }
    );
    expect(state).toEqual({ phase: "closed", side: "start" });
  });

  it("opens only after the opening animation completes", () => {
    const closed: BookVisualState = { phase: "closed", side: "end" };
    const state = send(closed, { type: "OPEN_REQUESTED" }, { type: "OPEN_FINISHED" });
    expect(state).toEqual({ phase: "open" });
  });

  it("ignores duplicate close and open requests", () => {
    const preparing = reduceBookVisualState(INITIAL_BOOK_VISUAL_STATE, {
      type: "CLOSE_REQUESTED",
      side: "start",
    });
    expect(
      reduceBookVisualState(preparing, { type: "CLOSE_REQUESTED", side: "end" })
    ).toBe(preparing);

    const opening: BookVisualState = { phase: "opening", side: "start" };
    expect(reduceBookVisualState(opening, { type: "OPEN_REQUESTED" })).toBe(opening);
  });

  it("queues a boundary close until an active page turn settles", () => {
    const turning = send(INITIAL_BOOK_VISUAL_STATE, { type: "PAGE_TURN_STARTED" });
    const queued = reduceBookVisualState(turning, { type: "CLOSE_REQUESTED", side: "end" });
    expect(queued).toEqual({ phase: "turning-page", pendingClose: "end" });
    expect(reduceBookVisualState(queued, { type: "PAGE_TURN_FINISHED" })).toEqual({
      phase: "preparing-to-close",
      side: "end",
    });
  });

  it("cancels a page turn without executing its queued close", () => {
    const queued: BookVisualState = { phase: "turning-page", pendingClose: "start" };
    expect(reduceBookVisualState(queued, { type: "PAGE_TURN_CANCELLED" })).toEqual({
      phase: "open",
    });
  });

  it("keeps the reader mounted while the one transition layer persists", () => {
    for (const phase of ["preparing-to-close", "closing", "closed", "opening"] as const) {
      const policy = getBookRenderPolicy({ phase, side: "start" });
      expect(policy.keepReaderMounted).toBe(true);
      expect(policy.overlayMounted).toBe(true);
      expect(policy.readerSemanticallyHidden).toBe(true);
    }
    expect(getBookRenderPolicy(INITIAL_BOOK_VISUAL_STATE).overlayMounted).toBe(false);
  });
});

describe("book timeline contract", () => {
  it("makes the cover heavier than the pages and overlaps centering with contact", () => {
    expect(BOOK_TRANSITION.closeCoverDuration).toBeGreaterThan(
      BOOK_TRANSITION.closePagesDuration
    );
    expect(BOOK_TRANSITION.centerDelay).toBeLessThan(
      BOOK_TRANSITION.closeCoverDelay + BOOK_TRANSITION.closeCoverDuration
    );
    expect(BOOK_TRANSITION.settleDelay + BOOK_TRANSITION.settleDuration).toBe(
      BOOK_TRANSITION.closeTotal
    );
  });

  it("uses the same terminal state for normal and reduced-motion flows", () => {
    const closing: BookVisualState = { phase: "closing", side: "start" };
    expect(reduceBookVisualState(closing, { type: "CLOSE_FINISHED" })).toEqual({
      phase: "closed",
      side: "start",
    });
    expect(BOOK_TRANSITION.reducedDuration).toBeGreaterThanOrEqual(120);
    expect(BOOK_TRANSITION.reducedDuration).toBeLessThanOrEqual(160);
  });
});
