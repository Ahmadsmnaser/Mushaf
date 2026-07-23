"use client";

import { Fragment } from "react";

/**
 * Renders verse text with matched spans wrapped in a subtle mark, by slicing
 * the ORIGINAL text into React nodes — never dangerouslySetInnerHTML, so the
 * Quran text is displayed exactly as stored and no markup can be injected.
 * `ranges` are [start, end) indices into `text`, pre-merged and sorted.
 */
export default function HighlightedVerse({
  text,
  ranges,
  className = "",
}: {
  text: string;
  ranges: [number, number][];
  className?: string;
}) {
  if (ranges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    const from = Math.max(cursor, start);
    if (from > cursor) nodes.push(<Fragment key={`p${i}`}>{text.slice(cursor, from)}</Fragment>);
    if (end > from) {
      nodes.push(
        <mark key={`m${i}`} className="search-hl">
          {text.slice(from, end)}
        </mark>
      );
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < text.length) nodes.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);

  return <span className={className}>{nodes}</span>;
}
