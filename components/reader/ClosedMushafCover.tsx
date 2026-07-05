"use client";

/**
 * The closed mushaf: a premium green leather cover, rendered INSTEAD of the
 * open spread once settled (Reader unmounts the spread), and briefly over it
 * mid-swing. Mounted fresh for each close/open cycle, so the CSS keyframe
 * animations always start clean:
 *
 *   closing — the canvas fades in fast while the cover door swings shut
 *   closed  — the settled cover alone; the only interactive surface
 *   opening — the door swings open first, then the canvas fades away to
 *             reveal the spread waiting behind it
 *
 * Under the door sits a bare flyleaf — never Quran page imagery.
 */
export default function ClosedMushafCover({
  phase,
  side,
  onOpen,
}: {
  phase: "closing" | "closed" | "opening";
  side: "start" | "end";
  onOpen: () => void;
}) {
  const interactive = phase === "closed";
  const overlayClass =
    phase === "opening"
      ? "cover-overlay-leave opacity-0"
      : phase === "closing"
        ? "cover-overlay-enter opacity-100"
        : "opacity-100";
  const doorClass =
    phase === "opening"
      ? "door-swing-open"
      : phase === "closing"
        ? "door-swing-shut"
        : "";

  return (
    <div
      className={`cover-overlay fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[26px] ${overlayClass}`}
      role={interactive ? "region" : undefined}
      aria-label="المصحف مغلق"
    >
      <div
        className="relative w-[min(72vw,84svh*0.678)] [perspective:2400px] sm:w-[min(46vw,84svh*0.678)]"
        style={{ aspectRatio: "622 / 917" }}
      >
        {/* the closed page block: a bare flyleaf and gilt edges — no Quran content */}
        <div aria-hidden className="closed-paper absolute inset-0" />
        <div
          aria-hidden
          className="page-edges page-edges-left absolute"
          style={{ top: "2%", bottom: "1.5%", left: -9, width: 9 }}
        />
        <div
          aria-hidden
          className="page-edges page-edges-right absolute"
          style={{ top: "2%", bottom: "1.5%", right: -9, width: 9 }}
        />

        {/* the cover as a door hinged at the spine; two faces so the swing
            stays visible through the whole turn */}
        <button
          onClick={onOpen}
          aria-label="افتح المصحف"
          tabIndex={interactive ? 0 : -1}
          className={`cover-door-shell absolute inset-0 cursor-pointer rounded-[10px] border-0 bg-transparent p-0 ${doorClass}`}
          style={{
            ["--door-deg" as string]: side === "start" ? "-108deg" : "108deg",
            transformOrigin: side === "start" ? "right center" : "left center",
            transform:
              phase === "opening" ? "rotateY(var(--door-deg))" : "rotateY(0deg)",
          }}
        >
          <span className="cover-door absolute inset-0 flex items-center justify-center overflow-hidden rounded-[10px] [backface-visibility:hidden]">
            <span aria-hidden className="cover-door-ring" />
            <span className="relative flex flex-col items-center gap-3.5 p-6 text-center">
              <span
                aria-hidden
                className="text-sm tracking-[0.3em] text-gold-soft/80"
              >
                ◆ ❖ ◆
              </span>
              <span
                className="font-display font-bold leading-none text-gold-soft"
                style={{ fontSize: "clamp(38px, 7vw, 72px)" }}
              >
                المصحف
              </span>
              <span
                className="font-display text-gold-soft/80"
                style={{ fontSize: "clamp(13px, 1.8vw, 18px)" }}
              >
                مصحف المدينة النبوية
              </span>
              <span aria-hidden className="mt-1.5 h-px w-16 bg-gold-soft/55" />
            </span>
          </span>
          <span
            aria-hidden
            className="cover-door-back absolute inset-0 rounded-[10px] [backface-visibility:hidden] [transform:rotateY(180deg)]"
          />
        </button>
      </div>

      <button
        onClick={onOpen}
        tabIndex={interactive ? 0 : -1}
        className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-gold-soft/50 bg-gold-soft/10 px-[26px] py-[11px] text-[15px] text-gold-soft transition-colors hover:bg-gold-soft/20"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
          aria-hidden
        >
          <path d="M12 6.5C10 5 6.5 4.7 4 5.2V19c2.5-.5 6-.2 8 1.3 2-1.5 5.5-1.8 8-1.3V5.2c-2.5-.5-6-.2-8 1.3zM12 6.5V20" />
        </svg>
        افتح المصحف
      </button>
    </div>
  );
}
