"use client";

import { useEffect } from "react";
import { PAGE_COUNT } from "@/lib/mushaf/source";
import { preloadPageImages } from "@/lib/mushaf/pageImageLoader";

/**
 * Warms the browser cache with the adjacent spreads (±1 spread around the
 * current one) so flips — including drags — reveal already-loaded images.
 */
export function usePagePreload(spreadStart: number): void {
  useEffect(() => {
    preloadPageImages(
      [spreadStart - 2, spreadStart - 1, spreadStart + 2, spreadStart + 3].filter(
        (page) => page >= 1 && page <= PAGE_COUNT
      )
    );
  }, [spreadStart]);
}
