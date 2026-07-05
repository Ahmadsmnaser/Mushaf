"use client";

import { useEffect, useState } from "react";

/**
 * True after `delay` ms without pointer/keyboard/touch activity. Any activity
 * (including focus moving into the controls) wakes it again.
 */
export function useAutoHideToolbar(delay = 5000): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), delay);
    };
    reset();
    const events = ["mousemove", "keydown", "pointerdown", "touchstart", "focusin"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [delay]);

  return idle;
}
