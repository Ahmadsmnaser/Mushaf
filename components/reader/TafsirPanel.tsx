"use client";

// Tafsir drawer: the book's margin commentary, on the reading-start (right)
// side of the spread. The source is announced on a title plate echoing the
// cover's tooled double frame, and repeated in the footer — the text below
// it is always the source's own words, fetched through /api/tafsir, shown
// exactly as delivered. Mobile gets a bottom sheet, like the reading panel.
// Each entry also carries a small recitation control (real audio streamed
// from the Quran.com CDN via lib/audio). Playback deliberately SURVIVES
// closing the drawer — the reader can listen while looking at the mushaf —
// and only the stop controls (or leaving the reader) silence it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSurahIndex } from "@/lib/mushaf/source";
import { useTafsir } from "@/lib/tafsir/useTafsir";
import type { PageTafsir, TafsirEntry } from "@/lib/tafsir/types";
import type { AyahRef, QuranAudioController } from "@/lib/audio/useQuranAudio";
import AyahPlayButton, { type AyahPlayState } from "./AyahPlayButton";
import PagePlayButton from "./PagePlayButton";

const arNum = (n: number) => n.toLocaleString("ar-EG");

// «سُورَةُ البَقَرَةِ» → «البَقَرَةِ»: the ayah reference has no room for the
// voweled honorific (same convention as the toolbar caption).
function bareSurahName(name: string): string {
  const [first, ...rest] = name.split(" ");
  return first.replace(/[ً-ْٰـ]/g, "") === "سورة" && rest.length > 0
    ? rest.join(" ")
    : name;
}

function surahNameFor(surahNumber: number): string {
  const surah = getSurahIndex()[surahNumber - 1];
  return surah ? bareSurahName(surah.name_ar) : `سورة ${arNum(surahNumber)}`;
}

/** Gilt verse marker, after the mushaf's own end-of-ayah rosettes. */
function AyahMarker({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/55 text-[12px] leading-none text-accent"
    >
      {arNum(n)}
    </span>
  );
}

function Entry({
  entry,
  playState,
  onTogglePlay,
}: {
  entry: TafsirEntry;
  playState: AyahPlayState;
  onTogglePlay: () => void;
}) {
  return (
    <article className="py-4 first:pt-1">
      <h4 className="flex items-center gap-2.5">
        <AyahMarker n={entry.ayahNumber} />
        <span className="font-display text-[17px] leading-none text-accent">
          {surahNameFor(entry.surahNumber)}
          <span className="ms-1.5 text-[13px] text-ink-soft">
            الآية {arNum(entry.ayahNumber)}
          </span>
        </span>
        <span className="ms-auto">
          <AyahPlayButton state={playState} onToggle={onTogglePlay} />
        </span>
      </h4>
      {/* pre-line: the source's own <br/> breaks arrive as \n and must show */}
      <p className="mt-2 whitespace-pre-line text-[15px] leading-[2.05] text-ink">
        {entry.text}
      </p>
    </article>
  );
}

function PageSection({
  data,
  showPage,
  ayahPlayState,
  onToggleAyah,
}: {
  data: PageTafsir;
  showPage: boolean;
  ayahPlayState: (verseKey: string) => AyahPlayState;
  onToggleAyah: (ayah: AyahRef) => void;
}) {
  return (
    // scroll-mt clears the sticky page-nav row when jumping here from it.
    <section data-tafsir-page={data.pageNumber} className="scroll-mt-12">
      {showPage && (
        <h3 className="mt-2 flex items-center gap-3 text-[12px] tracking-wide text-ink-soft">
          <span aria-hidden className="h-px flex-1 bg-gold/25" />
          صفحة {arNum(data.pageNumber)}
          <span aria-hidden className="h-px flex-1 bg-gold/25" />
        </h3>
      )}
      {data.entries.length === 0 ? (
        <p className="py-4 text-center text-sm leading-7 text-ink-soft">
          لا يتوفر نص التفسير لهذه الصفحة من هذا المصدر.
        </p>
      ) : (
        <div className="divide-y divide-gold/15">
          {data.entries.map((e) => (
            <Entry
              key={e.verseKey}
              entry={e}
              playState={ayahPlayState(e.verseKey)}
              onTogglePlay={() =>
                onToggleAyah({ verseKey: e.verseKey, pageNumber: data.pageNumber })
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <p role="status" className="py-2 text-center text-sm text-ink-soft">
        جارٍ تحميل التفسير…
      </p>
      <div aria-hidden className="mt-2 space-y-7">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2.5">
            <div className="h-4 w-28 animate-pulse rounded bg-ink/10" />
            <div className="h-3 animate-pulse rounded bg-ink/10" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-ink/10" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-ink/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TafsirPanel({
  open,
  onClose,
  pages,
  audio,
}: {
  open: boolean;
  onClose: () => void;
  /** Visible page numbers in reading order: [right] or [right, left]. */
  pages: number[];
  /** Shared recitation player, owned by the Reader (mini-bar uses it too). */
  audio: QuranAudioController;
}) {
  const { state, sources, sourceId, source, setSource, retry } = useTafsir(pages, open);

  const ayahPlayState = (verseKey: string): AyahPlayState =>
    audio.currentVerseKey !== verseKey
      ? "idle"
      : audio.isLoading
        ? "loading"
        : audio.isPlaying
          ? "playing"
          : "idle";

  // With a spread, the left page's tafsir starts only after the whole right
  // page's — easy to miss. A sticky pill row tracks which page's section is
  // under the reader's eyes and jumps between them.
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesKey = pages.join(",");
  // Keyed by the spread it was measured on, so a page flip resets the pills
  // to "first page" by DERIVATION — no setState inside an effect (lint).
  const [scrolled, setScrolled] = useState<{ key: string; page: number | null } | null>(null);
  const activePage = scrolled?.key === pagesKey ? scrolled.page : null;

  useEffect(() => {
    // New spread (or reopen): back to the top.
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pagesKey, sourceId, open]);

  // While a pill-click smooth scroll is in flight, its intermediate scroll
  // events must not flip the pills back to the section being passed over.
  const jumpRef = useRef<{ page: number; until: number } | null>(null);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const threshold = container.getBoundingClientRect().top + 56; // below the pill row
    let current: number | null = null;
    container.querySelectorAll<HTMLElement>("[data-tafsir-page]").forEach((el) => {
      if (el.getBoundingClientRect().top <= threshold) {
        current = Number(el.dataset.tafsirPage);
      }
    });
    const jump = jumpRef.current;
    if (jump && Date.now() < jump.until && current !== jump.page) return;
    jumpRef.current = null;
    setScrolled({ key: pagesKey, page: current });
  }, [pagesKey]);

  const scrollToPage = useCallback(
    (pageNumber: number) => {
      // Commit the choice immediately — playback must not depend on the
      // smooth scroll having delivered its scroll events yet.
      jumpRef.current = { page: pageNumber, until: Date.now() + 1000 };
      setScrolled({ key: pagesKey, page: pageNumber });
      scrollRef.current
        ?.querySelector(`[data-tafsir-page="${pageNumber}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [pagesKey]
  );

  // «تشغيل الصفحة» follows the tafsir view: it recites the page whose pill is
  // active (the section under the reader's eyes), in the listed ayah order.
  const pageQueue: AyahRef[] = useMemo(() => {
    if (state.status !== "success" || state.data.length === 0) return [];
    const target =
      state.data.find((p) => p.pageNumber === activePage) ?? state.data[0];
    return target.entries.map((e) => ({
      verseKey: e.verseKey,
      pageNumber: target.pageNumber,
    }));
  }, [state, activePage]);

  // Every listed ayah in reading order — the walking context a single-ayah
  // play hands to the mini-bar so next/prev can cross page sections.
  const fullQueue: AyahRef[] = useMemo(
    () =>
      state.status === "success"
        ? state.data.flatMap((p) =>
            p.entries.map((e) => ({ verseKey: e.verseKey, pageNumber: p.pageNumber }))
          )
        : [],
    [state]
  );

  const { toggleAyah } = audio;
  const toggleAyahInContext = useCallback(
    (ayah: AyahRef) => toggleAyah(ayah, fullQueue),
    [toggleAyah, fullQueue]
  );

  return (
    <>
      {/* backdrop (click to close) */}
      <div
        className={`drawer-backdrop fixed inset-0 z-[44] bg-ink/15 backdrop-blur-[1px] ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        aria-label="التفسير"
        aria-hidden={!open}
        // Right drawer on the reading-start side; bottom sheet on mobile.
        // Same surface and motion as the reading panel, mirrored.
        className={`reader-drawer fixed z-[45] flex flex-col bg-paper/85 backdrop-blur-2xl backdrop-saturate-105 max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[78svh] max-sm:rounded-t-2xl max-sm:border-t max-sm:border-gold/25 sm:inset-y-0 sm:right-0 sm:w-[400px] sm:max-w-[86vw] sm:border-e sm:border-gold/20 sm:shadow-[-24px_0_60px_-30px_rgba(40,30,14,.5)] ${
          open
            ? "translate-x-0 translate-y-0"
            : "max-sm:translate-y-full sm:translate-x-[101%]"
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-[22px]">
          <h2 className="font-display text-[22px] text-accent">التفسير</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            // As in the toolbar: mouse clicks must not pin focus on the
            // control, or arrow-key page turns get swallowed afterwards.
            onMouseDown={(e) => e.preventDefault()}
            className="pressable flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-ink/10"
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

        {/* Source title plate: the tooled double frame of the cover, in
            miniature. The name here is the authority for what's below. */}
        <div className="mx-5 mt-3 rounded-lg border border-gold/40 p-1">
          <div className="rounded-md border border-gold/20 px-3 py-2.5 text-center">
            <p className="font-display text-[19px] leading-snug text-ink">
              {source?.name ?? "…"}
            </p>
            {source && (
              <p className="mt-1 text-[11px] leading-4 text-ink-soft">
                {source.publisher}
              </p>
            )}
          </div>
        </div>

        {/* Recitation row: quiet chrome under the title plate — the reciter's
            name and one control; the commentary below stays the focus. */}
        <div className="mx-5 mt-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-soft">القارئ: {audio.reciter.arabicName}</p>
          <PagePlayButton
            playing={audio.playbackMode === "page" && (audio.isPlaying || audio.isLoading)}
            disabled={pageQueue.length === 0}
            onToggle={() => audio.togglePage(pageQueue)}
          />
        </div>
        {audio.error && (
          <p
            role="alert"
            className="mx-5 mt-1.5 rounded-md border border-gold/30 bg-ink/[.03] px-3 py-1.5 text-center text-[11px] leading-5 text-ink"
          >
            {audio.error}
          </p>
        )}

        {sources.length > 1 && (
          <div className="mx-5 mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="اختيار مصدر التفسير">
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                onMouseDown={(e) => e.preventDefault()}
                aria-pressed={s.id === sourceId}
                title={s.available ? s.publisher : "يتطلب إعداد مفتاح API على الخادم"}
                className={`pressable cursor-pointer rounded-full border px-3 py-1 text-[12px] ${
                  s.id === sourceId
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-gold/25 text-ink-soft hover:border-accent/50 hover:text-accent"
                }`}
              >
                {s.name}
                {!s.available && <span className="ms-1 text-[10px]">· غير مُعدّ</span>}
              </button>
            ))}
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-4"
        >
          {state.status === "loading" && <LoadingSkeleton />}

          {state.status === "error" && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-gold/30 bg-ink/[.03] px-4 py-5 text-center"
            >
              <p className="text-sm leading-7 text-ink">{state.errorMessage}</p>
              <button
                onClick={retry}
                onMouseDown={(e) => e.preventDefault()}
                className="mt-3 cursor-pointer rounded-full border border-accent/60 px-4 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {state.status === "success" && (
            <>
              {state.data.length > 1 && (
                <nav
                  aria-label="التنقل بين صفحتي التفسير"
                  className="sticky top-0 z-10 -mx-5 mb-1 flex items-center justify-center gap-1.5 bg-paper/90 px-5 py-2 backdrop-blur-md"
                >
                  {state.data.map((p) => {
                    const active = (activePage ?? state.data[0].pageNumber) === p.pageNumber;
                    return (
                      <button
                        key={p.pageNumber}
                        onClick={() => scrollToPage(p.pageNumber)}
                        onMouseDown={(e) => e.preventDefault()}
                        aria-current={active ? "true" : undefined}
                        className={`pressable cursor-pointer rounded-full border px-3 py-1 text-[12px] ${
                          active
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-gold/25 text-ink-soft hover:border-accent/50 hover:text-accent"
                        }`}
                      >
                        صفحة {arNum(p.pageNumber)}
                      </button>
                    );
                  })}
                </nav>
              )}
              {state.data.map((pageData) => (
                <PageSection
                  key={pageData.pageNumber}
                  data={pageData}
                  showPage={state.data.length > 1}
                  ayahPlayState={ayahPlayState}
                  onToggleAyah={toggleAyahInContext}
                />
              ))}
            </>
          )}
        </div>

        {source && (
          <footer className="border-t border-gold/20 px-5 py-2.5 text-center text-[11px] leading-5 text-ink-soft">
            المصدر: {source.name} — {source.publisher}
            <span className="block text-[10px] text-ink-soft/80">
              {source.providerNote} · النص معروض كما ورد في المصدر دون تعديل
            </span>
          </footer>
        )}
      </aside>
    </>
  );
}
