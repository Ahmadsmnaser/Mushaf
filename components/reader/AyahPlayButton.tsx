"use client";

// Per-ayah recitation control in the tafsir panel: a small round icon button
// in the entry heading, sized and toned like the gilt AyahMarker beside it so
// the commentary text stays the loudest thing on the surface.

export type AyahPlayState = "idle" | "loading" | "playing";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="play-icon h-3 w-3" aria-hidden>
      <path d="M7 5.5v13a.75.75 0 0 0 1.15.63l10-6.5a.75.75 0 0 0 0-1.26l-10-6.5A.75.75 0 0 0 7 5.5Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
      aria-hidden
    >
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  );
}

export default function AyahPlayButton({
  state,
  onToggle,
}: {
  state: AyahPlayState;
  onToggle: () => void;
}) {
  const active = state !== "idle";
  return (
    <button
      onClick={onToggle}
      // As elsewhere in the panel: mouse clicks must not pin focus on the
      // control, or arrow-key page turns get swallowed afterwards.
      onMouseDown={(e) => e.preventDefault()}
      title={active ? "إيقاف التلاوة" : "تشغيل الآية"}
      aria-label={active ? "إيقاف التلاوة" : "تشغيل الآية"}
      aria-pressed={active}
      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-gold/55 text-ink-soft hover:border-accent/60 hover:text-accent"
      }`}
    >
      {state === "loading" ? <Spinner /> : state === "playing" ? <StopIcon /> : <PlayIcon />}
    </button>
  );
}
