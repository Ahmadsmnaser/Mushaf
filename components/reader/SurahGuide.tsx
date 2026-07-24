"use client";

import { useRef } from "react";
import { usePresence } from "@/components/motion/Presence";
import { useOverlayFocus } from "@/components/motion/useOverlayFocus";
import { MOTION } from "@/lib/motion";
import type { SurahMeta } from "@/lib/mushaf/source";
import { bareSurahName, revelationPlaceLabel } from "@/lib/surah";
import { useSurahGuide } from "@/lib/surahGuide/useSurahGuide";
import type { SurahGuideSection } from "@/lib/surahGuide/types";

const arNum = (n: number) => n.toLocaleString("ar-EG");

export default function SurahGuide({
  open,
  meta,
  onClose,
  onNavigate,
}: {
  open: boolean;
  meta: SurahMeta | null;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const presence = usePresence(open && Boolean(meta), MOTION.duration.panel);
  const panelRef = useRef<HTMLElement>(null);
  useOverlayFocus(open && Boolean(meta), presence.mounted, panelRef, onClose);
  const { state, retry } = useSurahGuide(meta?.id ?? null, open);

  if (!presence.mounted || !meta) return null;
  const interactive = open && presence.phase !== "exiting";

  return (
    <>
      <div
        className={`drawer-backdrop drawer-backdrop-present fixed inset-0 z-[47] bg-ink/10 backdrop-blur-[1px] ${
          presence.phase === "visible" ? "drawer-backdrop-open" : "drawer-backdrop-closed"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="complementary"
        aria-label={`دليل سورة ${bareSurahName(meta.name_ar)}`}
        aria-hidden={!interactive}
        inert={!interactive}
        dir="rtl"
        className={`reader-drawer reader-drawer-present reader-drawer-right fixed z-[48] flex flex-col bg-paper/90 backdrop-blur-2xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[82svh] max-sm:rounded-t-2xl max-sm:border-t max-sm:border-gold/25 sm:inset-y-0 sm:right-0 sm:w-[430px] sm:max-w-[88vw] sm:border-e sm:border-gold/20 sm:shadow-[-24px_0_60px_-30px_rgba(40,30,14,.5)] ${
          presence.phase === "visible"
            ? "reader-drawer-open"
            : "reader-drawer-closed-right"
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-[22px]">
          <div>
            <p className="text-[11px] text-ink-soft">دليل السورة</p>
            <h2 className="font-display text-2xl text-accent">
              سورة {bareSurahName(meta.name_ar)}
            </h2>
          </div>
          <button
            data-autofocus
            type="button"
            onClick={onClose}
            aria-label="إغلاق دليل السورة"
            className="pressable flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-ink/10"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <section aria-labelledby="surah-overview-title" className="mt-5">
            <h3 id="surah-overview-title" className="font-display text-lg text-ink">
              نبذة
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Meta label="ترتيب المصحف" value={arNum(meta.id)} />
              <Meta
                label="التصنيف"
                value={revelationPlaceLabel(meta.revelation_place)}
              />
              <Meta label="عدد الآيات" value={arNum(meta.ayah_count)} />
              <Meta label="ترتيب النزول" value={arNum(meta.revelation_order)} />
              <Meta
                label="صفحات المصحف"
                value={
                  meta.first_page === meta.last_page
                    ? arNum(meta.first_page)
                    : `${arNum(meta.first_page)}–${arNum(meta.last_page)}`
                }
              />
            </dl>
            <button
              type="button"
              onClick={onNavigate}
              className="pressable mt-3 cursor-pointer rounded-full border border-accent/50 px-4 py-1.5 text-sm text-accent hover:bg-accent/10"
            >
              الانتقال إلى بداية السورة
            </button>
          </section>

          {state.status === "loading" && <GuideLoading />}

          {state.status === "error" && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-gold/25 bg-ink/[.025] px-4 py-4 text-center"
            >
              <p className="text-sm leading-7 text-ink-soft">{state.message}</p>
              <button
                type="button"
                onClick={retry}
                className="pressable mt-2 cursor-pointer rounded-full border border-accent/50 px-4 py-1.5 text-sm text-accent hover:bg-accent/10"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {state.status === "success" && (
            <div className="mt-6 space-y-7">
              {state.data.sections.map((section) => (
                <EditorialSection key={section.id} section={section} />
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-gold/20 px-5 py-3 text-center text-[11px] leading-5 text-ink-soft">
          البيانات الأساسية: Quranic Universal Library (QUL)
          <span className="block">
            المحتوى التحريري العربي: الموسوعة القرآنية (Quranpedia)
          </span>
        </footer>
      </aside>
    </>
  );
}

function EditorialSection({ section }: { section: SurahGuideSection }) {
  const extended =
    section.id === "virtues" ||
    section.id === "prophetic-guidance" ||
    section.id === "revelation-context";
  if (extended) {
    return (
      <details className="group rounded-xl border border-gold/20 px-3.5 py-3">
        <summary className="cursor-pointer list-none font-display text-lg text-ink marker:hidden">
          <span className="flex items-center justify-between gap-3">
            {section.title}
            <span
              aria-hidden
              className="text-sm text-accent transition-transform group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </span>
        </summary>
        <SectionBody section={section} />
      </details>
    );
  }
  return (
    <section aria-labelledby={`surah-guide-${section.id}`}>
      <h3
        id={`surah-guide-${section.id}`}
        className="font-display text-lg text-ink"
      >
        {section.title}
      </h3>
      <SectionBody section={section} />
    </section>
  );
}

function SectionBody({ section }: { section: SurahGuideSection }) {
  return (
    <>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-8 text-ink">
        {section.text}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-ink-soft">
        المصدر:{" "}
        <a
          href={section.source.resourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline decoration-accent/35 underline-offset-2"
        >
          {section.source.name}
        </a>
        <span> النص معروض كما ورد في المصدر </span> 
              </p>
    </>
  );
}

function GuideLoading() {
  return (
    <div className="mt-6">
      <p role="status" className="text-center text-sm text-ink-soft">
        جارٍ تحميل معلومات السورة…
      </p>
      <div aria-hidden className="mt-4 space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
        <div className="h-3 animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink/[.035] px-3 py-2.5">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
