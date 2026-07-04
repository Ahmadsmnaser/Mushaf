"use client";

import ThemeSwitcher from "./ThemeSwitcher";
import type { ReaderTheme } from "@/lib/useReaderTheme";

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
      className="flex w-full cursor-pointer items-baseline justify-between rounded-md px-2 py-2 text-start transition-colors hover:bg-accent/10"
    >
      <span className="text-sm text-ink">{label}</span>
      {sub && <span className="text-xs text-ink-soft">{sub}</span>}
    </button>
  );
}

/**
 * Collapsed-by-default side panel, opened by a small vertical tab on the left
 * edge. Sections: index, bookmarks, theme, reading settings.
 */
export default function ReaderSidePanel({
  open,
  onToggle,
  onOpenIndex,
  onOpenBookmarks,
  bookmarkCount,
  theme,
  onThemeChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  isFullscreen,
  onToggleFullscreen,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  onOpenIndex: () => void;
  onOpenBookmarks: () => void;
  bookmarkCount: number;
  theme: ReaderTheme;
  onThemeChange: (t: ReaderTheme) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <>
      {/* vertical tab, always visible */}
      <button
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-label={open ? "أغلق اللوحة الجانبية" : "افتح اللوحة الجانبية"}
        title={open ? "أغلق اللوحة الجانبية" : "اللوحة الجانبية"}
        className={`fixed top-1/2 z-50 flex h-20 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-e-lg border border-s-0 border-gold/30 bg-sheet/90 text-ink-soft shadow-md backdrop-blur-sm transition-all duration-300 motion-reduce:transition-none hover:text-accent max-sm:hidden ${
          open ? "left-[280px]" : "left-0"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? "" : "rotate-180"}`}
          aria-hidden
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      {/* backdrop (click to close) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/20"
          onClick={() => onToggle(false)}
          aria-hidden
        />
      )}

      <aside
        aria-label="لوحة القراءة"
        aria-hidden={!open}
        // Overlays the reader (never squeezes the book). Desktop: 280px side
        // drawer on a translucent parchment surface; mobile: bottom sheet.
        className={`fixed z-50 flex flex-col gap-5 overflow-y-auto bg-paper/85 p-5 shadow-2xl backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[75svh] max-sm:rounded-t-2xl max-sm:border-t max-sm:border-gold/25 sm:inset-y-0 sm:left-0 sm:w-[280px] sm:border-e sm:border-gold/25 ${
          open
            ? "translate-x-0 translate-y-0"
            : "max-sm:translate-y-full sm:-translate-x-full"
        }`}
      >
        <section>
          <h3 className="mb-1 font-display text-lg text-accent">الفهرس</h3>
          <Row label="تصفّح السور والأجزاء" sub="Ctrl+K" onClick={onOpenIndex} />
        </section>

        <section>
          <h3 className="mb-1 font-display text-lg text-accent">العلامات</h3>
          <Row
            label="عرض العلامات"
            sub={bookmarkCount > 0 ? `${arNum(bookmarkCount)} محفوظة` : "لا شيء بعد"}
            onClick={onOpenBookmarks}
          />
        </section>

        <section>
          <h3 className="mb-2 font-display text-lg text-accent">الثيم</h3>
          <ThemeSwitcher theme={theme} onChange={onThemeChange} />
          <p className="mt-2 text-[11px] leading-5 text-ink-soft">
            يتغيّر محيط القراءة فقط — صفحة المصحف تبقى كما هي.
          </p>
        </section>

        <section>
          <h3 className="mb-2 font-display text-lg text-accent">إعدادات القراءة</h3>
          <div className="flex items-center justify-between rounded-md px-2 py-1.5">
            <span className="text-sm text-ink">التكبير</span>
            <span className="flex items-center gap-1">
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
