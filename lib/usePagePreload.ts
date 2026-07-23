"use client";

import { useEffect } from "react";
import { preloadSpread } from "@/lib/mushaf/spreadLoader";

/**
 * Warms the adjacent spreads (±1 spread around the current one) so flips —
 * including drags — reveal already-decoded images. Routing through the shared
 * spread loader (rather than a bare `new Image().src`) means the pages are
 * decoded, cached in the bounded LRU, and instantly reported ready by the
 * navigation gate, so the common case flips with zero delay.
 */
export function usePagePreload(spreadStart: number): void {
  useEffect(() => {
    // Previous spread (start-2, start-1) and next spread (start+2, start+3).
    preloadSpread([spreadStart - 2, spreadStart - 1, spreadStart + 2, spreadStart + 3]);
  }, [spreadStart]);
}
