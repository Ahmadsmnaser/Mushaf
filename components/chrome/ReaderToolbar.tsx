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
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  bookOpen:
    "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
  expand: "M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4",
  shrink: "M4 8h4V4M20 8h-4V4M4 16h4v4M20 16h-4v4",
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
      className={`pressable flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-default disabled:opacity-30 ${
        active ? "text-accent" : "text-ink-soft hover:bg-accent/10 hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Divider({ className = "" }: { className?: string }) {
  return (
    <span
      className={`mx-1 h-5 w-px shrink-0 bg-gold/25 lg:mx-0 lg:my-1 lg:h-px lg:w-5 ${className}`}
      aria-hidden
    />
  );
}

/**
 * Floating reader toolbar. Desktop presents it as a right-side control rail;
 * smaller screens keep a compact bottom bar so controls remain touch-friendly.
 */
export default function ReaderToolbar({
  idle,
  hidden = false,
  caption,
  captionLabel,
  onPrev,
  onNext,
  bookmarked,
  onToggleBookmark,
  onOpenJump,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  canZoomIn,
  canZoomOut,
  isFullscreen,
  onToggleFullscreen,
  onOpenPanel,
  onOpenTafsir,
}: {
  idle: boolean;
  hidden?: boolean;
  caption: React.ReactNode;
  captionLabel: string;
  onPrev: () => void;
  onNext: () => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenJump: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenPanel: () => void;
  onOpenTafsir: () => void;
}) {
  return (
    <div
      className={`reader-toolbar-shell ${
        hidden ? "reader-toolbar-closed" : idle ? "reader-toolbar-idle" : "reader-toolbar-awake"
      }`}
    >
      {/* soft canvas glow behind the controls */}
      <div aria-hidden className="reader-toolbar-glow pointer-events-none absolute" />

      <div
        className="reader-toolbar-panel relative flex max-w-[96vw] items-center gap-0.5 overflow-x-auto rounded-full border border-gold/30 bg-sheet/80 px-2 py-[5px] shadow-[0_10px_30px_-12px_rgba(40,30,14,.4),inset_0_1px_0_rgba(255,255,255,.5)] backdrop-blur-[10px] backdrop-saturate-[1.1] lg:max-h-[min(78svh,640px)] lg:w-[52px] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:px-[5px] lg:py-2"
        // Mouse clicks shouldn't leave focus pinned on a button (which would
        // hold the toolbar visible via focus-within); keyboard focus still does.
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          onClick={onOpenJump}
          title="الانتقال السريع (Ctrl+K)"
          className="reader-toolbar-caption pressable flex h-9 shrink cursor-pointer items-baseline justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-3.5 text-ink-soft hover:bg-accent/10 hover:text-accent sm:w-[220px] lg:h-auto lg:w-10 lg:flex-col lg:items-center lg:gap-1 lg:px-1.5 lg:py-2"
        >
          {caption}
          <span className="reader-toolbar-caption-popover" dir="rtl">
            {captionLabel}
          </span>
        </button>

        <Link
          href="/"
          aria-label="الرئيسية"
          title="الرئيسية"
          className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-accent/10 hover:text-accent"
        >
          <Icon d={paths.home} />
        </Link>

        <Divider />

        {/* Reader mapping: left arrow advances, right arrow returns. */}
        <ToolButton label="الصفحة التالية" onClick={onNext}>
          <Icon d={paths.chevLeft} />
        </ToolButton>

        <ToolButton label="الصفحة السابقة" onClick={onPrev}>
          <Icon d={paths.chevRight} />
        </ToolButton>

        <Divider />

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

        <ToolButton label="التفسير" onClick={onOpenTafsir}>
          <Icon d={paths.bookOpen} />
        </ToolButton>

        <ToolButton label="لوحة القراءة" onClick={onOpenPanel}>
          <Icon d={paths.list} />
        </ToolButton>

        <Divider className="hidden sm:block" />

        <div className="hidden items-center sm:flex lg:flex-col">
          <ToolButton label="تصغير" onClick={onZoomOut} disabled={!canZoomOut}>
            <Icon d={paths.minus} />
          </ToolButton>
          <button
            onClick={onResetZoom}
            title="ملاءمة الشاشة"
            aria-label="ملاءمة الشاشة"
            className="pressable h-9 w-[46px] shrink-0 cursor-pointer rounded-full text-xs text-ink-soft hover:bg-accent/10 hover:text-accent lg:w-10"
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
      </div>
    </div>
  );
}
