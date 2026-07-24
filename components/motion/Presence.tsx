"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

export type PresencePhase = "entering" | "visible" | "exiting";

/**
 * Small shared presence primitive. Closing starts the exit phase immediately
 * but keeps the subtree mounted until its transition window has completed.
 * Generation checks make a rapid reopen cancel an older pending unmount.
 */
export function usePresence(present: boolean, duration: number) {
  const [mounted, setMounted] = useState(present);
  const [phase, setPhase] = useState<PresencePhase>(
    present ? "visible" : "exiting"
  );
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    let firstFrame = 0;
    let secondFrame = 0;
    let exitTimer: number | null = null;

    if (present) {
      firstFrame = window.requestAnimationFrame(() => {
        if (generation !== generationRef.current) return;
        setMounted(true);
        if (prefersReducedMotion()) {
          setPhase("visible");
          return;
        }
        setPhase("entering");
        secondFrame = window.requestAnimationFrame(() => {
          if (generation === generationRef.current) setPhase("visible");
        });
      });
    } else {
      firstFrame = window.requestAnimationFrame(() => {
        if (generation !== generationRef.current) return;
        setPhase("exiting");
        const exitDuration = prefersReducedMotion() ? 120 : duration;
        exitTimer = window.setTimeout(() => {
          if (generation === generationRef.current) setMounted(false);
        }, exitDuration);
      });
    }

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      if (exitTimer !== null) window.clearTimeout(exitTimer);
    };
  }, [duration, present]);

  return {
    mounted,
    phase,
    visible: present && phase !== "exiting",
  } as const;
}

export default function Presence({
  present,
  duration,
  children,
}: {
  present: boolean;
  duration: number;
  children: (state: ReturnType<typeof usePresence>) => React.ReactNode;
}) {
  const state = usePresence(present, duration);
  return state.mounted ? children(state) : null;
}
