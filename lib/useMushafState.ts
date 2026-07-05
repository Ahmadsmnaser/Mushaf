"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MushafSide = "start" | "end";

/**
 * The mushaf's visual book state, separate from page navigation state.
 * Turning past either bound never changes the page — it closes the book;
 * opening returns to the exact spread it closed on.
 */
export type MushafPhase =
  | "open"
  | `closing-to-${MushafSide}`
  | `closed-from-${MushafSide}`
  | `opening-from-${MushafSide}`;

// Timer lengths cover the CSS choreography (globals.css): closing = 620ms
// door swing over a 260ms canvas fade-in; opening = 560ms swing, then a
// 300ms canvas fade delayed 480ms so the cover finishes before the reveal.
const CLOSING_MS = 700;
const OPENING_MS = 820;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Open/close state machine for the mushaf. Transitional phases are
 * timer-driven to match the CSS animations; `close` is only honoured from
 * `open`, `open` only from a settled closed state, so rapid inputs can't
 * wedge the machine mid-swing. Reduced motion settles instantly.
 */
export function useMushafState() {
  const [phase, setPhase] = useState<MushafPhase>("open");
  const phaseRef = useRef(phase);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const close = useCallback(
    (side: MushafSide) => {
      if (phaseRef.current !== "open") return;
      clearTimer();
      if (prefersReducedMotion()) {
        setPhase(`closed-from-${side}`);
        return;
      }
      setPhase(`closing-to-${side}`);
      timer.current = window.setTimeout(
        () => setPhase(`closed-from-${side}`),
        CLOSING_MS
      );
    },
    [clearTimer]
  );

  const open = useCallback(() => {
    const p = phaseRef.current;
    if (p !== "closed-from-start" && p !== "closed-from-end") return;
    const side: MushafSide = p === "closed-from-start" ? "start" : "end";
    clearTimer();
    if (prefersReducedMotion()) {
      setPhase("open");
      return;
    }
    setPhase(`opening-from-${side}`);
    timer.current = window.setTimeout(() => setPhase("open"), OPENING_MS);
  }, [clearTimer]);

  const side: MushafSide | null =
    phase === "open" ? null : phase.endsWith("start") ? "start" : "end";
  const cover: "closing" | "closed" | "opening" | null =
    phase === "open"
      ? null
      : phase.startsWith("closing")
        ? "closing"
        : phase.startsWith("closed")
          ? "closed"
          : "opening";

  return {
    phase,
    /** fully open and interactive */
    isOpen: phase === "open",
    /** settled shut: render ONLY the cover */
    isSettledClosed: cover === "closed",
    side,
    /** what the cover component should render, or null when fully open */
    cover,
    close,
    open,
  };
}
