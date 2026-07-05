"use client";

import MushafStyleSwitcher from "./MushafStyleSwitcher";
import ThemeSwitcher from "./ThemeSwitcher";
import type { MushafStyle, ReaderTheme } from "@/lib/readerSettings";

const arNum = (n: number) => n.toLocaleString("ar-EG");

function Row({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-baseline justify-between rounded-lg px-2 py-2 text-start transition-colors hover:bg-accent/10"
    >
      <span className="text-sm text-ink">{label}</span>
      {sub && <span className="text-[11px] text-ink-soft">{sub}</span>}
    </button>
  );
}

/**
 * Reading panel: a left drawer opened from the toolbar. Sections: index,
 * bookmarks, theme, reading settings. Kept mounted (translated off-canvas)
 * so the slide animates both ways; the backdrop fades with it.
 */
export default function ReaderSidePanel({
  open,
  onClose,
  onOpenIndex,
  onOpenBookmarks,
  bookmarkCount,
  readerTheme,
  onReaderThemeChange,
  mushafStyle,
  onMushafStyleChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  isFullscreen,
  onToggleFullscreen,
}: {
  open: boolean;
  onClose: () => void;
  onOpenIndex: () => void;
  onOpenBookmarks: () => void;
  bookmarkCount: number;
  readerTheme: ReaderTheme;
  onReaderThemeChange: (t: ReaderTheme) => void;
  mushafStyle: MushafStyle;
  onMushafStyleChange: (style: MushafStyle) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <>
      {/* backdrop (click to close) */}
      <div
        className={`fixed inset-0 z-[44] bg-ink/15 backdrop-blur-[1px] transition-[opacity,visibility] duration-300 motion-reduce:transition-none ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        aria-label="لوحة القراءة"
        aria-hidden={!open}
        // Overlays the reader (never squeezes the book). Desktop: 280px side
        // drawer on a translucent parchment surface; mobile: bottom sheet.
        className={`fixed z-[45] flex flex-col gap-[22px] overflow-y-auto bg-paper/85 px-5 py-[22px] backdrop-blur-2xl backdrop-saturate-105 transition-transform duration-[340ms] ease-[cubic-bezier(.3,.6,.2,1)] motion-reduce:transition-none max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[75svh] max-sm:rounded-t-2xl max-sm:border-t max-sm:border-gold/25 sm:inset-y-0 sm:left-0 sm:w-[280px] sm:max-w-[82vw] sm:border-e sm:border-gold/20 sm:shadow-[24px_0_60px_-30px_rgba(40,30,14,.5)] ${
          open
            ? "translate-x-0 translate-y-0"
            : "max-sm:translate-y-full sm:-translate-x-[101%]"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[22px] text-accent">لوحة القراءة</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/10"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <section>
          <h3 className="mb-1.5 font-display text-[17px] text-accent">الفهرس</h3>
          <Row label="تصفّح السور والأجزاء" sub="Ctrl+K" onClick={onOpenIndex} />
        </section>

        <section>
          <h3 className="mb-1.5 font-display text-[17px] text-accent">العلامات</h3>
          <Row
            label="عرض العلامات"
            sub={bookmarkCount > 0 ? `${arNum(bookmarkCount)} محفوظة` : "لا شيء بعد"}
            onClick={onOpenBookmarks}
          />
        </section>

        <section>
          <h3 className="mb-2 font-display text-[17px] text-accent">ثيم القارئ</h3>
          <ThemeSwitcher theme={readerTheme} onChange={onReaderThemeChange} />
        </section>

        <section>
          <h3 className="mb-2 font-display text-[17px] text-accent">مظهر المصحف</h3>
          <MushafStyleSwitcher
            mushafStyle={mushafStyle}
            onChange={onMushafStyleChange}
          />
        </section>

        <section>
          <h3 className="mb-2 font-display text-[17px] text-accent">إعدادات القراءة</h3>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm text-ink">التكبير</span>
            <span className="flex items-center gap-1.5">
              <button
                onClick={onZoomOut}
                aria-label="تصغير"
                className="h-7 w-7 cursor-pointer rounded-full border border-gold/25 text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                −
              </button>
              <button
                onClick={onResetZoom}
                aria-label="ملاءمة الشاشة"
                title="ملاءمة الشاشة"
                className="h-7 w-14 cursor-pointer rounded-full border border-gold/25 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                {arNum(Math.round(zoom * 100))}٪
              </button>
              <button
                onClick={onZoomIn}
                aria-label="تكبير"
                className="h-7 w-7 cursor-pointer rounded-full border border-gold/25 text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                +
              </button>
            </span>
          </div>
          <Row
            label={isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
            onClick={onToggleFullscreen}
          />
        </section>
      </aside>
    </>
  );
}
