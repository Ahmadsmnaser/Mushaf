"use client";

import { useEffect } from "react";
import { getPageImageUrl, PAGE_COUNT } from "@/lib/mushaf/source";

/**
 * Warms the browser cache with the adjacent spreads (±1 spread around the
 * current one) so flips — including drags — reveal already-loaded images.
 */
export function usePagePreload(spreadStart: number): void {
  useEffect(() => {
    for (const p of [spreadStart - 2, spreadStart - 1, spreadStart + 2, spreadStart + 3]) {
      if (p >= 1 && p <= PAGE_COUNT) new Image().src = getPageImageUrl(p);
    }
  }, [spreadStart]);
}
