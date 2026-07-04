"use client";

import { useEffect, useState } from "react";

/**
 * True after `delay` ms without pointer/keyboard/touch activity. Any activity
 * (including hovering near the bottom of the screen) wakes it again.
 */
export function useAutoHideToolbar(delay = 3000): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), delay);
    };
    reset();
    const events = ["mousemove", "keydown", "pointerdown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [delay]);

  return idle;
}
