"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BOOK_TRANSITION, type BookVisualState, type MushafSide } from "@/lib/bookTransition";
import { getPageImageUrl, PAGE_HEIGHT, PAGE_WIDTH } from "@/lib/mushaf/source";

type TransitionPhase = Extract<
  BookVisualState["phase"],
  "preparing-to-close" | "closing" | "closed" | "opening"
>;

interface Geometry {
  book: { top: number; left: number; width: number; height: number };
  canvas: { top: number; left: number; width: number; height: number };
}

interface Props {
  phase: TransitionPhase;
  side: MushafSide;
  single: boolean;
  rightPage: number;
  leftPage: number | null;
  sourceBookRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLElement | null>;
  onPrepared: () => void;
  onCloseFinished: () => void;
  onOpenFinished: () => void;
  onOpen: () => void;
}

const rectValues = (rect: DOMRect) => ({
  top: rect.top,
  left: rect.left,
  width: rect.width,
  height: rect.height,
});

function loadDecodedImage(src: string, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    const done = () => resolve();
    image.onload = () => {
      if ("decode" in image) void image.decode().catch(() => {}).finally(done);
      else done();
    };
    image.onerror = done;
    signal.addEventListener("abort", done, { once: true });
    image.src = src;
  });
}

function closedPose(geometry: Geometry, side: MushafSide, single: boolean) {
  const { book, canvas } = geometry;
  const receiverWidth = single ? book.width : book.width / 2;
  const widthRatio = single ? 0.72 : 0.46;
  const targetWidth = Math.min(canvas.width * widthRatio, canvas.height * 0.84 * (622 / 917));
  const scale = Math.max(0.1, targetWidth / receiverWidth);
  const stageCenterX = book.left + book.width / 2;
  const stageCenterY = book.top + book.height / 2;
  const receiverCenterX = single
    ? stageCenterX
    : book.left + book.width * (side === "start" ? 0.25 : 0.75);
  const scaledReceiverX = stageCenterX + (receiverCenterX - stageCenterX) * scale;
  const targetCenterX = canvas.left + canvas.width / 2;
  const targetCenterY = canvas.top + canvas.height / 2;
  const x = targetCenterX - scaledReceiverX;
  const y = targetCenterY - stageCenterY;
  return {
    transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(5)}) rotateX(1.2deg) rotateZ(${side === "start" ? "-0.22" : "0.22"}deg)`,
    scale,
  };
}

function animation(
  element: HTMLElement | null,
  frames: Keyframe[],
  options: KeyframeAnimationOptions
) {
  return element?.animate ? element.animate(frames, options) : null;
}

export default function BookTransitionLayer({
  phase,
  side,
  single,
  rightPage,
  leftPage,
  sourceBookRef,
  canvasRef,
  onPrepared,
  onCloseFinished,
  onOpenFinished,
  onOpen,
}: Props) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const assemblyRef = useRef<HTMLDivElement>(null);
  const movingPagesRef = useRef<HTMLDivElement>(null);
  const frontCoverRef = useRef<HTMLButtonElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const openHintRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<Animation[]>([]);
  const timelineVersionRef = useRef(0);
  const preparedRef = useRef(false);
  const phaseRef = useRef(phase);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const measure = useCallback(() => {
    const source = sourceBookRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return null;
    return { book: rectValues(source.getBoundingClientRect()), canvas: rectValues(canvas.getBoundingClientRect()) };
  }, [canvasRef, sourceBookRef]);

  const cancelTimeline = useCallback(() => {
    timelineVersionRef.current += 1;
    for (const item of timelineRef.current) item.cancel();
    timelineRef.current = [];
  }, []);

  const pageEnd = single ? "rotateY(0deg)" : `rotateY(${side === "start" ? -179.6 : 179.6}deg)`;
  const coverOpen = single
    ? `rotateY(${side === "start" ? -104 : 104}deg) translateZ(-6px)`
    : "rotateY(0deg) translateZ(-6px)";
  const coverClosed = single ? "rotateY(0deg) translateZ(2px)" : `${pageEnd} translateZ(-6px)`;
  const closedShadowTransform = `translateX(${single ? 0 : side === "start" ? -25 : 25}%) scaleX(${single ? 0.86 : 0.46})`;

  const applyOpenPose = useCallback(() => {
    if (rootRef.current) rootRef.current.style.transform = "none";
    if (assemblyRef.current) assemblyRef.current.style.transform = "none";
    if (movingPagesRef.current) movingPagesRef.current.style.transform = "rotateY(0deg)";
    if (frontCoverRef.current) frontCoverRef.current.style.transform = coverOpen;
    if (shadowRef.current) {
      shadowRef.current.style.opacity = "0.7";
      shadowRef.current.style.transform = "scaleX(1)";
    }
    if (backdropRef.current) backdropRef.current.style.opacity = "0";
    if (stageRef.current) stageRef.current.style.opacity = "0";
    if (openHintRef.current) openHintRef.current.style.opacity = "0";
  }, [coverOpen]);

  const applyClosedPose = useCallback(
    (nextGeometry: Geometry) => {
      const pose = closedPose(nextGeometry, side, single);
      if (rootRef.current) rootRef.current.style.transform = pose.transform;
      if (assemblyRef.current) assemblyRef.current.style.transform = "none";
      if (movingPagesRef.current) movingPagesRef.current.style.transform = pageEnd;
      if (frontCoverRef.current) frontCoverRef.current.style.transform = coverClosed;
      if (shadowRef.current) {
        shadowRef.current.style.opacity = "0.92";
        shadowRef.current.style.transform = closedShadowTransform;
      }
      if (backdropRef.current) backdropRef.current.style.opacity = "1";
      if (stageRef.current) stageRef.current.style.opacity = "1";
      if (openHintRef.current) openHintRef.current.style.opacity = "1";
    },
    [closedShadowTransform, coverClosed, pageEnd, side, single]
  );

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const initial = measure();
      if (initial) setGeometry(initial);
    });
    return () => cancelAnimationFrame(frame);
  }, [measure]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let previous = canvas.getBoundingClientRect();
    const observer = new ResizeObserver(() => {
      const nextRect = canvas.getBoundingClientRect();
      if (
        Math.abs(nextRect.width - previous.width) < 1 &&
        Math.abs(nextRect.height - previous.height) < 1
      ) return;
      previous = nextRect;
      const next = measure();
      if (!next) return;
      setGeometry(next);
      if (phaseRef.current === "closed") applyClosedPose(next);
      else if (phaseRef.current === "closing") {
        cancelTimeline();
        applyClosedPose(next);
        onCloseFinished();
      } else if (phaseRef.current === "opening") {
        cancelTimeline();
        onOpenFinished();
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [applyClosedPose, canvasRef, cancelTimeline, measure, onCloseFinished, onOpenFinished]);

  useEffect(() => {
    if (phase !== "preparing-to-close" || !geometry || preparedRef.current) return;
    const controller = new AbortController();
    const pages = [rightPage, leftPage].filter((page): page is number => page !== null);
    void Promise.all(pages.map((page) => loadDecodedImage(getPageImageUrl(page), controller.signal))).then(
      () => {
        if (controller.signal.aborted) return;
        preparedRef.current = true;
        applyOpenPose();
        requestAnimationFrame(() => {
          if (!controller.signal.aborted) onPrepared();
        });
      }
    );
    return () => controller.abort();
  }, [applyOpenPose, geometry, leftPage, onPrepared, phase, rightPage]);

  useEffect(() => {
    if (!geometry || (phase !== "closing" && phase !== "opening")) return;
    cancelTimeline();
    const version = timelineVersionRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pose = closedPose(geometry, side, single);
    const items: Array<Animation | null> = [];

    if (phase === "closing" && reduced) {
      if (rootRef.current) rootRef.current.style.transform = pose.transform;
      if (movingPagesRef.current) movingPagesRef.current.style.transform = pageEnd;
      if (frontCoverRef.current) frontCoverRef.current.style.transform = coverClosed;
      items.push(
        animation(stageRef.current, [{ opacity: 0 }, { opacity: 1 }], {
          duration: BOOK_TRANSITION.reducedDuration,
          easing: "ease",
          fill: "both",
        }),
        animation(backdropRef.current, [{ opacity: 0 }, { opacity: 1 }], {
          duration: BOOK_TRANSITION.reducedDuration,
          easing: "ease",
          fill: "both",
        })
      );
    } else if (phase === "opening" && reduced) {
      items.push(
        animation(stageRef.current, [{ opacity: 1 }, { opacity: 0 }], {
          duration: BOOK_TRANSITION.reducedDuration,
          easing: "ease",
          fill: "both",
        }),
        animation(backdropRef.current, [{ opacity: 1 }, { opacity: 0 }], {
          duration: BOOK_TRANSITION.reducedDuration,
          easing: "ease",
          fill: "both",
        })
      );
    } else if (phase === "closing") {
      applyOpenPose();
      items.push(
        animation(stageRef.current, [{ opacity: 0 }, { opacity: 1 }], {
          duration: BOOK_TRANSITION.handoffDuration,
          easing: "ease",
          fill: "both",
        }),
        animation(backdropRef.current, [{ opacity: 0 }, { opacity: 1 }], {
          duration: 240,
          easing: "ease",
          fill: "both",
        }),
        animation(movingPagesRef.current, [{ transform: "rotateY(0deg)" }, { transform: pageEnd }], {
          duration: BOOK_TRANSITION.closePagesDuration,
          easing: BOOK_TRANSITION.paperEase,
          fill: "both",
        }),
        animation(frontCoverRef.current, [{ transform: coverOpen }, { transform: coverClosed }], {
          delay: BOOK_TRANSITION.closeCoverDelay,
          duration: BOOK_TRANSITION.closeCoverDuration,
          easing: BOOK_TRANSITION.coverEase,
          fill: "both",
        }),
        animation(rootRef.current, [{ transform: "none" }, { transform: pose.transform }], {
          delay: BOOK_TRANSITION.centerDelay,
          duration: BOOK_TRANSITION.centerDuration,
          easing: BOOK_TRANSITION.rootEase,
          fill: "both",
        }),
        animation(assemblyRef.current, [{ transform: "translateY(-1.5px)" }, { transform: "translateY(0)" }], {
          delay: BOOK_TRANSITION.settleDelay,
          duration: BOOK_TRANSITION.settleDuration,
          easing: BOOK_TRANSITION.settleEase,
          fill: "both",
        }),
        animation(shadowRef.current, [
          { opacity: 0.7, transform: "scaleX(1)" },
          { opacity: 0.92, transform: closedShadowTransform },
        ], {
          delay: BOOK_TRANSITION.centerDelay,
          duration: BOOK_TRANSITION.centerDuration + BOOK_TRANSITION.settleDuration,
          easing: BOOK_TRANSITION.rootEase,
          fill: "both",
        }),
        animation(openHintRef.current, [{ opacity: 0 }, { opacity: 1 }], {
          delay: BOOK_TRANSITION.settleDelay,
          duration: BOOK_TRANSITION.settleDuration,
          easing: "ease",
          fill: "both",
        })
      );
    } else {
      applyClosedPose(geometry);
      items.push(
        animation(openHintRef.current, [{ opacity: 1 }, { opacity: 0 }], {
          duration: 160,
          easing: "ease",
          fill: "both",
        }),
        animation(rootRef.current, [{ transform: pose.transform }, { transform: "none" }], {
          duration: BOOK_TRANSITION.openRootDuration,
          easing: BOOK_TRANSITION.rootEase,
          fill: "both",
        }),
        animation(frontCoverRef.current, [{ transform: coverClosed }, { transform: coverOpen }], {
          delay: BOOK_TRANSITION.openCoverDelay,
          duration: BOOK_TRANSITION.openCoverDuration,
          easing: BOOK_TRANSITION.coverEase,
          fill: "both",
        }),
        animation(movingPagesRef.current, [{ transform: pageEnd }, { transform: "rotateY(0deg)" }], {
          delay: BOOK_TRANSITION.openPagesDelay,
          duration: BOOK_TRANSITION.openPagesDuration,
          easing: BOOK_TRANSITION.paperEase,
          fill: "both",
        }),
        animation(shadowRef.current, [
          { opacity: 0.92, transform: closedShadowTransform },
          { opacity: 0.7, transform: "scaleX(1)" },
        ], {
          duration: BOOK_TRANSITION.openRootDuration,
          easing: BOOK_TRANSITION.rootEase,
          fill: "both",
        }),
        animation(backdropRef.current, [{ opacity: 1 }, { opacity: 0 }], {
          delay: BOOK_TRANSITION.openHandoffDelay,
          duration: BOOK_TRANSITION.openHandoffDuration,
          easing: "ease",
          fill: "both",
        }),
        animation(stageRef.current, [{ opacity: 1 }, { opacity: 0 }], {
          delay: BOOK_TRANSITION.openHandoffDelay,
          duration: BOOK_TRANSITION.openHandoffDuration,
          easing: "ease",
          fill: "both",
        })
      );
    }

    const active = items.filter((item): item is Animation => item !== null);
    timelineRef.current = active;
    if (active.length === 0) {
      if (phase === "closing") {
        applyClosedPose(geometry);
        onCloseFinished();
      } else {
        applyOpenPose();
        onOpenFinished();
      }
      return;
    }
    void Promise.all(active.map((item) => item.finished.catch(() => null))).then(() => {
      if (timelineVersionRef.current !== version) return;
      if (phase === "closing") {
        applyClosedPose(geometry);
        for (const item of active) item.cancel();
        timelineRef.current = [];
        onCloseFinished();
      } else {
        applyOpenPose();
        for (const item of active) item.cancel();
        timelineRef.current = [];
        onOpenFinished();
      }
    });
    return cancelTimeline;
  }, [
    applyClosedPose,
    applyOpenPose,
    cancelTimeline,
    coverClosed,
    coverOpen,
    closedShadowTransform,
    geometry,
    onCloseFinished,
    onOpenFinished,
    pageEnd,
    phase,
    side,
    single,
  ]);

  useEffect(() => cancelTimeline, [cancelTimeline]);

  useEffect(() => {
    if (phase === "closed") openButtonRef.current?.focus({ preventScroll: true });
  }, [phase]);

  if (!geometry) return null;
  const movingSide = single ? "full" : side === "start" ? "right" : "left";
  const receiverSide = single ? "full" : side === "start" ? "left" : "right";
  const movingPage = side === "start" ? rightPage : (leftPage ?? rightPage);
  const receiverPage = side === "start" ? (leftPage ?? rightPage) : rightPage;
  const artFaceClass = single ? "transition-cover-face-front" : "transition-cover-face-back";
  const innerFaceClass = single ? "transition-cover-face-back" : "transition-cover-face-front";

  return (
    <div
      className={`book-transition-overlay fixed inset-0 z-[60] ${phase === "closed" ? "book-transition-closed" : ""}`}
      data-side={side}
      role={phase === "closed" ? "region" : undefined}
      aria-label={phase === "closed" ? "المصحف مغلق" : undefined}
    >
      <div ref={backdropRef} className="book-transition-backdrop absolute inset-0" aria-hidden />
      <div
        ref={stageRef}
        className="book-transition-stage fixed"
        style={{
          top: geometry.book.top,
          left: geometry.book.left,
          width: geometry.book.width,
          height: geometry.book.height,
        }}
      >
        <div ref={rootRef} className="book-transition-root absolute inset-0">
          <div ref={assemblyRef} className="book-transition-assembly absolute inset-0">
            <div ref={shadowRef} className="book-transition-shadow absolute" aria-hidden />
            <div className={`transition-half transition-half-${receiverSide} transition-back-cover absolute`} aria-hidden />
            <div className={`transition-half transition-half-${receiverSide} transition-page-block absolute`} aria-hidden>
              <TransitionPage page={receiverPage} />
              <span className="transition-page-block-edge" />
            </div>
            {!single && (
              <div
                ref={movingPagesRef}
                className={`transition-half transition-half-${movingSide} transition-moving-pages absolute`}
                aria-hidden
              >
                <div className="transition-page-face absolute inset-0">
                  <TransitionPage page={movingPage} />
                </div>
                <div className="transition-page-face transition-page-face-back absolute inset-0">
                  <span className="transition-page-back-paper absolute inset-0" />
                </div>
                <span className="transition-page-block-edge" />
              </div>
            )}
            <button
              ref={frontCoverRef}
              type="button"
              onClick={onOpen}
              aria-label="افتح المصحف"
              tabIndex={phase === "closed" ? 0 : -1}
              className={`transition-half transition-half-${movingSide} transition-front-cover absolute border-0 bg-transparent p-0`}
            >
              <span className={`${innerFaceClass} transition-cover-inner absolute inset-0`} aria-hidden />
              <span className={`${artFaceClass} cover-door transition-cover-art absolute inset-0 flex items-center justify-center overflow-hidden`}>
                <span aria-hidden className="cover-door-ring" />
                <span className="relative flex flex-col items-center gap-3.5 p-6 text-center">
                  <span aria-hidden className="text-sm tracking-[0.3em] text-gold-soft/80">◆ ❖ ◆</span>
                  <span className="font-display text-[clamp(34px,5vw,66px)] font-bold leading-none text-gold-soft">المصحف</span>
                  <span className="font-display text-[clamp(12px,1.4vw,17px)] text-gold-soft/80">مصحف المدينة النبوية</span>
                  <span aria-hidden className="mt-1.5 h-px w-16 bg-gold-soft/55" />
                </span>
              </span>
              <span className="transition-cover-thickness absolute" aria-hidden />
            </button>
            <button
              ref={(node) => {
                openHintRef.current = node;
                openButtonRef.current = node;
              }}
              type="button"
              onClick={onOpen}
              tabIndex={phase === "closed" ? 0 : -1}
              className={`transition-open-hint transition-open-hint-${receiverSide} absolute inline-flex cursor-pointer items-center justify-center rounded-full border border-gold-soft/50 bg-gold-soft/10 px-[26px] py-[11px] text-[15px] text-gold-soft`}
            >
              افتح المصحف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransitionPage({ page }: { page: number }) {
  return (
    <div className="quran-page-surface relative h-full w-full">
      <div className="quran-page-frame absolute inset-[1.05%]">
        <div className="quran-page-image-slot absolute inset-[0.65%]">
          {/* eslint-disable-next-line @next/next/no-img-element -- decoded static transition copy */}
          <img
            src={getPageImageUrl(page)}
            alt=""
            aria-hidden
            width={PAGE_WIDTH}
            height={PAGE_HEIGHT}
            draggable={false}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
