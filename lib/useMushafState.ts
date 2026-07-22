"use client";

import { useCallback, useReducer, useRef } from "react";
import {
  getBookRenderPolicy,
  INITIAL_BOOK_VISUAL_STATE,
  reduceBookVisualState,
  type BookVisualEvent,
  type BookVisualState,
  type MushafSide,
} from "@/lib/bookTransition";

/** Discrete book state; animation progress remains outside React. */
export function useMushafState() {
  const [state, reactDispatch] = useReducer(reduceBookVisualState, INITIAL_BOOK_VISUAL_STATE);
  const stateRef = useRef<BookVisualState>(state);

  const send = useCallback((event: BookVisualEvent) => {
    const next = reduceBookVisualState(stateRef.current, event);
    if (next === stateRef.current) return false;
    stateRef.current = next;
    reactDispatch(event);
    return true;
  }, []);

  const close = useCallback(
    (side: MushafSide) => send({ type: "CLOSE_REQUESTED", side }),
    [send]
  );
  const open = useCallback(() => send({ type: "OPEN_REQUESTED" }), [send]);
  const pageTurnStarted = useCallback(() => send({ type: "PAGE_TURN_STARTED" }), [send]);
  const pageTurnFinished = useCallback(() => send({ type: "PAGE_TURN_FINISHED" }), [send]);
  const pageTurnCancelled = useCallback(() => send({ type: "PAGE_TURN_CANCELLED" }), [send]);
  const closePrepared = useCallback(() => send({ type: "CLOSE_PREPARED" }), [send]);
  const closeFinished = useCallback(() => send({ type: "CLOSE_FINISHED" }), [send]);
  const openFinished = useCallback(() => send({ type: "OPEN_FINISHED" }), [send]);

  const policy = getBookRenderPolicy(state);
  const side = "side" in state ? state.side : null;

  return {
    state,
    phase: state.phase,
    side,
    isOpen: state.phase === "open" || state.phase === "turning-page",
    isInteractive: policy.readerInteractive,
    isSettledClosed: state.phase === "closed",
    overlayMounted: policy.overlayMounted,
    readerSemanticallyHidden: policy.readerSemanticallyHidden,
    close,
    open,
    pageTurnStarted,
    pageTurnFinished,
    pageTurnCancelled,
    closePrepared,
    closeFinished,
    openFinished,
  };
}
