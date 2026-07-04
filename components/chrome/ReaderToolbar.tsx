"use client";

import Link from "next/link";

const arNum = (n: number) => n.toLocaleString("ar-EG");

function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const paths = {
  home: "M4 11l8-7 8 7M6 9.5V20h12V9.5",
  chevRight: "M9 6l6 6-6 6",
  chevLeft: "M15 6l-6 6 6 6",
  bookmark: "M7 3h10v18l-5-4-5 4z",
  bookmarkFilled: "M7 3h10v18l-5-4-5 4z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
  expand: "M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4",
  shrink: "M4 8h4V4M20 8h-4V4M4 16h4v4M20 16h-4v4",
  sliders: "M4 8h10M18 8h2M14 8v0M4 16h2M10 16h10M10 16v0M14 6v4M10 14v4",
} as const;

function ToolButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-default disabled:opacity-30 ${
        active ? "text-accent" : "text-ink-soft hover:bg-accent/10 hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Floating bottom toolbar. Fades away while reading (idle) and returns on any
 * pointer/keyboard activity; keyboard focus always brings it back.
 */
export default function ReaderToolbar({
  idle,
  caption,
  onPrev,
  onNext,
  canPrev,
  canNext,
  bookmarked,
  onToggleBookmark,
  onOpenJump,
  onOpenBookmarks,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  canZoomIn,
  canZoomOut,
  isFullscreen,
  onToggleFullscreen,
  onOpenPanel,
}: {
  idle: boolean;
  caption: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenJump: () => void;
  onOpenBookmarks: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenPanel: () => void;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-3 z-40 flex justify-center transition-opacity duration-500 motion-reduce:transition-none ${
        idle ? "opacity-0" : "opacity-100"
      } focus-within:opacity-100 hover:opacity-100`}
    >
      <div
        className="flex max-w-[96vw] items-center gap-0.5 overflow-x-auto rounded-full border border-gold/25 bg-sheet/90 px-2 py-1 shadow-lg backdrop-blur-sm"
        // Mouse clicks shouldn't leave focus pinned on a button (which would
        // hold the toolbar visible via focus-within); keyboard focus still does.
        onMouseDown={(e) => e.preventDefault()}
      >
        <Link
          href="/"
          aria-label="الصفحة الرئيسية"
          title="الصفحة الرئيسية"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent"
        >
          <Icon d={paths.home} />
        </Link>

        <span className="mx-1 h-5 w-px shrink-0 bg-gold/25" aria-hidden />

        {/* RTL book: advancing moves rightward — the right-facing button on
            the right side of the caption is NEXT */}
        <ToolButton label="الصفحة التالية" onClick={onNext} disabled={!canNext}>
          <Icon d={paths.chevRight} />
        </ToolButton>

        <button
          onClick={onOpenJump}
          title="الانتقال السريع (Ctrl+K)"
          className="flex h-9 shrink cursor-pointer items-baseline gap-2 truncate rounded-full px-3 text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent"
        >
          {caption}
        </button>

        <ToolButton label="الصفحة السابقة" onClick={onPrev} disabled={!canPrev}>
          <Icon d={paths.chevLeft} />
        </ToolButton>

        <span className="mx-1 h-5 w-px shrink-0 bg-gold/25" aria-hidden />

        <ToolButton
          label={bookmarked ? "احذف العلامة (B)" : "أضف علامة (B)"}
          onClick={onToggleBookmark}
          active={bookmarked}
        >
          <svg
            viewBox="0 0 24 24"
            fill={bookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
            aria-hidden
          >
            <path d={paths.bookmark} />
          </svg>
        </ToolButton>

        <ToolButton label="العلامات" onClick={onOpenBookmarks}>
          <Icon d={paths.list} />
        </ToolButton>

        <span className="mx-1 hidden h-5 w-px shrink-0 bg-gold/25 sm:block" aria-hidden />

        <div className="hidden items-center sm:flex">
          <ToolButton label="تصغير" onClick={onZoomOut} disabled={!canZoomOut}>
            <Icon d={paths.minus} />
          </ToolButton>
          <button
            onClick={onResetZoom}
            title="ملاءمة الشاشة"
            aria-label="ملاءمة الشاشة"
            className="h-9 w-12 shrink-0 cursor-pointer rounded-full text-xs text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent"
          >
            {arNum(Math.round(zoom * 100))}٪
          </button>
          <ToolButton label="تكبير" onClick={onZoomIn} disabled={!canZoomIn}>
            <Icon d={paths.plus} />
          </ToolButton>
        </div>

        <ToolButton
          label={isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
          onClick={onToggleFullscreen}
        >
          <Icon d={isFullscreen ? paths.shrink : paths.expand} />
        </ToolButton>

        {/* mobile only: the desktop side tab is hidden there */}
        <span className="sm:hidden">
          <ToolButton label="لوحة القراءة" onClick={onOpenPanel}>
            <Icon d={paths.sliders} />
          </ToolButton>
        </span>
      </div>
    </div>
  );
}
