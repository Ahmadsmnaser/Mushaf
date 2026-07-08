"use client";

// «تشغيل الصفحة» — sequential recitation of every ayah listed in the tafsir
// panel. Styled like the panel's source-picker pills so the audio row reads
// as panel chrome, not as a competing feature.

export default function PagePlayButton({
  playing,
  disabled,
  onToggle,
}: {
  /** True while page playback is active (loading or sounding). */
  playing: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      aria-pressed={playing}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors disabled:cursor-default disabled:opacity-45 ${
        playing
          ? "border-accent bg-accent/10 text-accent"
          : "border-gold/25 text-ink-soft hover:border-accent/50 hover:text-accent"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="play-icon h-3 w-3" aria-hidden>
        {playing ? (
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
        ) : (
          <path d="M7 5.5v13a.75.75 0 0 0 1.15.63l10-6.5a.75.75 0 0 0 0-1.26l-10-6.5A.75.75 0 0 0 7 5.5Z" />
        )}
      </svg>
      {playing ? "إيقاف التلاوة" : "تشغيل الصفحة"}
    </button>
  );
}
