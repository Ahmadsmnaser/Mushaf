"use client";

/**
 * The open mushaf's paper surface — deliberately quiet so nothing competes
 * with the page. No cover boards, no page-stack edges: just the sheet itself
 * with a hairline frame, soft shadows lifting it off the desk, and an
 * elliptical contact shadow beneath. The gutter/spine shading lives with the
 * spread itself (SpreadShading in Reader); close/open physics live in the
 * measured BookTransitionLayer so this reading surface stays mounted.
 */
export default function BookFrame({
  aspectRatio,
  children,
}: {
  aspectRatio: string;
  children: React.ReactNode;
}) {
  return (
    // relative z-20: keeps the sheet (incl. its drag strips) above the
    // viewport-edge NavZones (z-10) in the root stacking context — the inner
    // perspective creates its own stacking context, so inner z-indexes can't.
    <div className="book-enter relative z-20">
      {/* soft elliptical shadow where the book meets the surface */}
      <div aria-hidden className="desk-shadow" />
      <div
        className="paper-sheet relative [perspective:2800px]"
        style={{ aspectRatio }}
      >
        {children}
        {/* paper depth: faint outer-edge and top/bottom bow shading */}
        <div
          aria-hidden
          className="page-depth pointer-events-none absolute inset-0 z-20"
        />
      </div>
    </div>
  );
}
