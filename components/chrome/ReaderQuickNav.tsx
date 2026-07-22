"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getJuzIndex,
  getPageMeta,
  getSurahIndex,
  PAGE_COUNT,
} from "@/lib/mushaf/source";

const arNum = (n: number) => n.toLocaleString("ar-EG");
const normalizeDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

export default function ReaderQuickNav({
  open,
  currentPage,
  lastReadPage,
  hasBookmarks,
  focusInputSignal,
  onOpen,
  onClose,
  onJump,
  onOpenBookmarks,
}: {
  open: boolean;
  currentPage: number;
  lastReadPage: number | null;
  hasBookmarks: boolean;
  focusInputSignal: number;
  onOpen: () => void;
  onClose: () => void;
  onJump: (page: number) => void;
  onOpenBookmarks: () => void;
}) {
  const [pageInput, setPageInput] = useState("");
  const [inputError, setInputError] = useState(false);
  const [draftPage, setDraftPage] = useState(currentPage);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const surahs = useMemo(() => getSurahIndex(), []);
  const juzs = useMemo(() => getJuzIndex(), []);
  const preview = getPageMeta(draftPage);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const armTimer = () => {
    clearTimer();
    if (!open || dragging) return;
    timerRef.current = window.setTimeout(() => {
      if (!panelRef.current?.matches(":hover, :focus-within")) onClose();
    }, 5000);
  };

  useEffect(() => {
    if (open) armTimer();
    else clearTimer();
    return clearTimer;
    // Timer intentionally restarts whenever visibility or dragging changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dragging]);

  useEffect(() => {
    if (focusInputSignal > 0) requestAnimationFrame(() => inputRef.current?.focus());
  }, [focusInputSignal]);

  const jump = (page: number) => {
    onJump(page);
    setDraftPage(page);
    setPageInput("");
    setInputError(false);
    armTimer();
  };

  const submitPage = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(normalizeDigits(pageInput.trim()));
    if (!Number.isInteger(value) || value < 1 || value > PAGE_COUNT) {
      setInputError(true);
      return;
    }
    jump(value);
  };

  const commitSlider = () => {
    setDragging(false);
    if (draftPage !== currentPage) jump(draftPage);
  };

  return (
    <>
      <button
        type="button"
        aria-label="فتح شريط التنقل السريع"
        data-testid="quick-nav-activation-zone"
        onPointerEnter={(event) => event.pointerType === "mouse" && onOpen()}
        onClick={onOpen}
        className="quick-nav-trigger fixed inset-x-0 top-0 z-[59] h-10 cursor-default"
      >
        <span aria-hidden className="quick-nav-handle" />
      </button>

      <div
        ref={panelRef}
        dir="rtl"
        data-testid="reader-quick-nav"
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
        className={`reader-quick-nav fixed inset-x-0 top-0 z-[60] px-2 pt-[max(.5rem,env(safe-area-inset-top))] sm:px-4 ${open ? "reader-quick-nav-open" : "reader-quick-nav-closed"}`}
        onPointerMove={armTimer}
        onPointerEnter={clearTimer}
        onPointerLeave={armTimer}
        onFocus={clearTimer}
        onBlur={armTimer}
      >
        <div className="quick-nav-panel mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-2 rounded-2xl border border-gold/30 bg-sheet/90 p-2 text-ink shadow-[0_16px_45px_-18px_rgba(30,20,5,.55),inset_0_1px_0_rgba(255,255,255,.55)] backdrop-blur-xl backdrop-saturate-125 sm:rounded-full sm:px-3">
          <div className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-gold/25 bg-ink/5 px-3" aria-label={`الصفحة الحالية ${arNum(currentPage)}`}>
            <span className="text-xs text-ink-soft">الصفحة</span>
            <strong className="font-display text-lg text-accent">{arNum(currentPage)}</strong>
          </div>

          <form onSubmit={submitPage} className="flex h-10 shrink-0 items-center rounded-full border border-gold/30 bg-sheet px-1.5">
            <label htmlFor="quick-nav-page" className="sr-only">اذهب إلى صفحة</label>
            <input
              ref={inputRef}
              id="quick-nav-page"
              data-testid="quick-nav-page-input"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => {
                setPageInput(event.target.value);
                setInputError(false);
              }}
              aria-invalid={inputError}
              aria-describedby={inputError ? "quick-nav-page-error" : undefined}
              placeholder={`١–${arNum(PAGE_COUNT)}`}
              className="w-20 bg-transparent px-2 text-center text-sm outline-none placeholder:text-ink-soft/60"
            />
            <button className="pressable h-8 rounded-full bg-accent/10 px-3 text-xs text-accent hover:bg-accent/20" type="submit">اذهب</button>
          </form>
          {inputError && <span id="quick-nav-page-error" role="alert" className="text-xs text-red-700">أدخل صفحة من ١ إلى ٦٠٤</span>}

          <label className="sr-only" htmlFor="quick-nav-surah">السورة</label>
          <select
            id="quick-nav-surah"
            data-testid="quick-nav-surah"
            value=""
            onChange={(event) => jump(Number(event.target.value))}
            className="h-10 max-w-[180px] shrink-0 cursor-pointer rounded-full border border-gold/30 bg-sheet px-3 text-sm text-ink"
          >
            <option value="" disabled>السورة</option>
            {surahs.map((surah) => <option key={surah.id} value={surah.first_page}>{arNum(surah.id)}. {surah.name_ar}</option>)}
          </select>

          <label className="sr-only" htmlFor="quick-nav-juz">الجزء</label>
          <select
            id="quick-nav-juz"
            data-testid="quick-nav-juz"
            value=""
            onChange={(event) => jump(Number(event.target.value))}
            className="h-10 shrink-0 cursor-pointer rounded-full border border-gold/30 bg-sheet px-3 text-sm text-ink"
          >
            <option value="" disabled>الجزء</option>
            {juzs.map((juz) => <option key={juz.number} value={juz.first_page}>الجزء {arNum(juz.number)}</option>)}
          </select>

          <div className="quick-nav-slider-wrap relative flex h-10 min-w-[190px] flex-1 items-center gap-2 rounded-full border border-gold/25 bg-ink/5 px-3 sm:max-w-[330px]">
            <span className="text-[11px] text-ink-soft">١</span>
            <input
              data-testid="quick-nav-slider"
              aria-label="التنقل بين صفحات المصحف"
              type="range"
              min={1}
              max={PAGE_COUNT}
              value={draftPage}
              onPointerDown={() => setDragging(true)}
              onInput={(event) => setDraftPage(Number(event.currentTarget.value))}
              onPointerUp={commitSlider}
              onPointerCancel={() => {
                setDragging(false);
                setDraftPage(currentPage);
              }}
              onKeyUp={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) commitSlider();
              }}
              className="quick-nav-slider min-w-0 flex-1"
            />
            <span className="text-[11px] text-ink-soft">{arNum(PAGE_COUNT)}</span>
            {(dragging || draftPage !== currentPage) && (
              <output data-testid="quick-nav-preview" className="quick-nav-preview absolute left-1/2 top-[calc(100%+9px)] -translate-x-1/2 whitespace-nowrap rounded-lg border border-gold/30 bg-sheet/95 px-3 py-2 text-center text-xs text-ink shadow-lg">
                صفحة {arNum(draftPage)} · {preview.surahs.join("، ")} · الجزء {arNum(preview.juz)}
              </output>
            )}
          </div>

          {lastReadPage !== null && lastReadPage !== currentPage && (
            <button data-testid="quick-nav-last-read" onClick={() => jump(lastReadPage)} className="pressable h-10 shrink-0 rounded-full px-3 text-xs text-ink-soft hover:bg-accent/10 hover:text-accent">آخر قراءة · {arNum(lastReadPage)}</button>
          )}
          {hasBookmarks && (
            <button data-testid="quick-nav-bookmarks" onClick={onOpenBookmarks} className="pressable h-10 shrink-0 rounded-full px-3 text-xs text-ink-soft hover:bg-accent/10 hover:text-accent">العلامات</button>
          )}
          <button aria-label="إغلاق شريط التنقل" onClick={onClose} className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-accent/10 hover:text-accent">×</button>
        </div>
      </div>
    </>
  );
}
