"use client";

/**
 * The closed mushaf: ONE solid book — a leather cover overhanging its page
 * block, a single smooth gilt fore-edge on the side opposite the spine, a
 * darker board peeking below for thickness, and a soft contact shadow
 * grounding it. Rendered INSTEAD of the open spread once settled (Reader
 * unmounts the spread), and briefly over it mid-transition. Mounted fresh
 * for each close/open cycle, so the CSS keyframe animations start clean:
 *
 *   closing — the canvas fades in while the whole book settles into place
 *             (a hint of hinge rotation + scale) and its shadow lands
 *   closed  — the settled book alone; the only interactive surface
 *   opening — the book lifts away first, then the canvas fades out to
 *             reveal the spread waiting behind it
 *
 * `side` mirrors the geometry: closed-from-start puts the spine on the
 * RIGHT (an Arabic book's front cover), closed-from-end on the LEFT.
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
  const spineRight = side === "start";
  const foreSide = spineRight ? "left" : "right";
  // Spine corners round wide (the leather wraps the binding); fore-edge
  // corners stay tight. border-radius order: TL TR BR BL.
  const radius = spineRight ? "7px 16px 16px 7px" : "16px 7px 7px 16px";

  const overlayClass =
    phase === "opening"
      ? "cover-overlay-leave opacity-0"
      : phase === "closing"
        ? "cover-overlay-enter opacity-100"
        : "opacity-100";
  const bookClass =
    phase === "opening"
      ? "book-lift-out"
      : phase === "closing"
        ? "book-settle-in"
        : "";

  return (
    <div
      className={`cover-overlay fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[26px] ${overlayClass}`}
      role={interactive ? "region" : undefined}
      aria-label="المصحف مغلق"
    >
      <div
        className={`relative w-[min(72vw,84svh*0.678)] sm:w-[min(46vw,84svh*0.678)] ${bookClass}`}
        style={{
          aspectRatio: "622 / 917",
          transformOrigin: spineRight ? "right center" : "left center",
          ["--hinge-deg" as string]: spineRight ? "-7deg" : "7deg",
        }}
      >
        {/* soft contact shadow where the book meets the surface */}
        <div aria-hidden className="cover-desk-shadow" />

        {/* the back board, offset a touch down and toward the fore-edge —
            the book's thickness read at its silhouette */}
        <div
          aria-hidden
          className="cover-board-under absolute inset-0"
          style={{
            borderRadius: radius,
            transform: `translate(${spineRight ? "-2px" : "2px"}, 3.5px)`,
          }}
        />

        {/* the closed page block seen edge-on: one smooth gilt surface under
            the cover's overhang — never stripes, never Quran content */}
        <div
          aria-hidden
          className={`fore-edge fore-edge-${foreSide} absolute`}
          style={{ top: "2%", bottom: "1.6%", [foreSide]: "-1.5%", width: "1.5%" }}
        />

        {/* the cover itself — the whole board is the reopen affordance */}
        <button
          onClick={onOpen}
          aria-label="افتح المصحف"
          tabIndex={interactive ? 0 : -1}
          className="cover-door absolute inset-0 flex cursor-pointer items-center justify-center overflow-hidden border-0 p-0"
          style={{ borderRadius: radius }}
        >
          <span
            aria-hidden
            className={`cover-spine-hint cover-spine-hint-${spineRight ? "right" : "left"}`}
          />
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
