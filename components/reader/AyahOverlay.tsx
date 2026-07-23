"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getPageAyahRegions } from "@/lib/mushaf/ayahRegions.client";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/lib/mushaf/source";
import type { AyahOverlayRecord, VerseKey } from "@/lib/mushaf/ayahRegions";

export interface MenuAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const copyRect = (rect: DOMRect): MenuAnchorRect => ({
  left: rect.left,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
  width: rect.width,
  height: rect.height,
});

export default function AyahOverlay({
  page,
  enabled,
  imageReady,
  hoveredVerseKey,
  focusedVerseKey,
  selectedVerseKey,
  onHover,
  onFocus,
  onActivate,
  onRecords,
}: {
  page: number;
  enabled: boolean;
  imageReady: boolean;
  hoveredVerseKey: VerseKey | null;
  focusedVerseKey: VerseKey | null;
  selectedVerseKey: VerseKey | null;
  onHover: (verseKey: VerseKey | null) => void;
  onFocus: (verseKey: VerseKey | null) => void;
  onActivate: (
    record: AyahOverlayRecord,
    anchor: MenuAnchorRect,
    trigger: HTMLButtonElement | null
  ) => void;
  onRecords: (page: number, records: AyahOverlayRecord[]) => void;
}) {
  const [loaded, setLoaded] = useState<{
    page: number;
    records: AyahOverlayRecord[];
  } | null>(null);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const segmentRefs = useRef(new Map<string, SVGRectElement>());
  const buttonRefs = useRef(new Map<VerseKey, HTMLButtonElement>());

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void getPageAyahRegions(page)
      .then((next) => {
        if (!alive) return;
        setLoaded({ page, records: next });
        setFailedPage((failed) => (failed === page ? null : failed));
        onRecords(page, next);
      })
      .catch(() => {
        if (!alive) return;
        setFailedPage(page);
        onRecords(page, []);
      });
    return () => {
      alive = false;
    };
  }, [enabled, onRecords, page]);

  const debug = useMemo(
    () =>
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("overlayDebug") === "1",
    []
  );

  const records = loaded?.page === page ? loaded.records : null;
  if (!enabled || !imageReady || failedPage === page || !records?.length) return null;

  const activateFromKeyboard = (record: AyahOverlayRecord) => {
    const lastIndex = record.regions.length - 1;
    const segment = segmentRefs.current.get(`${record.verseKey}-${lastIndex}`);
    if (!segment) return;
    onActivate(
      record,
      copyRect(segment.getBoundingClientRect()),
      buttonRefs.current.get(record.verseKey) ?? null
    );
  };

  return (
    <div className="ayah-overlay pointer-events-none absolute inset-0 z-20" data-page={page}>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
        preserveAspectRatio="none"
      >
        {records.flatMap((record) =>
          record.regions.map((region, index) => {
            const state =
              selectedVerseKey === record.verseKey
                ? "selected"
                : focusedVerseKey === record.verseKey
                  ? "focused"
                  : hoveredVerseKey === record.verseKey
                    ? "hovered"
                    : "idle";
            return (
              <g key={`${record.verseKey}-${index}`}>
                <rect
                  ref={(element) => {
                    const key = `${record.verseKey}-${index}`;
                    if (element) segmentRefs.current.set(key, element);
                    else segmentRefs.current.delete(key);
                  }}
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  rx={2}
                  className="ayah-region pointer-events-auto"
                  data-state={state}
                  data-verse-key={record.verseKey}
                  data-segment-index={index}
                  style={{ touchAction: "manipulation" }}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") onHover(record.verseKey);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") onHover(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onActivate(record, copyRect(event.currentTarget.getBoundingClientRect()), null);
                  }}
                />
                {debug && (
                  <text x={region.x + 2} y={region.y + 10} className="ayah-debug-label">
                    {record.verseKey}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>
      <div className="sr-only">
        {records.map((record) => (
          <button
            key={record.verseKey}
            ref={(element) => {
              if (element) buttonRefs.current.set(record.verseKey, element);
              else buttonRefs.current.delete(record.verseKey);
            }}
            type="button"
            aria-label={`الآية ${record.ayahNumber} من السورة ${record.surahNumber}`}
            onFocus={() => onFocus(record.verseKey)}
            onBlur={() => onFocus(null)}
            onClick={() => activateFromKeyboard(record)}
          >
            {record.text}
          </button>
        ))}
      </div>
    </div>
  );
}
