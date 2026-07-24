"use client";

import { useRef } from "react";
import {
  rulerOffsetForPage,
  rulerWindow,
  scrubberArabicNumber as arNum,
} from "@/lib/mushaf/pageScrubber";
import type { PageScrubberController } from "./usePageScrubber";

const TAP_SLOP = 4; // px of movement below which a press counts as a tap

/**
 * The moving number ruler: a bounded window of page numbers slides under a
 * fixed centre marker. Later pages sit LEFT of centre (RTL advance), so
 * dragging the strip rightward brings them in. This element is the single
 * slider control — the decorative numbers are not tab stops.
 */
export default function PageNumberRuler({
  controller,
  pageCount,
  pxPerPage,
  radius,
  currentPage,
  lastReadPage,
  isBookmarked,
  valueText,
}: {
  controller: PageScrubberController;
  pageCount: number;
  pxPerPage: number;
  radius: number;
  currentPage: number;
  lastReadPage: number | null;
  isBookmarked: (page: number) => boolean;
  valueText: string;
}) {
  const { previewPage, committing } = controller;
  const gesture = useRef<{ startX: number; moved: boolean; tapPage: number | null } | null>(
    null
  );
  const pages = rulerWindow(previewPage, radius, pageCount);

  const handlePointerDown = (e: React.PointerEvent, tapPage: number | null) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    gesture.current = { startX: e.clientX, moved: false, tapPage };
    controller.keepAlive();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.moved) {
      if (Math.abs(e.clientX - g.startX) <= TAP_SLOP) return;
      g.moved = true;
      controller.onRulerPointerDown(g.startX);
    }
    controller.onRulerPointerMove(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!g) return;
    if (g.moved) {
      controller.onRulerPointerUp();
    } else if (g.tapPage !== null) {
      // Tap on a visible number: make it the destination and commit it.
      controller.setPreviewPage(g.tapPage, "pointer");
      controller.commitPreview();
    } else {
      controller.commitPreview();
    }
  };

  const handlePointerCancel = () => {
    if (gesture.current?.moved) controller.onRulerPointerCancel();
    gesture.current = null;
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="الانتقال السريع بين صفحات المصحف"
      aria-orientation="horizontal"
      aria-valuemin={1}
      aria-valuemax={pageCount}
      aria-valuenow={previewPage}
      aria-valuetext={valueText}
      dir="ltr"
      className="page-scrubber-ruler relative h-14 w-full cursor-grab touch-none select-none overflow-hidden outline-none active:cursor-grabbing"
      onPointerDown={(e) => handlePointerDown(e, null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={controller.onKeyDown}
      onFocus={() => controller.setFocusWithin(true)}
      onBlur={() => controller.setFocusWithin(false)}
    >
      {pages.map((page) => {
        const offset = rulerOffsetForPage(page, previewPage, pxPerPage);
        const distance = Math.abs(page - previewPage);
        const isCentre = page === previewPage;
        const opacity = isCentre ? 1 : Math.max(0.22, 1 - distance * 0.2);
        return (
          <button
            key={page}
            type="button"
            tabIndex={-1}
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e, page);
            }}
            className={`page-scrubber-number absolute top-1/2 flex -translate-y-1/2 flex-col items-center ${
              isCentre ? "page-scrubber-number-centre" : ""
            }`}
            style={{
              left: `calc(50% + ${offset}px)`,
              transform: "translate(-50%, -50%)",
              opacity,
            }}
          >
            <span className="page-scrubber-marks" aria-hidden>
              {page === currentPage ? <i className="mark-current" /> : null}
              {page === lastReadPage ? <i className="mark-lastread" /> : null}
              {isBookmarked(page) ? <i className="mark-bookmark" /> : null}
            </span>
            <span
              className={
                isCentre
                  ? "font-display text-2xl leading-none text-ink"
                  : "font-display text-base leading-none text-ink-soft"
              }
            >
              {arNum(page)}
            </span>
          </button>
        );
      })}

      {/* Fixed centre indicator: ───●─── under the selected page. */}
      <span
        aria-hidden
        className={`page-scrubber-centre-marker pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 ${
          committing ? "page-scrubber-centre-loading" : ""
        }`}
      />
    </div>
  );
}
