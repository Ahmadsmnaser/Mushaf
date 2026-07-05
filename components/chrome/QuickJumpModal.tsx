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
 * Command-style jump with السور / الأجزاء tabs: type a page number, or part
 * of a surah name to filter, or pick a juz from the grid. Enter goes to the
 * page number / first surah match.
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
  const [tab, setTab] = useState<"surah" | "juz">("surah");
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

  const tabClass = (active: boolean) =>
    `flex-1 cursor-pointer rounded-full border-0 py-[7px] text-[13px] transition-colors ${
      active
        ? "bg-sheet text-accent shadow-[0_1px_3px_rgba(40,30,14,.18)]"
        : "bg-transparent text-ink-soft"
    }`;

  return (
    <Modal open={open} onClose={onClose} title="الانتقال السريع" maxWidth="max-w-[460px]">
      <div className="border-b border-gold/20 px-[18px] pb-3.5 pt-3">
        <input
          data-autofocus
          type="text"
          inputMode="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={`اسم سورة أو رقم صفحة (١–${arNum(PAGE_COUNT)})…`}
          className="w-full rounded-[9px] border border-gold/30 bg-sheet px-3 py-[9px] text-sm text-ink placeholder:text-ink-soft/70"
        />
        <div
          role="tablist"
          className="mt-3 flex gap-1 rounded-full bg-ink/5 p-[3px]"
        >
          <button
            role="tab"
            aria-selected={tab === "surah"}
            onClick={() => setTab("surah")}
            className={tabClass(tab === "surah")}
          >
            السور
          </button>
          <button
            role="tab"
            aria-selected={tab === "juz"}
            onClick={() => setTab("juz")}
            className={tabClass(tab === "juz")}
          >
            الأجزاء
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3.5 pt-2">
        {tab === "surah" ? (
          <ul>
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => go(s.first_page)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-[9px] px-2.5 py-[9px] text-start transition-colors hover:bg-accent/10"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-gold/30 text-[11px] text-ink-soft">
                      {arNum(s.id)}
                    </span>
                    <span className="truncate font-display text-[19px] leading-tight text-ink">
                      {s.name_ar}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-soft">
                    صفحة {arNum(s.first_page)}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2.5 py-3.5 text-center text-[13px] text-ink-soft">
                لا سورة بهذا الاسم — جرّب جزءًا من الاسم، أو اكتب رقم صفحة.
              </li>
            )}
          </ul>
        ) : (
          <div className="grid grid-cols-5 gap-[7px] p-1">
            {juzs.map((j) => (
              <button
                key={j.number}
                onClick={() => go(j.first_page)}
                aria-label={`الجزء ${arNum(j.number)}`}
                className="flex cursor-pointer flex-col items-center gap-0.5 rounded-[9px] border border-gold/25 px-0.5 py-[9px] transition-colors hover:border-accent/55 hover:bg-accent/10"
              >
                <span className="font-display text-lg leading-none text-accent">
                  {arNum(j.number)}
                </span>
                <span className="text-[9px] text-ink-soft">
                  صفحة {arNum(j.first_page)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
