"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  search,
  type SearchHit,
  type VerseNavigationTarget,
} from "@/lib/mushaf/source";
import Modal from "./Modal";
import HighlightedVerse from "./HighlightedVerse";

const arNum = (n: number) => n.toLocaleString("ar-EG");
const MAX_QUERY_LEN = 80;
const DEBOUNCE_MS = 120;

type Status = "idle" | "searching" | "ready" | "empty" | "error";

function hitToTarget(h: SearchHit): VerseNavigationTarget {
  if (h.kind === "surah") {
    return { page: h.page, ayahKey: `${h.surahNumber}:1`, surahNumber: h.surahNumber, ayahNo: 1 };
  }
  return { page: h.page, ayahKey: h.ayahKey, surahNumber: h.surahNumber, ayahNo: h.ayahNo };
}

/**
 * Verse-text search over the bundled index. Opens as a lightweight overlay on
 * the reusable Modal shell; results are RTL, keyboard-navigable, and clicking
 * one navigates straight to its Mushaf page via the reader's direct jump.
 */
export default function SearchModal({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: VerseNavigationTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const reqId = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      reqId.current++;
      setHits([]);
      setStatus("idle");
      setActiveIndex(0);
      return;
    }
    const id = ++reqId.current;
    setStatus("searching");
    search(q)
      .then((results) => {
        if (id !== reqId.current) return;
        setHits(results);
        setStatus(results.length === 0 ? "empty" : "ready");
        setActiveIndex(0);
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setHits([]);
        setStatus("error");
      });
  }, []);

  // Debounce so we don't re-render the list on every keystroke.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query, open, runSearch]);

  // The Modal shell stays mounted for its exit animation, so reset on close.
  const close = useCallback(() => {
    reqId.current++;
    setQuery("");
    setHits([]);
    setStatus("idle");
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  const select = useCallback(
    (hit: SearchHit) => {
      onNavigate(hitToTarget(hit));
      close();
    },
    [onNavigate, close]
  );

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, hits]);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[activeIndex];
      if (hit) select(hit);
    }
  };

  const activeId = hits.length > 0 ? `search-opt-${activeIndex}` : undefined;

  return (
    <Modal open={open} onClose={close} title="البحث في المصحف" maxWidth="max-w-[560px]">
      <div className="border-b border-gold/20 px-[18px] pb-3.5 pt-3">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-soft">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            data-autofocus
            type="text"
            inputMode="text"
            dir="rtl"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="search-results"
            aria-activedescendant={activeId}
            aria-label="ابحث عن آية أو كلمة في القرآن"
            maxLength={MAX_QUERY_LEN}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="ابحث عن آية أو كلمة في القرآن"
            className="w-full rounded-[9px] border border-gold/30 bg-sheet px-10 py-[9px] text-sm text-ink placeholder:text-ink-soft/70"
          />
          {query !== "" && (
            <button
              onClick={() => setQuery("")}
              aria-label="مسح البحث"
              className="pressable absolute inset-y-0 left-2 my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-4 w-4">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        {status === "ready" && (
          <p className="mt-2 text-[11px] text-ink-soft" aria-live="polite">
            {arNum(hits.length)} نتيجة
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3.5 pt-2">
        {status === "idle" && (
          <p className="px-2.5 py-6 text-center text-[13px] text-ink-soft">
            اكتب كلمة أو آية للبحث في القرآن الكريم.
          </p>
        )}
        {status === "searching" && hits.length === 0 && (
          <p className="px-2.5 py-6 text-center text-[13px] text-ink-soft">جارٍ البحث…</p>
        )}
        {status === "empty" && (
          <p className="px-2.5 py-6 text-center text-[13px] text-ink-soft">
            لا نتائج — جرّب كلمة مختلفة أو أزل التشكيل.
          </p>
        )}
        {status === "error" && (
          <div className="px-2.5 py-6 text-center text-[13px] text-ink-soft">
            <p>تعذّر تحميل بيانات البحث.</p>
            <button
              onClick={() => runSearch(query)}
              className="pressable mt-2 cursor-pointer rounded-full border border-gold/40 px-4 py-1.5 text-xs text-accent hover:bg-accent/10"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {hits.length > 0 && (
          <ul ref={listRef} id="search-results" role="listbox" aria-label="نتائج البحث">
            {hits.map((hit, i) => (
              <li key={`${hit.kind}-${hit.kind === "surah" ? hit.surahNumber : hit.ayahKey}-${i}`}>
                <button
                  id={`search-opt-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(hit)}
                  className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-[10px] px-3 py-2.5 text-start transition-colors ${
                    i === activeIndex ? "bg-accent/10" : "hover:bg-accent/5"
                  }`}
                >
                  {hit.kind === "verse" && (
                    <>
                      <HighlightedVerse
                        text={hit.text}
                        ranges={hit.matchRanges}
                        className="font-display text-[22px] leading-[1.9] text-ink"
                      />
                      <MetaRow>
                        {`${hit.surah} · الآية ${arNum(hit.ayahNo)} · صفحة ${arNum(hit.page)} · الجزء ${arNum(hit.juz)}`}
                      </MetaRow>
                    </>
                  )}
                  {hit.kind === "reference" && (
                    <span className="flex items-center gap-2">
                      <GoIcon />
                      <span className="text-sm text-ink">
                        الانتقال إلى {hit.surah} · الآية {arNum(hit.ayahNo)}
                      </span>
                      <span className="text-[11px] text-ink-soft">صفحة {arNum(hit.page)}</span>
                    </span>
                  )}
                  {hit.kind === "surah" && (
                    <span className="flex items-center gap-2">
                      <GoIcon />
                      <span className="font-display text-[19px] leading-tight text-ink">{hit.surah}</span>
                      <span className="text-[11px] text-ink-soft">صفحة {arNum(hit.page)}</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function MetaRow({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] leading-none text-ink-soft">{children}</span>;
}

function GoIcon() {
  return (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-gold/30 text-accent">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </span>
  );
}
