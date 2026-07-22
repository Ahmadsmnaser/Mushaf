export type MushafSide = "start" | "end";

export type BookVisualState =
  | { phase: "open" }
  | { phase: "turning-page"; pendingClose: MushafSide | null }
  | { phase: "preparing-to-close"; side: MushafSide }
  | { phase: "closing"; side: MushafSide }
  | { phase: "closed"; side: MushafSide }
  | { phase: "opening"; side: MushafSide };

export type BookVisualEvent =
  | { type: "PAGE_TURN_STARTED" }
  | { type: "PAGE_TURN_FINISHED" }
  | { type: "PAGE_TURN_CANCELLED" }
  | { type: "CLOSE_REQUESTED"; side: MushafSide }
  | { type: "CLOSE_PREPARED" }
  | { type: "CLOSE_FINISHED" }
  | { type: "OPEN_REQUESTED" }
  | { type: "OPEN_FINISHED" };

export const INITIAL_BOOK_VISUAL_STATE: BookVisualState = { phase: "open" };

/** Pure transition function. Invalid and duplicate events are deliberately ignored. */
export function reduceBookVisualState(
  state: BookVisualState,
  event: BookVisualEvent
): BookVisualState {
  switch (event.type) {
    case "PAGE_TURN_STARTED":
      return state.phase === "open"
        ? { phase: "turning-page", pendingClose: null }
        : state;
    case "PAGE_TURN_FINISHED":
      if (state.phase !== "turning-page") return state;
      return state.pendingClose
        ? { phase: "preparing-to-close", side: state.pendingClose }
        : INITIAL_BOOK_VISUAL_STATE;
    case "PAGE_TURN_CANCELLED":
      return state.phase === "turning-page" ? INITIAL_BOOK_VISUAL_STATE : state;
    case "CLOSE_REQUESTED":
      if (state.phase === "open") {
        return { phase: "preparing-to-close", side: event.side };
      }
      if (state.phase === "turning-page" && state.pendingClose === null) {
        return { ...state, pendingClose: event.side };
      }
      return state;
    case "CLOSE_PREPARED":
      return state.phase === "preparing-to-close"
        ? { phase: "closing", side: state.side }
        : state;
    case "CLOSE_FINISHED":
      return state.phase === "closing" ? { phase: "closed", side: state.side } : state;
    case "OPEN_REQUESTED":
      return state.phase === "closed" ? { phase: "opening", side: state.side } : state;
    case "OPEN_FINISHED":
      return state.phase === "opening" ? INITIAL_BOOK_VISUAL_STATE : state;
  }
}

export const BOOK_TRANSITION = {
  handoffDuration: 80,
  closePagesDuration: 520,
  closeCoverDelay: 140,
  closeCoverDuration: 720,
  centerDelay: 590,
  centerDuration: 760,
  settleDelay: 1290,
  settleDuration: 180,
  closeTotal: 1470,
  openRootDuration: 760,
  openCoverDelay: 100,
  openCoverDuration: 720,
  openPagesDelay: 300,
  openPagesDuration: 520,
  openHandoffDelay: 780,
  openHandoffDuration: 100,
  openTotal: 880,
  reducedDuration: 140,
  paperEase: "cubic-bezier(0.32, 0.02, 0.2, 1)",
  coverEase: "cubic-bezier(0.22, 0.02, 0.18, 1)",
  rootEase: "cubic-bezier(0.2, 0.55, 0.25, 1)",
  settleEase: "cubic-bezier(0.2, 0.6, 0.2, 1)",
} as const;

export function getBookRenderPolicy(state: BookVisualState) {
  const overlayMounted =
    state.phase === "preparing-to-close" ||
    state.phase === "closing" ||
    state.phase === "closed" ||
    state.phase === "opening";
  return {
    overlayMounted,
    keepReaderMounted: true,
    readerInteractive: state.phase === "open",
    readerSemanticallyHidden: overlayMounted,
  };
}
