"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolvePageScrubberMetadata,
  scrubberArabicNumber as arNum,
} from "@/lib/mushaf/pageScrubber";
import {
  RULER_PX_PER_PAGE,
  RULER_RADIUS,
  usePageScrubber,
} from "./usePageScrubber";
import PageNumberRuler from "./PageNumberRuler";
import PageProgressTrack from "./PageProgressTrack";
import PagePreviewMetadata from "./PagePreviewMetadata";

/** Height (px) of the hover activation band along the reader's lower edge. */
const ACTIVATION_HEIGHT = 52;
const ANNOUNCE_DELAY = 450;

/**
 * Bottom Page Scrubber (مستعرض الصفحات السريع). A hidden navigation surface
 * that rises from the reader's lower edge on hover, previews distant pages
 * under a fixed centre marker while scrubbing, and commits exactly one
 * destination on release — leaving the real Mushaf untouched until then.
 */
export default function BottomPageScrubber({
  currentPage,
  pageCount,
  disabled,
  onCommit,
  isPageBookmarked,
  lastReadPage,
  viewportRef,
  onActiveChange,
}: {
  currentPage: number;
  pageCount: number;
  disabled: boolean;
  onCommit: (page: number) => void;
  isPageBookmarked: (page: number) => boolean;
  lastReadPage: number | null;
  viewportRef: React.RefObject<HTMLElement | null>;
  onActiveChange?: (active: boolean) => void;
}) {
  const controller = usePageScrubber({
    currentPage,
    pageCount,
    disabled,
    onCommit,
    onActiveChange,
  });
  const { mounted, visible, previewPage, committing } = controller;
  const { reveal, keepAlive, scheduleHide, onWheel, cancel } = controller;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inZoneRef = useRef(false);
  const announceTimerRef = useRef<number | null>(null);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const metadata = useMemo(
    () => resolvePageScrubberMetadata(previewPage),
    [previewPage]
  );
  const isBookmarked = isPageBookmarked(previewPage);
  const isLastRead = lastReadPage === previewPage;
  const isCurrent = currentPage === previewPage;
  const valueText = `صفحة ${arNum(previewPage)}، سورة ${metadata.primarySurahNameArabic}، الجزء ${arNum(
    metadata.juzNumber
  )}`;

  // Coarse (touch) pointers can't hover: swap the hidden band for a tap trigger.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const apply = () => setCoarsePointer(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Activation band bound to the actual reading viewport — no page-wide overlay
  // intercepts input; this is a passive pointermove read of a lower-edge zone
  // limited to the useful central width (leaving the edge page-turn strips).
  useEffect(() => {
    if (coarsePointer) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = viewport.getBoundingClientRect();
      const bandWidth = Math.min(Math.max(rect.width * 0.75, 320), 620);
      const centreX = rect.left + rect.width / 2;
      const inBand =
        event.clientY >= rect.bottom - ACTIVATION_HEIGHT &&
        event.clientY <= rect.bottom + 8 &&
        Math.abs(event.clientX - centreX) <= bandWidth / 2;
      if (inBand) {
        reveal();
        keepAlive();
      } else if (inZoneRef.current) {
        scheduleHide();
      }
      inZoneRef.current = inBand;
    };
    viewport.addEventListener("pointermove", onMove);
    return () => viewport.removeEventListener("pointermove", onMove);
    // Depend on the stable callbacks only, so a preview change mid-drag does
    // not tear down and re-attach the activation listener every frame.
  }, [coarsePointer, viewportRef, reveal, keepAlive, scheduleHide]);

  // Wheel over the surface previews pages; block it from reaching the reader's
  // page-turn wheel handler and from scrolling the page.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !mounted) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onWheel(event.deltaY, event.deltaMode);
    };
    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => surface.removeEventListener("wheel", handleWheel);
  }, [onWheel, mounted]);

  // A pointerdown outside the surface (and outside the trigger) cancels without
  // navigating — the calm "leave without confirming" path.
  useEffect(() => {
    if (!visible) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (surfaceRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      cancel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        cancel();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [cancel, visible]);

  // Restrained assistive announcements: a debounced preview readout while
  // scrubbing (setState only fires from the timer callback), and the committed
  // destination read out immediately via the derived message below.
  useEffect(() => {
    if (!visible || committing) return;
    if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current);
    announceTimerRef.current = window.setTimeout(() => {
      setAnnouncement(valueText);
    }, ANNOUNCE_DELAY);
    return () => {
      if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current);
    };
  }, [committing, valueText, visible]);

  const liveMessage = committing
    ? `الانتقال إلى صفحة ${arNum(previewPage)}`
    : announcement;

  if (!mounted && !coarsePointer) return null;

  return (
    <>
      {coarsePointer && !mounted && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => reveal()}
          className="page-scrubber-trigger fixed bottom-3 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-gold/30 bg-sheet/90 px-4 py-2 text-[13px] text-ink shadow-lg backdrop-blur"
        >
          <span aria-hidden className="text-accent">
            ⇅
          </span>
          الانتقال السريع
        </button>
      )}

      {mounted && (
        <div
          ref={surfaceRef}
          role="group"
          aria-label="مستعرض الصفحات السريع"
          aria-hidden={!visible}
          inert={!visible ? true : undefined}
          data-committing={committing ? "true" : undefined}
          className={`page-scrubber-surface fixed bottom-0 left-1/2 z-[70] w-[clamp(320px,72vw,600px)] max-w-[92vw] ${
            visible ? "page-scrubber-surface-visible" : ""
          }`}
          onPointerEnter={() => controller.keepAlive()}
          onPointerMove={() => controller.keepAlive()}
          onPointerLeave={() => controller.scheduleHide()}
        >
          <div className="page-scrubber-panel flex flex-col items-stretch gap-2 px-5 pb-4 pt-3">
            <div className="flex min-h-[46px] items-end justify-center">
              <PagePreviewMetadata
                metadata={metadata}
                isBookmarked={isBookmarked}
                isLastRead={isLastRead}
                isCurrent={isCurrent}
              />
            </div>

            <PageNumberRuler
              controller={controller}
              pageCount={pageCount}
              pxPerPage={RULER_PX_PER_PAGE}
              radius={RULER_RADIUS}
              currentPage={currentPage}
              lastReadPage={lastReadPage}
              isBookmarked={isPageBookmarked}
              valueText={valueText}
            />

            <PageProgressTrack
              controller={controller}
              pageCount={pageCount}
              currentPage={currentPage}
              lastReadPage={lastReadPage}
            />

            {coarsePointer && (
              <button
                type="button"
                onClick={() => cancel()}
                className="page-scrubber-close mx-auto mt-0.5 rounded-full border border-gold/25 px-3 py-1 text-[11px] text-ink-soft"
              >
                إغلاق
              </button>
            )}
          </div>

          <span className="sr-only" role="status" aria-live="polite">
            {liveMessage}
          </span>
        </div>
      )}
    </>
  );
}
