"use client";

import { scrubberArabicNumber as arNum } from "@/lib/mushaf/pageScrubber";
import type { PageScrubberMetadata } from "@/lib/mushaf/pageScrubber";

/**
 * The calm card that floats above the centred preview number while scrubbing:
 * page number, Surah name(s), and Juz — resolved entirely from local metadata,
 * never fetched per scrub step. No page thumbnail (by design, first version).
 */
export default function PagePreviewMetadata({
  metadata,
  isBookmarked,
  isLastRead,
  isCurrent,
}: {
  metadata: PageScrubberMetadata;
  isBookmarked: boolean;
  isLastRead: boolean;
  isCurrent: boolean;
}) {
  const surahLabel =
    metadata.surahNamesArabic.length > 2
      ? `${metadata.surahNamesArabic.slice(0, 2).join("، ")}…`
      : metadata.surahNamesArabic.join("، ");

  return (
    <div dir="rtl" className="page-scrubber-card flex flex-col items-center gap-0.5 text-center">
      <span className="font-display text-[15px] leading-none text-ink">
        صفحة {arNum(metadata.pageNumber)}
      </span>
      <span className="font-display text-[13px] leading-tight text-accent">
        {metadata.surahNamesArabic.length > 1 ? "سور " : "سورة "}
        {surahLabel}
      </span>
      <span className="text-[10px] leading-none text-ink-soft">
        الجزء {arNum(metadata.juzNumber)}
      </span>
      {(isBookmarked || isLastRead || isCurrent) && (
        <span className="mt-0.5 flex items-center gap-2 text-[9px] text-ink-soft">
          {isCurrent && (
            <span className="flex items-center gap-0.5">
              <span aria-hidden className="text-accent">
                ●
              </span>
              الحالية
            </span>
          )}
          {isLastRead && (
            <span className="flex items-center gap-0.5">
              <span aria-hidden className="text-accent">
                ◎
              </span>
              آخر قراءة
            </span>
          )}
          {isBookmarked && (
            <span className="flex items-center gap-0.5">
              <span aria-hidden className="text-gold">
                ◆
              </span>
              معلّمة
            </span>
          )}
        </span>
      )}
    </div>
  );
}
