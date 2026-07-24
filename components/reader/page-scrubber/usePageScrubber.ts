"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MOTION } from "@/lib/motion";
import { usePresence } from "@/components/motion/Presence";
import {
  clampPage,
  pointerDeltaToPage,
  stepPage,
  trackRatioToPage,
} from "@/lib/mushaf/pageScrubber";

/** Pixels of horizontal drag that move the ruler by exactly one page (fine
 *  control). Shared with the presentation so the strip and the math agree. */
export const RULER_PX_PER_PAGE = 52;
/** Page numbers drawn on each side of the centred preview. */
export const RULER_RADIUS = 4;
/** A larger keyboard step, in step with the reader's own paging feel. */
export const PAGE_STEP = 10;

const HIDE_DELAY = 1400;
const COMMIT_TIMEOUT = 6000;

export type ScrubberInteractionMode = "pointer" | "wheel" | "keyboard" | null;

export interface PageScrubberController {
  /** Kept mounted through its exit animation. */
  mounted: boolean;
  /** True while the surface should read as present (drives the entrance). */
  visible: boolean;
  /** Internal presence phase, for the loading affordance / styling. */
  committing: boolean;
  previewPage: number;
  /** The reader page the scrubber will restore to on cancel. */
  committedPage: number;
  interactionMode: ScrubberInteractionMode;
  reveal: () => void;
  keepAlive: () => void;
  scheduleHide: () => void;
  cancel: () => void;
  commitPreview: () => void;
  setPreviewPage: (page: number, mode: Exclude<ScrubberInteractionMode, null>) => void;
  setFocusWithin: (focused: boolean) => void;
  onRulerPointerDown: (clientX: number) => void;
  onRulerPointerMove: (clientX: number) => void;
  onRulerPointerUp: () => void;
  onRulerPointerCancel: () => void;
  onWheel: (deltaY: number, deltaMode: number) => void;
  onTrackScrub: (ratio: number) => void;
  onTrackCommit: (ratio: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

interface Options {
  currentPage: number;
  pageCount: number;
  disabled: boolean;
  onCommit: (page: number) => void;
  onActiveChange?: (active: boolean) => void;
}

/**
 * The scrubber's interaction + presence state machine. It owns a `previewPage`
 * that is deliberately SEPARATE from the reader's real page — scrubbing never
 * touches the reader. Only an explicit confirmation calls `onCommit`, which is
 * the reader's authoritative page-jump; the reader then loads/decodes and runs
 * one transition. Rapid inputs are protected by that same pipeline (a stale
 * load can never win) plus this machine's `committing` lock.
 */
export function usePageScrubber({
  currentPage,
  pageCount,
  disabled,
  onCommit,
  onActiveChange,
}: Options): PageScrubberController {
  const [open, setOpen] = useState(false);
  const [previewPage, setPreviewPageState] = useState(currentPage);
  const [committing, setCommitting] = useState(false);
  const [interactionMode, setInteractionMode] = useState<ScrubberInteractionMode>(null);

  const presence = usePresence(open, MOTION.duration.dialog);

  const openRef = useRef(open);
  const previewRef = useRef(previewPage);
  const committingRef = useRef(false);
  const currentPageRef = useRef(currentPage);
  const disabledRef = useRef(disabled);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const dragRef = useRef<{ startX: number; startPage: number } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const commitTargetRef = useRef<number | null>(null);
  const commitTimeoutRef = useRef<number | null>(null);

  // Mirror the reactive state into refs from effects (never during render), so
  // the event handlers below can read the latest values synchronously.
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    previewRef.current = previewPage;
  }, [previewPage]);
  useEffect(() => {
    committingRef.current = committing;
  }, [committing]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const setPreviewPage = useCallback(
    (page: number, mode: Exclude<ScrubberInteractionMode, null>) => {
      if (committingRef.current) return;
      const next = clampPage(page);
      previewRef.current = next;
      setPreviewPageState(next);
      setInteractionMode(mode);
    },
    []
  );

  // Immediate cancel: drop any un-committed preview and retreat. Never runs
  // while a commit is in flight — that navigation must be allowed to settle.
  const cancel = useCallback(() => {
    if (committingRef.current) return;
    clearHideTimer();
    dragRef.current = null;
    setInteractionMode(null);
    setPreviewPageState(currentPageRef.current);
    previewRef.current = currentPageRef.current;
    setOpen(false);
  }, [clearHideTimer]);

  // Only keep the surface up while something is genuinely happening on it.
  const keepAlive = useCallback(() => {
    hoverRef.current = true;
    clearHideTimer();
  }, [clearHideTimer]);

  const scheduleHide = useCallback(() => {
    hoverRef.current = false;
    if (!openRef.current) return;
    if (committingRef.current || dragRef.current || focusRef.current) return;
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      if (dragRef.current || focusRef.current || committingRef.current) return;
      cancel();
    }, HIDE_DELAY);
  }, [cancel, clearHideTimer]);

  const reveal = useCallback(() => {
    if (disabledRef.current || committingRef.current) return;
    clearHideTimer();
    hoverRef.current = true;
    if (openRef.current) return;
    const base = currentPageRef.current;
    previewRef.current = base;
    setPreviewPageState(base);
    setInteractionMode(null);
    setOpen(true);
  }, [clearHideTimer]);

  const setFocusWithin = useCallback(
    (focused: boolean) => {
      focusRef.current = focused;
      if (focused) clearHideTimer();
      else scheduleHide();
    },
    [clearHideTimer, scheduleHide]
  );

  // The one commit path. Same-page confirmations retreat without navigating;
  // real destinations enter the `committing` lock and wait for the reader's
  // page to actually change (or a safety timeout) before closing.
  const commitPreview = useCallback(() => {
    if (committingRef.current) return;
    const target = clampPage(previewRef.current);
    if (target === currentPageRef.current) {
      cancel();
      return;
    }
    clearHideTimer();
    dragRef.current = null;
    committingRef.current = true;
    commitTargetRef.current = target;
    setCommitting(true);
    setInteractionMode(null);
    onCommit(target);
    if (commitTimeoutRef.current !== null) window.clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = window.setTimeout(() => {
      commitTimeoutRef.current = null;
      // Loading stalled or failed: release the lock and retreat calmly. The
      // reader keeps its current spread and surfaces its own message.
      committingRef.current = false;
      commitTargetRef.current = null;
      setCommitting(false);
      setPreviewPageState(currentPageRef.current);
      previewRef.current = currentPageRef.current;
      setOpen(false);
    }, COMMIT_TIMEOUT);
  }, [cancel, clearHideTimer, onCommit]);

  const finishCommit = useCallback(() => {
    if (commitTimeoutRef.current !== null) {
      window.clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = null;
    }
    committingRef.current = false;
    commitTargetRef.current = null;
    setCommitting(false);
    setInteractionMode(null);
    setOpen(false);
  }, []);

  // ---- pointer drag on the ruler -----------------------------------------
  const onRulerPointerDown = useCallback(
    (clientX: number) => {
      if (committingRef.current) return;
      clearHideTimer();
      hoverRef.current = true;
      dragRef.current = { startX: clientX, startPage: previewRef.current };
    },
    [clearHideTimer]
  );

  const onRulerPointerMove = useCallback((clientX: number) => {
    const drag = dragRef.current;
    if (!drag || committingRef.current) return;
    const next = pointerDeltaToPage(
      drag.startPage,
      clientX - drag.startX,
      RULER_PX_PER_PAGE
    );
    if (next !== previewRef.current) {
      previewRef.current = next;
      setPreviewPageState(next);
    }
    setInteractionMode("pointer");
  }, []);

  const onRulerPointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    commitPreview();
  }, [commitPreview]);

  const onRulerPointerCancel = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    cancel();
  }, [cancel]);

  // ---- wheel: preview only; commit stays explicit (Enter / click) ---------
  const onWheel = useCallback((deltaY: number, deltaMode: number) => {
    if (committingRef.current) return;
    // Normalise line / page delta modes to a pixel-ish scale, then reduce a
    // fast flick to at most a few pages so trackpads don't race away.
    const scaled = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY;
    const magnitude = Math.min(3, Math.max(1, Math.round(Math.abs(scaled) / 40)));
    const direction = scaled > 0 ? 1 : -1; // wheel-down advances (reader parity)
    const next = stepPage(previewRef.current, direction * magnitude);
    if (next !== previewRef.current) {
      previewRef.current = next;
      setPreviewPageState(next);
    }
    setInteractionMode("wheel");
    hoverRef.current = true;
    clearHideTimer();
  }, [clearHideTimer]);

  // ---- progress track -----------------------------------------------------
  const onTrackScrub = useCallback((ratio: number) => {
    if (committingRef.current) return;
    const next = trackRatioToPage(ratio);
    if (next !== previewRef.current) {
      previewRef.current = next;
      setPreviewPageState(next);
    }
    setInteractionMode("pointer");
    hoverRef.current = true;
    clearHideTimer();
  }, [clearHideTimer]);

  const onTrackCommit = useCallback(
    (ratio: number) => {
      if (committingRef.current) return;
      const next = trackRatioToPage(ratio);
      previewRef.current = next;
      setPreviewPageState(next);
      commitPreview();
    },
    [commitPreview]
  );

  // ---- keyboard (RTL slider semantics, matching the reader) ---------------
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (committingRef.current) return;
      let handled = true;
      const p = previewRef.current;
      switch (event.key) {
        // RTL: Left advances (next / higher page), Right goes back.
        case "ArrowLeft":
        case "ArrowUp":
          setPreviewPage(stepPage(p, 1), "keyboard");
          break;
        case "ArrowRight":
        case "ArrowDown":
          setPreviewPage(stepPage(p, -1), "keyboard");
          break;
        case "PageUp":
          setPreviewPage(stepPage(p, PAGE_STEP), "keyboard");
          break;
        case "PageDown":
          setPreviewPage(stepPage(p, -PAGE_STEP), "keyboard");
          break;
        case "Home":
          setPreviewPage(1, "keyboard");
          break;
        case "End":
          setPreviewPage(pageCount, "keyboard");
          break;
        case "Enter":
          commitPreview();
          break;
        case "Escape":
          cancel();
          break;
        default:
          handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [cancel, commitPreview, pageCount, setPreviewPage]
  );

  // Reader page moved: sync the restore target, and settle a pending commit
  // exactly when its destination has become the live page.
  useEffect(() => {
    currentPageRef.current = currentPage;
    if (committingRef.current && commitTargetRef.current === currentPage) {
      finishCommit();
    } else if (!openRef.current && !committingRef.current) {
      // Keep a hidden scrubber's preview aligned with the reader.
      previewRef.current = currentPage;
      setPreviewPageState(currentPage);
    }
  }, [currentPage, finishCommit]);

  // The reader disabled the surface (book closing, a flip, a modal): retreat,
  // unless a commit is already in flight and must be allowed to finish.
  useEffect(() => {
    if (disabled && openRef.current && !committingRef.current) cancel();
  }, [disabled, cancel]);

  useEffect(() => {
    onActiveChange?.(open);
  }, [open, onActiveChange]);

  useEffect(
    () => () => {
      clearHideTimer();
      if (commitTimeoutRef.current !== null) window.clearTimeout(commitTimeoutRef.current);
    },
    [clearHideTimer]
  );

  return {
    mounted: presence.mounted,
    visible: presence.visible,
    committing,
    previewPage,
    committedPage: currentPage,
    interactionMode,
    reveal,
    keepAlive,
    scheduleHide,
    cancel,
    commitPreview,
    setPreviewPage,
    setFocusWithin,
    onRulerPointerDown,
    onRulerPointerMove,
    onRulerPointerUp,
    onRulerPointerCancel,
    onWheel,
    onTrackScrub,
    onTrackCommit,
    onKeyDown,
  };
}
