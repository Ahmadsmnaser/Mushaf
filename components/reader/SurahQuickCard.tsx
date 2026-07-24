"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SurahMeta } from "@/lib/mushaf/source";
import type { QuranAudioController } from "@/lib/audio/useQuranAudio";
import type { MenuAnchorRect } from "./AyahOverlay";
import {
  bareSurahName,
  revelationPlaceLabel,
  type SurahCopyFormat,
} from "@/lib/surah";
import { useOverlayFocus } from "@/components/motion/useOverlayFocus";

const arNum = (n: number) => n.toLocaleString("ar-EG");
const GAP = 10;
const EDGE = 12;

export default function SurahQuickCard({
  open,
  meta,
  anchor,
  currentAyah,
  audio,
  onClose,
  onNavigate,
  onCopy,
  onShare,
  onOpenGuide,
}: {
  open: boolean;
  meta: SurahMeta;
  anchor: MenuAnchorRect;
  currentAyah: number;
  audio: QuranAudioController;
  onClose: (restoreFocus: boolean) => void;
  onNavigate: () => void;
  onCopy: (format: SurahCopyFormat) => Promise<void>;
  onShare: () => Promise<void>;
  onOpenGuide: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchor.left, top: anchor.bottom + GAP });
  const [copyFormat, setCopyFormat] = useState<SurahCopyFormat>("text");
  const [copying, setCopying] = useState(false);
  const chapterActive =
    audio.playbackMode === "surah" && audio.currentSurahNumber === meta.id;
  const chapterBusy = chapterActive && (audio.isPlaying || audio.isLoading);

  useOverlayFocus(open, true, cardRef, () => onClose(true));

  useLayoutEffect(() => {
    const place = () => {
      const card = cardRef.current;
      if (!card) return;
      const width = card.offsetWidth;
      const height = card.offsetHeight;
      const candidates = [
        {
          left: anchor.left + anchor.width / 2 - width / 2,
          top: anchor.bottom + GAP,
        },
        {
          left: anchor.left + anchor.width / 2 - width / 2,
          top: anchor.top - height - GAP,
        },
      ];
      const candidate =
        candidates.find(
          (item) =>
            item.left >= EDGE &&
            item.top >= EDGE &&
            item.left + width <= window.innerWidth - EDGE &&
            item.top + height <= window.innerHeight - EDGE
        ) ?? candidates[0];
      setPosition({
        left: Math.min(Math.max(EDGE, candidate.left), window.innerWidth - width - EDGE),
        top: Math.min(Math.max(EDGE, candidate.top), window.innerHeight - height - EDGE),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) onClose(true);
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [onClose, open]);

  const runCopy = async () => {
    setCopying(true);
    try {
      await onCopy(copyFormat);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label={`بطاقة سورة ${bareSurahName(meta.name_ar)}`}
      aria-hidden={!open}
      inert={!open}
      dir="rtl"
      tabIndex={-1}
      className={`surah-quick-card fixed z-[90] w-[min(23rem,calc(100vw-24px))] rounded-2xl border border-gold/30 bg-sheet/95 p-3 text-ink shadow-2xl backdrop-blur-md ${
        open ? "surah-quick-card-visible" : ""
      }`}
      style={{ left: position.left, top: position.top }}
    >
      <header className="rounded-xl border border-gold/25 px-3 py-2.5 text-center">
        <p className="font-display text-xl text-accent">
          سورة {bareSurahName(meta.name_ar)}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          السورة {arNum(meta.id)} · {revelationPlaceLabel(meta.revelation_place)} ·{" "}
          {arNum(meta.ayah_count)} آية
        </p>
      </header>

      <dl className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
        <div className="rounded-lg bg-ink/[.035] px-2.5 py-2">
          <dt className="text-ink-soft">الصفحات</dt>
          <dd className="mt-0.5">
            {meta.first_page === meta.last_page
              ? arNum(meta.first_page)
              : `${arNum(meta.first_page)}–${arNum(meta.last_page)}`}
          </dd>
        </div>
        <div className="rounded-lg bg-ink/[.035] px-2.5 py-2">
          <dt className="text-ink-soft">موضع القراءة</dt>
          <dd className="mt-0.5">
            الآية {arNum(currentAyah)} من {arNum(meta.ayah_count)}
          </dd>
        </div>
      </dl>

      <button
        data-autofocus
        type="button"
        aria-pressed={chapterBusy}
        onClick={() => audio.toggleSurah(meta.id)}
        className="pressable mt-2.5 flex w-full cursor-pointer items-center justify-between rounded-xl border border-accent/45 bg-accent/10 px-3 py-2 text-sm text-accent hover:bg-accent/15"
      >
        <span>
          {audio.isLoading && chapterActive
            ? "جارٍ تجهيز السورة…"
            : chapterBusy
              ? "إيقاف مؤقت"
              : chapterActive
                ? "متابعة تشغيل السورة"
                : "تشغيل السورة"}
        </span>
        <span className="text-[11px] text-ink-soft">{audio.reciter.arabicName}</span>
      </button>
      {chapterActive && audio.error && (
        <p role="alert" className="mt-1.5 text-center text-xs leading-5 text-ink-soft">
          {audio.error}
        </p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <ActionButton onClick={onNavigate}>الانتقال إلى البداية</ActionButton>
        <ActionButton onClick={() => void onShare()}>مشاركة الرابط</ActionButton>
      </div>

      <div className="mt-2 rounded-xl border border-gold/20 p-2">
        <label htmlFor={`surah-copy-${meta.id}`} className="text-xs text-ink-soft">
          صيغة نسخ السورة
        </label>
        <div className="mt-1.5 flex gap-1.5">
          <select
            id={`surah-copy-${meta.id}`}
            value={copyFormat}
            onChange={(event) => setCopyFormat(event.target.value as SurahCopyFormat)}
            className="min-w-0 flex-1 rounded-lg border border-gold/25 bg-paper px-2 py-1.5 text-xs"
          >
            <option value="text">النص فقط</option>
            <option value="numbered">النص مع أرقام الآيات</option>
            <option value="named">النص مع اسم السورة</option>
          </select>
          <button
            type="button"
            disabled={copying}
            onClick={() => void runCopy()}
            className="pressable cursor-pointer rounded-lg border border-gold/30 px-3 py-1.5 text-xs hover:border-accent/60 hover:text-accent disabled:cursor-default disabled:opacity-50"
          >
            {copying ? "جارٍ النسخ…" : "نسخ"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenGuide}
        className="pressable mt-2 w-full cursor-pointer rounded-xl px-3 py-2 text-sm text-accent hover:bg-accent/10"
      >
        معلومات السورة ←
      </button>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable cursor-pointer rounded-xl px-3 py-2 text-right text-sm hover:bg-accent/10 hover:text-accent"
    >
      {children}
    </button>
  );
}

