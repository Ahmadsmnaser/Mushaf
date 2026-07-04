"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampPage, getPageMeta, PAGE_COUNT } from "@/lib/mushaf/source";
import { saveLastRead } from "@/lib/useLastRead";
import { useBookmarks } from "@/lib/useBookmarks";
import { useReaderTheme } from "@/lib/useReaderTheme";
import { useAutoHideToolbar } from "@/lib/useAutoHideToolbar";
import { usePagePreload } from "@/lib/usePagePreload";
import ReaderToolbar from "@/components/chrome/ReaderToolbar";
import QuickJumpModal from "@/components/chrome/QuickJumpModal";
import BookmarksPanel from "@/components/chrome/BookmarksPanel";
import ReaderSidePanel from "@/components/chrome/ReaderSidePanel";
import BookFrame from "./BookFrame";
import PageImage from "./PageImage";

const FLIP_MS = 460;
const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3] as const;
// Drag-to-flip: commit past 30% travel, or a quick decisive flick.
const DRAG_COMMIT = 0.3;
const FLICK_PROGRESS = 0.08;
const FLICK_MS = 200;

const arNum = (n: number) => n.toLocaleString("ar-EG");

/** Checked at interaction time: reduced motion skips the leaf and jumps. */
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

interface Flip {
  dir: "next" | "prev";
  /** Position before the flip: spread start (double mode) or page (single mode). */
  from: number;
  to: number;
  /** drag: follows the pointer · animating: easing to 1 · cancelling: easing back to 0 */
  phase: "drag" | "animating" | "cancelling";
  progress: number;
  /** Started from a button/key (true) or a drag (false) — picks the shading style. */
  auto: boolean;
}

export default function Reader({ initialPage }: { initialPage: number }) {
  const [page, setPage] = useState(() => clampPage(initialPage));
  const [flip, setFlip] = useState<Flip | null>(null);
  // Two-page spread on desktop, single page on narrow viewports. SSR renders
  // the desktop spread; the media query corrects after mount if needed.
  const [single, setSingle] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [theme, setTheme] = useReaderTheme();
  const idle = useAutoHideToolbar(3000);
  const { bookmarks, isBookmarked, toggle, remove, setNote } = useBookmarks();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x0: number; lastX: number; t0: number; w: number } | null>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const flipRef = useRef(flip);
  flipRef.current = flip;
  const singleRef = useRef(single);
  singleRef.current = single;
  const modalOpenRef = useRef(false);
  modalOpenRef.current = jumpOpen || marksOpen;
  const panelOpenRef = useRef(false);
  panelOpenRef.current = panelOpen;

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
  const flipTarget = useCallback((dir: "next" | "prev") => {
    const isSingle = singleRef.current;
    const pos = isSingle ? pageRef.current : toSpreadStart(pageRef.current);
    const step = isSingle ? 1 : 2;
    const max = isSingle ? PAGE_COUNT : PAGE_COUNT - 1;
    const to = Math.min(Math.max(1, pos + (dir === "next" ? step : -step)), max);
    return to === pos ? null : { pos, to };
  }, []);

  const navigate = useCallback(
    (dir: "next" | "prev") => {
      if (flipRef.current || modalOpenRef.current) return;
      const t = flipTarget(dir);
      if (!t) return;
      if (prefersReducedMotion()) {
        setPage(t.to);
        return;
      }
      setFlip({ dir, from: t.pos, to: t.to, phase: "animating", progress: 0, auto: true });
    },
    [flipTarget]
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
  // Drag-to-flip. Grabbing the right edge (the unread block) and pulling
  // left advances — the same physical motion as the auto flip; the left
  // edge mirrors it for going back. Pointer events cover mouse and touch.
  // ------------------------------------------------------------------
  const startDrag = useCallback(
    (dir: "next" | "prev") => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary || flipRef.current || modalOpenRef.current) return;
      const t = flipTarget(dir);
      const book = bookRef.current;
      if (!t || !book) return;
      dragRef.current = {
        x0: e.clientX,
        lastX: e.clientX,
        t0: performance.now(),
        w: book.getBoundingClientRect().width,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      setFlip({ dir, from: t.pos, to: t.to, phase: "drag", progress: 0, auto: false });
    },
    [flipTarget]
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
      if (
        e.target instanceof HTMLElement &&
        /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName)
      )
        return;
      if (modalOpenRef.current) return; // modals own their keys (incl. Escape)
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        navigate("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate("prev");
      } else if (e.code === "KeyB" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleBookmark();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, toggleBookmark]);

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
  const pos = single ? page : s;
  const canPrev = pos > 1;
  const canNext = single ? page < PAGE_COUNT : s < PAGE_COUNT - 1;

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
  const shade = flip ? Math.sin(Math.PI * flip.progress) * 0.9 : 0;
  const moveClass = flip?.phase === "drag" ? "leaf-dragging" : "leaf-move";

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
  const captionSurahs = Array.from(
    new Set([...metaRight.surahs, ...(metaLeft?.surahs ?? [])])
  );
  const surahLabel =
    captionSurahs.length > 3
      ? `${captionSurahs.slice(0, 3).join("، ")}…`
      : captionSurahs.join("، ");

  const bookWidth = single
    ? `calc(min(94vw, 86svh * 0.6783) * ${zoom})`
    : `calc(min(92vw, 88svh * 1.3566) * ${zoom})`;

  const onLeafTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === "transform") resolveFlip();
  };

  return (
    <main
      data-reader-theme={theme}
      className="reader-canvas relative h-svh w-full select-none overflow-hidden"
    >
      {/* RTL: advancing moves rightward — the right zone is NEXT */}
      <NavZone side="right" label="الصفحة التالية" onClick={() => navigate("next")} />
      <NavZone side="left" label="الصفحة السابقة" onClick={() => navigate("prev")} />

      <div ref={scrollRef} className="h-full w-full overflow-auto">
        <div className="flex min-h-full min-w-full">
          <div className="m-auto py-[3.5svh]" style={{ width: bookWidth }}>
            {single ? (
              <BookFrame
                aspectRatio="622 / 917"
                readPages={page - 1}
                remainingPages={PAGE_COUNT - page}
              >
                <div ref={bookRef} className="absolute inset-0">
                  {singleUnder !== null && (
                    <div className="absolute inset-0">
                      <PageImage page={singleUnder} />
                    </div>
                  )}
                  <div
                    className={`absolute inset-0 origin-right ${moveClass}`}
                    style={{ transform: `rotateY(${singleDeg}deg)` }}
                    onTransitionEnd={onLeafTransitionEnd}
                  >
                    <PageImage page={singleTop} />
                  </div>
                  {isBookmarked(page) && <Ribbon style={{ right: "9%" }} />}
                  {/* RTL: the next leaf is grabbed at the LEFT edge and pulled right */}
                  {canNext && (
                    <DragStrip side="left" onDown={startDrag("next")} onMove={moveDrag} onUp={endDrag} />
                  )}
                  {canPrev && (
                    <DragStrip side="right" onDown={startDrag("prev")} onMove={moveDrag} onUp={endDrag} />
                  )}
                </div>
              </BookFrame>
            ) : (
              <BookFrame
                aspectRatio="1244 / 917"
                readPages={s - 1}
                remainingPages={PAGE_COUNT - (s + 1)}
              >
                <div ref={bookRef} className="absolute inset-0">
                  <div className="absolute inset-y-0 right-0 w-1/2">
                    <PageImage page={baseRight} />
                  </div>
                  <div className="absolute inset-y-0 left-0 w-1/2">
                    <PageImage page={baseLeft} />
                  </div>
                  {leaf && flip && (
                    <div
                      className={`absolute inset-y-0 z-10 w-1/2 [transform-style:preserve-3d] ${moveClass} ${
                        leaf.side === "right" ? "left-1/2 origin-left" : "left-0 origin-right"
                      }`}
                      style={{ transform: `rotateY(${leafDeg}deg)` }}
                      onTransitionEnd={onLeafTransitionEnd}
                    >
                      <div className="absolute inset-0 [backface-visibility:hidden]">
                        <PageImage page={leaf.front} />
                        <LeafShade side={leaf.side} face="front" auto={flip.auto} shade={shade} />
                      </div>
                      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                        <PageImage page={leaf.back} />
                        <LeafShade side={leaf.side} face="back" auto={flip.auto} shade={shade} />
                      </div>
                    </div>
                  )}
                  {/* center spine gutter */}
                  <div className="book-spine pointer-events-none absolute inset-y-0 left-1/2 z-20 w-24 -translate-x-1/2" />
                  {/* bookmark ribbons on the settled spread */}
                  {isBookmarked(s) && <Ribbon style={{ right: "9%" }} />}
                  {isBookmarked(s + 1) && <Ribbon style={{ left: "9%" }} />}
                  {/* RTL: the next leaf is grabbed at the LEFT edge and pulled right */}
                  {canNext && (
                    <DragStrip side="left" onDown={startDrag("next")} onMove={moveDrag} onUp={endDrag} />
                  )}
                  {canPrev && (
                    <DragStrip side="right" onDown={startDrag("prev")} onMove={moveDrag} onUp={endDrag} />
                  )}
                </div>
              </BookFrame>
            )}
          </div>
        </div>
      </div>

      <ReaderToolbar
        idle={idle && !jumpOpen && !marksOpen && !panelOpen}
        caption={
          <>
            <span className="font-display text-base leading-none text-ink">
              {surahLabel}
            </span>
            <span className="hidden text-[9px] text-gold/80 sm:inline" aria-hidden>
              ◆
            </span>
            <span className="hidden text-xs leading-none sm:inline">
              الجزء {arNum(metaRight.juz)}
            </span>
            <span className="text-[9px] text-gold/80" aria-hidden>
              ◆
            </span>
            <span className="text-xs leading-none">
              {single ? arNum(page) : `${arNum(s)}–${arNum(s + 1)}`}
            </span>
          </>
        }
        onPrev={() => navigate("prev")}
        onNext={() => navigate("next")}
        canPrev={canPrev}
        canNext={canNext}
        bookmarked={isBookmarked(page)}
        onToggleBookmark={toggleBookmark}
        onOpenJump={() => setJumpOpen(true)}
        onOpenBookmarks={() => setMarksOpen(true)}
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
        onToggle={setPanelOpen}
        onOpenIndex={() => {
          setPanelOpen(false);
          setJumpOpen(true);
        }}
        onOpenBookmarks={() => {
          setPanelOpen(false);
          setMarksOpen(true);
        }}
        bookmarkCount={bookmarks.length}
        theme={theme}
        onThemeChange={setTheme}
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
    </main>
  );
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
      ? "bg-gradient-to-r from-black/20 to-transparent"
      : "bg-gradient-to-l from-black/20 to-transparent";
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
      className={`drag-strip absolute inset-y-0 z-30 w-[9%] min-w-11 ${
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
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`group absolute inset-y-0 z-10 w-[6%] min-w-9 cursor-pointer ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <span
        aria-hidden
        className="flex h-full items-center justify-center text-[color:var(--canvas-fg)] opacity-0 transition-opacity duration-300 group-hover:opacity-80"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9"
        >
          <path d={side === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
        </svg>
      </span>
    </button>
  );
}
