"use client";

import { PAGE_COUNT } from "@/lib/mushaf/source";

/**
 * The physical book around the pages, built from layers rather than a border:
 * a leather cover board peeking out BEHIND the pages (with its own bevel and
 * on-surface shadow), the gilt page-block edges resting on it, and a soft
 * paper-depth overlay on the pages themselves. RTL mechanics: the unread
 * block sits on the LEFT and migrates right as reading advances, matching
 * the corrected flip direction.
 */
export default function BookFrame({
  aspectRatio,
  readPages,
  remainingPages,
  children,
}: {
  aspectRatio: string;
  readPages: number;
  remainingPages: number;
  children: React.ReactNode;
}) {
  return (
    // relative z-20: keeps the whole book (incl. its drag strips) above the
    // viewport-edge NavZones (z-10) in the root stacking context — the inner
    // perspective creates its own stacking context, so inner z-indexes can't.
    <div className="book-enter relative z-20">
      <div aria-hidden className="book-cover-layer" />
      <div className="relative [perspective:2600px]" style={{ aspectRatio }}>
        <PageEdges readPages={readPages} remainingPages={remainingPages} />
        {children}
        {/* paper depth: faint outer-edge and top/bottom bow shading */}
        <div aria-hidden className="page-depth pointer-events-none absolute inset-0 z-20" />
      </div>
    </div>
  );
}

function PageEdges({
  readPages,
  remainingPages,
}: {
  readPages: number;
  remainingPages: number;
}) {
  const MAX_W = 34; // px at full thickness
  const leftW = (remainingPages / PAGE_COUNT) * MAX_W; // unread: left (RTL)
  const rightW = (readPages / PAGE_COUNT) * MAX_W; // read: right
  return (
    <>
      {rightW >= 1 && (
        <div
          aria-hidden
          className="page-edges page-edges-right absolute"
          style={{ top: "1.2%", bottom: "0.8%", right: -rightW, width: rightW }}
        />
      )}
      {leftW >= 1 && (
        <div
          aria-hidden
          className="page-edges page-edges-left absolute"
          style={{ top: "1.2%", bottom: "0.8%", left: -leftW, width: leftW }}
        />
      )}
    </>
  );
}
