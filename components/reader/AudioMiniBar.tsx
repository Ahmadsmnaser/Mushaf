"use client";

// Floating recitation mini-player, docked on the LEFT edge of the reading
// view (opposite the tafsir drawer). It appears with the first playback and
// then stays — stopping from here must NOT hide it — until the ✕ dismisses
// it. Controls, top to bottom: dismiss, current ayah, previous, play/pause,
// next, stop.

import type { QuranAudioController } from "@/lib/audio/useQuranAudio";

const arNum = (n: number) => n.toLocaleString("ar-EG");

function verseLabel(verseKey: string | null): string {
  const m = verseKey ? /^(\d+):(\d+)$/.exec(verseKey) : null;
  return m ? `${arNum(Number(m[1]))}:${arNum(Number(m[2]))}` : "—";
}

function playbackLabel(audio: QuranAudioController): string {
  if (audio.playbackMode === "surah" && audio.currentSurahNumber) {
    return `س ${arNum(audio.currentSurahNumber)}`;
  }
  return verseLabel(audio.currentVerseKey);
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="play-icon h-3.5 w-3.5" aria-hidden>
      <path d="M7 5.5v13a.75.75 0 0 0 1.15.63l10-6.5a.75.75 0 0 0 0-1.26l-10-6.5A.75.75 0 0 0 7 5.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <rect x="6.5" y="5.5" width="3.5" height="13" rx="1.2" />
      <rect x="14" y="5.5" width="3.5" height="13" rx="1.2" />
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

/** Next = forward = leftward, like the page turn. */
function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
      <path d="M19 6.5v11L9.5 12z" />
      <rect x="4.5" y="6" width="2" height="12" rx="1" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
      <path d="M5 6.5v11L14.5 12z" />
      <rect x="17.5" y="6" width="2" height="12" rx="1" />
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

function BarButton({
  label,
  onClick,
  disabled,
  accent,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      // Toolbar convention: clicks must not pin focus, or arrow-key page
      // turns get swallowed afterwards.
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`pressable flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-35 ${
        accent
          ? "border border-accent bg-accent/10 text-accent hover:bg-accent/20"
          : "text-ink-soft hover:bg-ink/10 hover:text-accent"
      } ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

export default function AudioMiniBar({ audio }: { audio: QuranAudioController }) {
  const busy = audio.isPlaying || audio.isLoading;

  return (
    // Kept mounted so appearing/dismissing can animate: it slides in from its
    // docked edge with the first playback and eases back out on ✕. Visibility
    // (delayed, in the transition list) removes it from hit-testing after the
    // fade; `inert` keeps the hidden controls out of the tab order.
    <div
      role="group"
      aria-label="مشغل التلاوة"
      aria-hidden={!audio.active}
      inert={!audio.active}
      title={`القارئ: ${audio.reciter.arabicName}`}
      className={`audio-mini-bar fixed left-3 top-1/2 z-[46] flex flex-col items-center gap-0.5 rounded-full border border-gold/30 bg-paper/85 px-1 py-1.5 shadow-[0_10px_34px_-14px_rgba(40,30,14,.45)] backdrop-blur-xl ${
        audio.active
          ? "audio-mini-bar-visible"
          : "audio-mini-bar-hidden"
      }`}
    >
      <BarButton label="إخفاء المشغل" onClick={audio.dismiss}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          className="h-3 w-3"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </BarButton>

      <span aria-hidden className="h-px w-5 bg-gold/25" />

      <span className="py-0.5 text-[10px] leading-none text-ink-soft" dir="rtl">
        {playbackLabel(audio)}
      </span>

      <BarButton label="الآية السابقة" onClick={audio.prev} disabled={!audio.hasPrev}>
        <PrevIcon />
      </BarButton>

      <BarButton
        label={audio.isPlaying ? "إيقاف مؤقت" : "متابعة التلاوة"}
        onClick={audio.isPlaying ? audio.pause : audio.resume}
        disabled={audio.isLoading}
        accent
      >
        {audio.isLoading ? <Spinner /> : audio.isPlaying ? <PauseIcon /> : <PlayIcon />}
      </BarButton>

      <BarButton label="الآية التالية" onClick={audio.next} disabled={!audio.hasNext}>
        <NextIcon />
      </BarButton>

      <span aria-hidden className="h-px w-5 bg-gold/25" />

      <BarButton label="إيقاف التلاوة" onClick={audio.stop} disabled={!busy}>
        <StopIcon />
      </BarButton>
    </div>
  );
}
