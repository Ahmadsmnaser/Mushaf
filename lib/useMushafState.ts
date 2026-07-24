"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MOTION, prefersReducedMotion } from "@/lib/motion";

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

// Timer lengths cover the CSS choreography (globals.css): closing = 480ms
// book settle + 540ms shadow landing over a 240ms canvas fade-in; opening =
// 320ms book lift, then a 280ms canvas fade delayed 200ms (ends 480ms)
// while the spread eases back behind it.
const CLOSING_MS = MOTION.duration.mushaf + 40;
const OPENING_MS = MOTION.duration.mushaf + 40;

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
        const next = `closed-from-${side}` as const;
        phaseRef.current = next;
        setPhase(next);
        return;
      }
      const next = `closing-to-${side}` as const;
      phaseRef.current = next;
      setPhase(next);
      timer.current = window.setTimeout(
        () => {
          const settled = `closed-from-${side}` as const;
          phaseRef.current = settled;
          timer.current = null;
          setPhase(settled);
        },
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
      phaseRef.current = "open";
      setPhase("open");
      return;
    }
    const next = `opening-from-${side}` as const;
    phaseRef.current = next;
    setPhase(next);
    timer.current = window.setTimeout(() => {
      phaseRef.current = "open";
      timer.current = null;
      setPhase("open");
    }, OPENING_MS);
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
