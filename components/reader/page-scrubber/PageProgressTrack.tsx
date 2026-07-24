"use client";

import {
  pageToTrackRatio,
  scrubberArabicNumber as arNum,
} from "@/lib/mushaf/pageScrubber";
import type { PageScrubberController } from "./usePageScrubber";

/**
 * A restrained full-Mushaf track for fast long jumps, laid out RTL like the
 * book itself: page 1 sits at the RIGHT edge, the last page at the LEFT — so
 * later pages run leftward, in step with the number ruler. Preview-only; the
 * commit fires on release. No page image loads while scrubbing the track.
 */
export default function PageProgressTrack({
  controller,
  pageCount,
  currentPage,
  lastReadPage,
}: {
  controller: PageScrubberController;
  pageCount: number;
  currentPage: number;
  lastReadPage: number | null;
}) {
  const { previewPage } = controller;
  const ratio = pageToTrackRatio(previewPage, pageCount); // 0 = page 1, 1 = last
  // RTL screen position: page 1 → right edge, last page → left edge.
  const leftPct = (page: number) => (1 - pageToTrackRatio(page, pageCount)) * 100;

  const ratioFromEvent = (e: React.PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return (rect.right - e.clientX) / rect.width; // RTL: 0 at the right (page 1)
  };

  const handleDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    controller.keepAlive();
    controller.onTrackScrub(ratioFromEvent(e, el));
  };

  const handleMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    controller.onTrackScrub(ratioFromEvent(e, e.currentTarget as HTMLElement));
  };

  const handleUp = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.releasePointerCapture?.(e.pointerId);
    controller.onTrackCommit(ratioFromEvent(e, el));
  };

  const marker = (page: number | null, className: string) => {
    if (page === null) return null;
    return (
      <span
        aria-hidden
        className={`page-scrubber-track-tick ${className}`}
        style={{ left: `${leftPct(page)}%` }}
      />
    );
  };

  return (
    <div dir="rtl" className="flex w-full items-center gap-2">
      {/* dir=rtl lays these out right-to-left: ١ on the right, ٦٠٤ on the left. */}
      <span className="w-6 text-center text-[9px] leading-none text-ink-soft" aria-hidden>
        {arNum(1)}
      </span>
      <div
        className="page-scrubber-track relative h-5 flex-1 cursor-pointer touch-none"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <span className="page-scrubber-track-rail pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2" />
        <span
          className="page-scrubber-track-fill pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ right: 0, width: `${ratio * 100}%` }}
        />
        {marker(currentPage, "tick-current")}
        {marker(lastReadPage, "tick-lastread")}
        <span
          className="page-scrubber-track-handle pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: `${leftPct(previewPage)}%` }}
        />
      </div>
      <span className="w-8 text-center text-[9px] leading-none text-ink-soft" aria-hidden>
        {arNum(pageCount)}
      </span>
    </div>
  );
}
