"use client";

import { useMemo, useState } from "react";
import {
  clampPage,
  getJuzIndex,
  getSurahIndex,
  normalizeArabic,
  PAGE_COUNT,
} from "@/lib/mushaf/source";
import Modal from "./Modal";

const arNum = (n: number) => n.toLocaleString("ar-EG");

/**
 * Command-style jump: type a page number, or part of a surah name to filter,
 * or pick a juz. Enter goes to the page number / first surah match.
 */
export default function QuickJumpModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (page: number) => void;
}) {
  const [query, setQuery] = useState("");
  const surahs = useMemo(() => getSurahIndex(), []);
  const juzs = useMemo(() => getJuzIndex(), []);

  // Accept both Latin and Arabic-Indic digits for the page number.
  const asNumber = Number(query.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  const isNumeric = query.trim() !== "" && Number.isFinite(asNumber) && asNumber > 0;

  const filtered = useMemo(() => {
    const q = normalizeArabic(query.trim());
    if (q === "" || isNumeric) return surahs;
    return surahs.filter((s) => normalizeArabic(s.name_ar).includes(q));
  }, [query, isNumeric, surahs]);

  const go = (page: number) => {
    onSelect(clampPage(page));
    setQuery("");
    onClose();
  };

  const submit = () => {
    if (isNumeric) go(asNumber);
    else if (filtered.length > 0) go(filtered[0].first_page);
  };

  return (
    <Modal open={open} onClose={onClose} title="الانتقال السريع">
      <div className="border-b border-gold/20 px-5 py-3">
        <input
          data-autofocus
          type="text"
          inputMode="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={`رقم صفحة (١–${arNum(PAGE_COUNT)}) أو اسم سورة…`}
          className="w-full rounded-md border border-gold/25 bg-sheet px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        <h3 className="mb-1 text-xs text-ink-soft">السور</h3>
        <ul className="mb-4">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => go(s.first_page)}
                className="flex w-full cursor-pointer items-baseline justify-between rounded-md px-2 py-1.5 text-start transition-colors hover:bg-accent/10"
              >
                <span>
                  <span className="ms-2 inline-block w-7 text-xs text-ink-soft">
                    {arNum(s.id)}
                  </span>
                  <span className="font-display text-base">{s.name_ar}</span>
                </span>
                <span className="text-xs text-ink-soft">صفحة {arNum(s.first_page)}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-2 py-3 text-sm text-ink-soft">
              لا سورة بهذا الاسم — جرّب كتابة جزء من الاسم دون «سورة».
            </li>
          )}
        </ul>

        <h3 className="mb-2 text-xs text-ink-soft">الأجزاء</h3>
        <div className="grid grid-cols-6 gap-1.5 pb-2 sm:grid-cols-10">
          {juzs.map((j) => (
            <button
              key={j.number}
              onClick={() => go(j.first_page)}
              aria-label={`الجزء ${arNum(j.number)}`}
              className="cursor-pointer rounded-md border border-gold/25 py-1 text-sm text-ink transition-colors hover:border-accent hover:bg-accent/10"
            >
              {arNum(j.number)}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
