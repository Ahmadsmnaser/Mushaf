"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampPage, getPageMeta, PAGE_COUNT } from "@/lib/mushaf/source";
import { saveLastRead } from "@/lib/useLastRead";
import { useBookmarks } from "@/lib/useBookmarks";
import { useReaderSettings } from "@/lib/readerSettings";
import { useAutoHideToolbar } from "@/lib/useAutoHideToolbar";
import { usePagePreload } from "@/lib/usePagePreload";
import { useMushafState } from "@/lib/useMushafState";
import ReaderToolbar from "@/components/chrome/ReaderToolbar";
import QuickJumpModal from "@/components/chrome/QuickJumpModal";
import BookmarksPanel from "@/components/chrome/BookmarksPanel";
import ReaderSidePanel from "@/components/chrome/ReaderSidePanel";
import BookFrame from "./BookFrame";
import ClosedMushafCover from "./ClosedMushafCover";
import PageImage from "./PageImage";

const FLIP_MS = 560;
const ZOOM_STEPS = [1, 1.25, 1.5, 2] as const;
// Drag-to-flip: commit past 30% travel, or a quick decisive flick.
const DRAG_COMMIT = 0.3;
const FLICK_PROGRESS = 0.08;
const FLICK_MS = 220;
const WHEEL_THRESHOLD = 55;
const WHEEL_COOLDOWN_MS = 880;

const arNum = (n: number) => n.toLocaleString("ar-EG");
type GrabZone = "top" | "middle" | "bottom";
type NavIntent = "next" | "previous";
type FlipDir = "next" | "prev";

const NAVIGATION: Record<
  "arrowLeft" | "arrowRight" | "wheelDown" | "wheelUp" | "leftButton" | "rightButton",
  NavIntent
> = {
  arrowLeft: "next",
  arrowRight: "previous",
  wheelDown: "next",
  wheelUp: "previous",
  leftButton: "next",
  rightButton: "previous",
};

/** Checked at interaction time: reduced motion crossfades instead of flipping. */
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * RTL navigation: this is an Arabic book, so positive deltaX (rightward
 * motion) advances to the NEXT page and leftward motion goes back — the
 * mirror of LTR carousel conventions. Used for drag/swipe release decisions.
 */
function getNavigationDirection(
  deltaX: number,
  threshold: number
): "next" | "previous" | "cancel" {
  if (deltaX > threshold) return "next";
  if (deltaX < -threshold) return "previous";
  return "cancel";
}

/** Spreads pair (odd, even): (1,2) … (603,604). Right page = odd = lower. */
const toSpreadStart = (n: number) => (n % 2 === 0 ? n - 1 : n);

function getGrabZone(y: number, top: number, height: number): GrabZone {
  const ratio = (y - top) / height;
  if (ratio < 0.34) return "top";
  if (ratio > 0.66) return "bottom";
  return "middle";
}

function isTypingTarget(target: EventTarget | null): target is HTMLElement {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))
  );
}

interface Flip {
  dir: FlipDir;
  /** Position before the flip: spread start (double mode) or page (single mode). */
  from: number;
  to: number;
  /** drag: follows the pointer · animating: easing to 1 · cancelling: easing back to 0 */
  phase: "drag" | "animating" | "cancelling";
  progress: number;
  /** Started from a button/key (true) or a drag (false) — picks the shading style. */
  auto: boolean;
  grab: GrabZone;
}

export default function Reader({ initialPage }: { initialPage: number }) {
  const [page, setPage] = useState(() => clampPage(initialPage));
  const [flip, setFlip] = useState<Flip | null>(null);
  // Visual book state (open / closing / closed / opening), fully separate
  // from page navigation state — closing never changes the page number.
  const mushaf = useMushafState();
  // Two-page spread on desktop, single page on narrow viewports. SSR renders
  // the desktop spread; the media query corrects after mount if needed.
  const [single, setSingle] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [readerSettings, setReaderSettings] = useReaderSettings();
  const { readerTheme, mushafStyle } = readerSettings;
  const idle = useAutoHideToolbar(5000);
  const { bookmarks, isBookmarked, toggle, remove, setNote } = useBookmarks();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x0: number; lastX: number; t0: number; w: number } | null>(null);
  const wheelUnlockRef = useRef<number | null>(null);
  const fadeRef = useRef(false); // reduced-motion crossfade in flight
  const pageRef = useRef(page);
  const flipRef = useRef(flip);
  const mushafOpenRef = useRef(true);
  const mushafClosedRef = useRef(false);
  const singleRef = useRef(single);
  const modalOpenRef = useRef(false);
  const panelOpenRef = useRef(false);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    flipRef.current = flip;
  }, [flip]);

  useEffect(() => {
    mushafOpenRef.current = mushaf.isOpen;
    mushafClosedRef.current = mushaf.isSettledClosed;
  }, [mushaf.isOpen, mushaf.isSettledClosed]);

  useEffect(() => {
    singleRef.current = single;
  }, [single]);

  useEffect(() => {
    modalOpenRef.current = jumpOpen || marksOpen;
  }, [jumpOpen, marksOpen]);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const apply = () => setSingle(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Settle a finished transition: commit forward flips, discard cancelled ones. */
  const resolveFlip = useCallback(() => {
    const f = flipRef.current;
    if (!f || f.phase === "drag") return;
    if (f.phase === "animating" && f.progress === 1) {
      setPage(f.to);
      setFlip(null);
    } else if (f.phase === "cancelling") {
      setFlip(null);
    }
  }, []);

  /** Compute the flip target from the current position, or null at the bounds. */
  const flipTarget = useCallback((dir: FlipDir) => {
    const isSingle = singleRef.current;
    const pos = isSingle ? pageRef.current : toSpreadStart(pageRef.current);
    const step = isSingle ? 1 : 2;
    const max = isSingle ? PAGE_COUNT : PAGE_COUNT - 1;
    const to = Math.min(Math.max(1, pos + (dir === "next" ? step : -step)), max);
    return to === pos ? null : { pos, to };
  }, []);

  // ------------------------------------------------------------------
  // Closed-book state. Turning past either end swings the leather cover
  // shut over the spread; the cover itself (or the button under it)
  // swings it open again onto the same spread. The machine lives in
  // useMushafState — here we only close chrome and forward the side.
  // ------------------------------------------------------------------
  const closeBook = useCallback(
    (side: "start" | "end") => {
      setPanelOpen(false);
      setJumpOpen(false);
      setMarksOpen(false);
      mushaf.close(side);
    },
    [mushaf.close] // eslint-disable-line react-hooks/exhaustive-deps -- stable callback off the hook
  );

  /** Reduced-motion page turn: a calm crossfade instead of the 3D leaf. */
  const crossFade = useCallback((to: number) => {
    const book = bookRef.current;
    if (!book) {
      setPage(to);
      return;
    }
    fadeRef.current = true;
    book.style.transition = "opacity 190ms ease";
    book.style.opacity = "0";
    window.setTimeout(() => {
      setPage(to);
      requestAnimationFrame(() => {
        book.style.opacity = "1";
      });
      window.setTimeout(() => {
        book.style.transition = "";
        fadeRef.current = false;
      }, 220);
    }, 200);
  }, []);

  const beginFlip = useCallback(
    (dir: FlipDir, phase: Flip["phase"], auto: boolean, grab: GrabZone) => {
      const t = flipTarget(dir);
      if (!t) {
        closeBook(dir === "prev" ? "start" : "end");
        return false;
      }
      if (auto && prefersReducedMotion()) {
        crossFade(t.to);
        return true;
      }
      setFlip({ dir, from: t.pos, to: t.to, phase, progress: 0, auto, grab });
      return true;
    },
    [flipTarget, closeBook, crossFade]
  );

  const navigateByIntent = useCallback(
    (intent: NavIntent) => {
      if (
        flipRef.current ||
        fadeRef.current ||
        modalOpenRef.current ||
        !mushafOpenRef.current
      )
        return;
      const dir: FlipDir = intent === "next" ? "next" : "prev";
      beginFlip(dir, "animating", true, "middle");
    },
    [beginFlip]
  );

  const navigateNext = useCallback(() => navigateByIntent("next"), [navigateByIntent]);
  const navigatePrevious = useCallback(
    () => navigateByIntent("previous"),
    [navigateByIntent]
  );

  // Auto flips mount the leaf at progress 0, then ease it to 1 next frame so
  // the CSS transition carries the turn.
  useEffect(() => {
    if (!flip || flip.phase !== "animating" || flip.progress === 1 || !flip.auto) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setFlip((f) =>
          f && f.phase === "animating" ? { ...f, progress: 1 } : f
        );
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [flip]);

  /** Direct jump (modals, panel): no flip animation, straight to the page. */
  const jumpTo = useCallback((p: number) => {
    setFlip(null);
    setPage(clampPage(p));
  }, []);

  // Safety net: settle even if transitionend never fires (hidden tab, etc.).
  useEffect(() => {
    if (!flip || flip.phase === "drag") return;
    const t = setTimeout(resolveFlip, FLIP_MS + 250);
    return () => clearTimeout(t);
  }, [flip, resolveFlip]);

  // ------------------------------------------------------------------
  // Drag-to-flip. Grabbing the left edge (the unread block) and pulling
  // right advances — the same physical motion as the auto flip; the right
  // edge mirrors it for going back. Pointer events cover mouse and touch.
  // ------------------------------------------------------------------
  const startDrag = useCallback(
    (dir: "next" | "prev") => (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !e.isPrimary ||
        flipRef.current ||
        fadeRef.current ||
        modalOpenRef.current ||
        !mushafOpenRef.current
      )
        return;
      const book = bookRef.current;
      if (!book) return;
      const rect = book.getBoundingClientRect();
      const grab = getGrabZone(e.clientY, rect.top, rect.height);
      if (!beginFlip(dir, "drag", false, grab)) return;
      dragRef.current = {
        x0: e.clientX,
        lastX: e.clientX,
        t0: performance.now(),
        w: rect.width,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [beginFlip]
  );

  const moveDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const f = flipRef.current;
    const d = dragRef.current;
    if (!f || f.phase !== "drag" || !d) return;
    d.lastX = e.clientX;
    // RTL: next follows rightward motion, prev follows leftward motion.
    const dx = f.dir === "next" ? e.clientX - d.x0 : d.x0 - e.clientX;
    const progress = Math.min(Math.max(dx / d.w, 0), 1);
    setFlip({ ...f, progress });
  }, []);

  const endDrag = useCallback(() => {
    const f = flipRef.current;
    const d = dragRef.current;
    if (!f || f.phase !== "drag" || !d) return;
    dragRef.current = null;
    const elapsed = performance.now() - d.t0;
    const wanted = getNavigationDirection(d.lastX - d.x0, DRAG_COMMIT * d.w);
    const commit =
      wanted === (f.dir === "next" ? "next" : "previous") ||
      (f.progress >= FLICK_PROGRESS && elapsed < FLICK_MS);
    // Settle immediately when there's nothing to animate: reduced motion, or
    // the drag already sits at an endpoint (no transform change → no
    // transitionend would ever fire).
    if (prefersReducedMotion()) {
      if (commit) setPage(f.to);
      setFlip(null);
    } else if (commit && f.progress > 0.995) {
      setPage(f.to);
      setFlip(null);
    } else if (!commit && f.progress < 0.005) {
      setFlip(null);
    } else {
      setFlip({ ...f, phase: commit ? "animating" : "cancelling", progress: commit ? 1 : 0 });
    }
  }, []);

  // Keep URL, title and last-read position on the settled page. replaceState
  // (not router.push): individual flips shouldn't pile up in browser history.
  useEffect(() => {
    window.history.replaceState(null, "", `/page/${page}`);
    document.title = `المصحف — صفحة ${arNum(page)}`;
    saveLastRead(page);
  }, [page]);

  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/\/page\/(\d+)/);
      if (m) {
        setFlip(null);
        setPage(clampPage(Number(m[1])));
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const toggleBookmark = useCallback(() => toggle(pageRef.current), [toggle]);

  // Keyboard. RTL book: advancing moves rightward, so ArrowRight = next and
  // ArrowLeft = previous; Space also advances. Ctrl/Cmd+K = quick jump,
  // B = bookmark (e.code so it works on Arabic keyboard layouts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Closed or mid-swing: the whole reader is inert except the reopen
      // affordance (Enter/Space from a settled closed cover; the cover and
      // pill buttons handle their own native activation).
      if (!mushafOpenRef.current) {
        if (
          mushafClosedRef.current &&
          (e.key === "Enter" || e.key === " ") &&
          !isTypingTarget(e.target)
        ) {
          e.preventDefault();
          mushaf.open();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        setMarksOpen(false);
        setJumpOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && panelOpenRef.current && !modalOpenRef.current) {
        setPanelOpen(false);
        return;
      }
      if (isTypingTarget(e.target))
        return;
      if (modalOpenRef.current) return; // modals own their keys (incl. Escape)
      if (e.key === "ArrowLeft" || e.key === " ") {
        e.preventDefault();
        navigateByIntent(NAVIGATION.arrowLeft);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateByIntent(NAVIGATION.arrowRight);
      } else if (e.code === "KeyB" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleBookmark();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigateByIntent, toggleBookmark, mushaf.open]); // eslint-disable-line react-hooks/exhaustive-deps -- stable callback off the hook

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (
        zoom > 1.001 ||
        flipRef.current ||
        fadeRef.current ||
        modalOpenRef.current ||
        panelOpenRef.current ||
        !mushafOpenRef.current ||
        wheelUnlockRef.current !== null ||
        Math.abs(e.deltaY) < WHEEL_THRESHOLD
      )
        return;

      e.preventDefault();
      navigateByIntent(e.deltaY > 0 ? NAVIGATION.wheelDown : NAVIGATION.wheelUp);
      wheelUnlockRef.current = window.setTimeout(() => {
        wheelUnlockRef.current = null;
      }, WHEEL_COOLDOWN_MS);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (wheelUnlockRef.current !== null) {
        window.clearTimeout(wheelUnlockRef.current);
        wheelUnlockRef.current = null;
      }
    };
  }, [navigateByIntent, zoom]);

  usePagePreload(toSpreadStart(page));

  // Re-center the scroll viewport when zooming.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: (el.clientWidth - el.scrollWidth) / 2, // rtl: negative range
      top: (el.scrollHeight - el.clientHeight) / 2,
    });
  }, [zoom]);

  const zoomIndex = ZOOM_STEPS.findIndex((z) => z >= zoom - 0.001);
  const canZoomIn = zoomIndex < ZOOM_STEPS.length - 1;
  const canZoomOut = zoomIndex > 0;
  const zoomIn = () => canZoomIn && setZoom(ZOOM_STEPS[zoomIndex + 1]);
  const zoomOut = () => canZoomOut && setZoom(ZOOM_STEPS[zoomIndex - 1]);

  const s = toSpreadStart(page);

  // RTL book mechanics: the unread stack is on the LEFT. Advancing from
  // (f, f+1) to (t, t+1) lifts the left page — the leaf carries f+1 on its
  // front, sweeps left → right over the spine, and lands as t on the right;
  // beneath it the left slot already shows the incoming t+1. Going back
  // mirrors it: the right page lifts and returns leftward.
  let baseRight = s;
  let baseLeft = s + 1;
  let leaf: { side: "right" | "left"; front: number; back: number } | null = null;
  if (flip && !single) {
    if (flip.dir === "next") {
      baseRight = flip.from;
      baseLeft = flip.to + 1;
      leaf = { side: "left", front: flip.from + 1, back: flip.to };
    } else {
      baseRight = flip.to;
      baseLeft = flip.from + 1;
      leaf = { side: "right", front: flip.from, back: flip.to + 1 };
    }
  }
  // Positive rotation carries the left leaf rightward (next); negative mirrors.
  const leafDeg = flip ? (flip.dir === "next" ? 180 : -180) * flip.progress : 0;
  // Face shading peaks mid-turn (the page bows away from the light).
  const shade = flip ? Math.sin(Math.PI * flip.progress) * 0.55 : 0;
  const moveClass =
    flip?.phase === "drag" ? "leaf-dragging" : flip?.auto ? "leaf-move" : "leaf-release";
  const grab = flip?.grab ?? "middle";
  const grabY = grab === "top" ? "18%" : grab === "bottom" ? "82%" : "50%";
  const curlBias = grab === "top" ? -1 : grab === "bottom" ? 1 : 0;
  const curlDeg = flip ? Math.sin(Math.PI * flip.progress) * curlBias * 2.2 : 0;
  const turnProgress = flip ? Math.sin(Math.PI * flip.progress).toFixed(3) : "0";

  const pageTurnStyle = (
    transform: string,
    hinge: "left" | "right"
  ): React.CSSProperties =>
    ({
      transform: `${transform} rotateZ(${curlDeg.toFixed(2)}deg)`,
      transformOrigin: `${hinge} ${grabY}`,
      "--turn-progress": turnProgress,
      "--turn-shade": shade.toFixed(3),
    }) as React.CSSProperties;

  // The lift shadow wrapper: holds the drop-shadow `filter` OUTSIDE the 3D
  // leaf (a filter on the leaf would flatten preserve-3d and expose the
  // mirrored front face as its own backside). Vars are set here too so the
  // filter can read the turn progress.
  const liftClass = `leaf-lift ${moveClass === "leaf-move" ? "leaf-lift-move" : ""}`;
  const liftVars = {
    "--turn-progress": turnProgress,
    "--turn-shade": shade.toFixed(3),
  } as React.CSSProperties;

  // Single-page mode: a fold around the right edge (the spine side of an RTL
  // book) — the page turns rightward to advance, same progress model.
  let singleTop = page;
  let singleUnder: number | null = null;
  let singleDeg = 0;
  if (flip && single) {
    if (flip.dir === "next") {
      singleTop = flip.from;
      singleUnder = flip.to;
      singleDeg = 88 * flip.progress;
    } else {
      singleTop = flip.to;
      singleUnder = flip.from;
      singleDeg = 88 * (1 - flip.progress);
    }
  }

  const metaRight = getPageMeta(single ? page : s);
  const metaLeft = single ? null : getPageMeta(s + 1);
  // Bare names in the caption («البقرة», not «سُورَةُ البَقَرَةِ») — the
  // fixed-width toolbar chip has no room for the honorific, and the design
  // drops it too. The prefix is voweled in the data, so match it bare.
  const stripSurahPrefix = (name: string) => {
    const [first, ...rest] = name.split(" ");
    const bare = first.replace(/[ً-ْٰـ]/g, "");
    return bare === "سورة" && rest.length > 0 ? rest.join(" ") : name;
  };
  const captionSurahs = Array.from(
    new Set(
      [...metaRight.surahs, ...(metaLeft?.surahs ?? [])].map(stripSurahPrefix)
    )
  );
  const surahLabel =
    captionSurahs.length > 2
      ? `${captionSurahs.slice(0, 2).join("، ")}…`
      : captionSurahs.join("، ");
  const pageLabel = single ? arNum(page) : `${arNum(s)}–${arNum(s + 1)}`;
  const toolbarCaptionLabel = `سورة ${surahLabel}\nالجزء ${arNum(metaRight.juz)}\nصفحة ${pageLabel}`;

  const bookWidth = single
    ? `calc(min(94vw, 86svh * 0.6783) * ${zoom})`
    : `calc(min(92vw, 88svh * 1.3566) * ${zoom})`;

  const onLeafTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === "transform") resolveFlip();
  };

  return (
    <main
      data-reader-theme={readerTheme}
      data-mushaf-style={mushafStyle}
      className="reader-canvas relative h-svh w-full select-none overflow-hidden"
    >
      {/* Open-state rendering: unmounted entirely once the book settles
          shut, so the closed state is only ever the cover. */}
      {!mushaf.isSettledClosed && (
        <>
      {/* RTL: advancing moves rightward — the right zone is NEXT */}
      <NavZone
        side="right"
        label="الصفحة السابقة"
        onClick={() => navigateByIntent(NAVIGATION.rightButton)}
        idle={idle && !jumpOpen && !marksOpen && !panelOpen}
        hidden={!mushaf.isOpen}
      />
      <NavZone
        side="left"
        label="الصفحة التالية"
        onClick={() => navigateByIntent(NAVIGATION.leftButton)}
        idle={idle && !jumpOpen && !marksOpen && !panelOpen}
        hidden={!mushaf.isOpen}
      />

      <div ref={scrollRef} className="h-full w-full overflow-auto">
        <div className="flex min-h-full min-w-full">
          <div className="m-auto py-[3.5svh]" style={{ width: bookWidth }}>
            {single ? (
              <BookFrame aspectRatio="622 / 917">
                <div ref={bookRef} className="absolute inset-0">
                  {singleUnder !== null && (
                    <div className="absolute inset-0">
                      <PageImage page={singleUnder} />
                    </div>
                  )}
                  <div className={`${liftClass} absolute inset-0`} style={liftVars}>
                    <div
                      className={`page-turn-leaf turn-grab-${grab} absolute inset-0 [transform-style:preserve-3d] ${moveClass}`}
                      style={pageTurnStyle(`rotateY(${singleDeg}deg)`, "right")}
                      onTransitionEnd={onLeafTransitionEnd}
                    >
                      <div className="leaf-face absolute inset-0 [backface-visibility:hidden]">
                        <PageImage page={singleTop} />
                      </div>
                      <div className="leaf-face absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                        <PaperBack />
                      </div>
                    </div>
                  </div>
                  {isBookmarked(page) && <Ribbon style={{ right: "9%" }} />}
                  {/* RTL: the next leaf is grabbed at the LEFT edge and pulled right */}
                  <DragStrip side="left" onDown={startDrag("next")} onMove={moveDrag} onUp={endDrag} />
                  <DragStrip side="right" onDown={startDrag("prev")} onMove={moveDrag} onUp={endDrag} />
                </div>
              </BookFrame>
            ) : (
              <BookFrame aspectRatio="1244 / 917">
                <div ref={bookRef} className="absolute inset-0">
                  <div className="absolute inset-y-0 right-0 w-1/2">
                    <PageImage page={baseRight} />
                  </div>
                  <div className="absolute inset-y-0 left-0 w-1/2">
                    <PageImage page={baseLeft} />
                  </div>
                  <SpreadShading />
                  {leaf && flip && (
                    <div
                      className={`${liftClass} absolute inset-y-0 z-30 w-1/2 ${
                        leaf.side === "right" ? "left-1/2" : "left-0"
                      }`}
                      style={liftVars}
                    >
                      <div
                        className={`page-turn-leaf turn-grab-${grab} absolute inset-0 [transform-style:preserve-3d] ${moveClass}`}
                        style={pageTurnStyle(`rotateY(${leafDeg}deg)`, leaf.side === "right" ? "left" : "right")}
                        onTransitionEnd={onLeafTransitionEnd}
                      >
                        <div className="leaf-face absolute inset-0 [backface-visibility:hidden]">
                          <PageImage page={leaf.front} />
                          <LeafShade side={leaf.side} face="front" auto={flip.auto} shade={shade} />
                        </div>
                        {/* The physical backside of this sheet IS the incoming
                            page. Its 180° face rotation cancels the leaf's turn,
                            so the text reads normally — never mirrored. */}
                        <div className="leaf-face absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                          <PageImage page={leaf.back} />
                          <LeafShade side={leaf.side} face="back" auto={flip.auto} shade={shade} />
                        </div>
                      </div>
                    </div>
                  )}
                  {/* bookmark ribbons on the settled spread */}
                  {isBookmarked(s) && <Ribbon style={{ right: "9%" }} />}
                  {isBookmarked(s + 1) && <Ribbon style={{ left: "9%" }} />}
                  {/* RTL: the next leaf is grabbed at the LEFT edge and pulled right */}
                  <DragStrip side="left" onDown={startDrag("next")} onMove={moveDrag} onUp={endDrag} />
                  <DragStrip side="right" onDown={startDrag("prev")} onMove={moveDrag} onUp={endDrag} />
                </div>
              </BookFrame>
            )}
          </div>
        </div>
      </div>

        </>
      )}

      {/* Closed-state rendering: mounted only while closing/closed/opening,
          fresh each cycle so its animations start clean. */}
      {mushaf.cover && mushaf.side && (
        <ClosedMushafCover
          phase={mushaf.cover}
          side={mushaf.side}
          onOpen={mushaf.open}
        />
      )}

      {!mushaf.isSettledClosed && (
        <>
      <ReaderToolbar
        idle={idle && !jumpOpen && !marksOpen && !panelOpen}
        hidden={!mushaf.isOpen}
        caption={
          <>
            <span className="min-w-0 truncate font-display text-[17px] leading-none text-ink lg:hidden">
              {surahLabel}
            </span>
            <span className="hidden text-[9px] text-gold/80 sm:inline lg:hidden" aria-hidden>
              ◆
            </span>
            <span className="hidden text-xs leading-none sm:inline lg:hidden">
              الجزء {arNum(metaRight.juz)}
            </span>
            <span className="text-[9px] text-gold/80 lg:hidden" aria-hidden>
              ◆
            </span>
            <span className="text-xs leading-none lg:hidden">
              {pageLabel}
            </span>
            <span className="hidden font-display text-[15px] leading-none text-ink lg:block">
              {single ? arNum(page) : arNum(s)}
            </span>
            <span className="hidden text-[10px] leading-none text-ink-soft lg:block">
              ج {arNum(metaRight.juz)}
            </span>
          </>
        }
        captionLabel={toolbarCaptionLabel}
        onPrev={navigatePrevious}
        onNext={navigateNext}
        bookmarked={isBookmarked(page)}
        onToggleBookmark={toggleBookmark}
        onOpenJump={() => setJumpOpen(true)}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={() => setZoom(1)}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenPanel={() => setPanelOpen(true)}
      />

      <ReaderSidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onOpenIndex={() => {
          setPanelOpen(false);
          setJumpOpen(true);
        }}
        onOpenBookmarks={() => {
          setPanelOpen(false);
          setMarksOpen(true);
        }}
        bookmarkCount={bookmarks.length}
        readerTheme={readerTheme}
        onReaderThemeChange={(nextTheme) =>
          setReaderSettings({ readerTheme: nextTheme })
        }
        mushafStyle={mushafStyle}
        onMushafStyleChange={(nextStyle) =>
          setReaderSettings({ mushafStyle: nextStyle })
        }
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={() => setZoom(1)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <QuickJumpModal
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
        onSelect={jumpTo}
      />
      <BookmarksPanel
        open={marksOpen}
        onClose={() => setMarksOpen(false)}
        bookmarks={bookmarks}
        onGo={jumpTo}
        onRemove={remove}
        onSetNote={setNote}
      />
        </>
      )}
    </main>
  );
}

/**
 * Spread shading, per the design: dark outer page edges, a broad falloff
 * toward the binding on each side, a pale bow highlight, then the firm spine
 * band with its white hairline seam. All below the turning leaf (z-30).
 */
function SpreadShading() {
  return (
    <>
      <div aria-hidden className="spread-edge-right pointer-events-none absolute inset-y-0 right-0 z-10 w-[4%]" />
      <div aria-hidden className="spread-edge-left pointer-events-none absolute inset-y-0 left-0 z-10 w-[4%]" />
      <div aria-hidden className="spread-spine-left pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[17%]" />
      <div aria-hidden className="spread-spine-right pointer-events-none absolute inset-y-0 right-1/2 z-10 w-[17%]" />
      <div aria-hidden className="spread-bow-left pointer-events-none absolute inset-y-0 left-[66%] z-10 w-[6%]" />
      <div aria-hidden className="spread-bow-right pointer-events-none absolute inset-y-0 right-[66%] z-10 w-[6%]" />
      <div aria-hidden className="book-spine pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[46px] -translate-x-1/2" />
      <div aria-hidden className="spine-hairline pointer-events-none absolute inset-y-[1%] left-1/2 z-20 w-px -translate-x-1/2" />
    </>
  );
}

function PaperBack() {
  return <div aria-hidden className="leaf-paper-back absolute inset-0" />;
}

/** Spine-side shading on the moving leaf; peaks mid-turn. Auto flips animate
 *  it with a keyframe pulse (progress jumps 0→1 in one step there); drags
 *  drive it per-frame from the drag progress. */
function LeafShade({
  side,
  face,
  auto,
  shade,
}: {
  side: "right" | "left";
  face: "front" | "back";
  auto: boolean;
  shade: number;
}) {
  const towardSpine =
    (side === "right") === (face === "front")
      ? "bg-gradient-to-r from-black/30 to-transparent to-[62%]"
      : "bg-gradient-to-l from-black/30 to-transparent to-[62%]";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${towardSpine} ${
        auto ? "leaf-shade-anim" : "transition-opacity duration-300"
      }`}
      style={auto ? undefined : { opacity: shade }}
    />
  );
}

/** The physical علامة: a ribbon hanging over the top edge of a bookmarked page. */
function Ribbon({ style }: { style: React.CSSProperties }) {
  return <span aria-hidden className="ribbon absolute top-0 z-20" style={style} />;
}

/** Grabbable page edge: full-height strip with a folded-corner affordance. */
function DragStrip({
  side,
  onDown,
  onMove,
  onUp,
}: {
  side: "right" | "left";
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onUp: () => void;
}) {
  return (
    <div
      className={`drag-strip absolute inset-y-0 z-40 w-[9%] min-w-11 ${
        side === "right" ? "right-0" : "left-0"
      }`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden
    >
      <span className={`corner-hint ${side === "right" ? "corner-hint-right" : "corner-hint-left"}`} />
    </div>
  );
}

/** Invisible full-height click strip at each viewport edge; chevron appears on hover. */
function NavZone({
  side,
  label,
  onClick,
  idle,
  hidden,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  idle: boolean;
  hidden: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`reader-nav-zone group absolute inset-y-0 z-10 w-[6%] min-w-11 cursor-pointer ${
        side === "left" ? "reader-nav-left left-0" : "reader-nav-right right-0"
      } ${hidden ? "reader-nav-hidden" : idle ? "reader-nav-idle" : "reader-nav-awake"}`}
    >
      <span
        aria-hidden
        className={`reader-nav-affordance absolute top-1/2 flex h-14 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/20 bg-sheet/20 text-[color:var(--canvas-fg)] shadow-[0_10px_30px_-18px_rgba(20,14,4,.45)] backdrop-blur-[6px] transition-all duration-300 ${
          side === "left" ? "left-2" : "right-2"
      }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[34px] w-[34px]"
        >
          <path d={side === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
        </svg>
      </span>
    </button>
  );
}
