"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getPageMeta, normalizeArabic, PAGE_COUNT } from "@/lib/mushaf/source";
import {
  MARK_TYPE_LABELS,
  MARK_TYPES,
  type MarkType,
  type MarksStorageV1,
  type QuranMark,
} from "@/lib/marks";
import Modal from "./Modal";

const arNum = (n: number) => n.toLocaleString("ar-EG");
const hijri = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });

type TypeFilter = "all" | MarkType;

function parsePageInput(value: string): number | null {
  const normalized = value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isInteger(n) && n >= 1 && n <= PAGE_COUNT ? n : null;
}

function searchableText(mark: QuranMark): string {
  return normalizeArabic(
    [
      MARK_TYPE_LABELS[mark.type],
      mark.title,
      mark.note,
      mark.surahName,
      mark.pageNumber.toString(),
      mark.juzNumber?.toString(),
      mark.verseKey,
      ...(mark.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  );
}

function markSummary(mark: QuranMark): string {
  if (mark.verseKey && mark.ayahNumber) {
    return `صفحة ${arNum(mark.pageNumber)} · الآية ${arNum(mark.ayahNumber)}`;
  }
  return `صفحة ${arNum(mark.pageNumber)}`;
}

function TypeBadge({ type }: { type: MarkType }) {
  return (
    <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[11px] text-accent">
      {MARK_TYPE_LABELS[type]}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer rounded-full border border-gold/30 px-3 py-1 text-xs text-ink-soft transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function MarksPanel({
  open,
  onClose,
  marks,
  currentPage,
  onGo,
  onAddMark,
  onUpdateMark,
  onRemoveMark,
  onTogglePageBookmark,
  isPageBookmarked,
  exportStorage,
  importStorage,
  isAuthenticated = false,
  saving = false,
  onRequireSignIn,
  targetVerse,
}: {
  open: boolean;
  onClose: () => void;
  marks: QuranMark[];
  currentPage?: number;
  onGo: (page: number) => void;
  onAddMark: (page: number, type: MarkType, values?: Partial<QuranMark>) => QuranMark | null;
  onUpdateMark: (id: string, values: Partial<QuranMark>) => void;
  onRemoveMark: (id: string) => void;
  onTogglePageBookmark?: (page: number) => void;
  isPageBookmarked?: (page: number) => boolean;
  exportStorage: () => MarksStorageV1;
  importStorage: (input: unknown) =>
    | Promise<{ ok: true; added: number; updated: number; skipped?: number } | { ok: false; message: string }>
    | { ok: true; added: number; updated: number; skipped?: number }
    | { ok: false; message: string };
  isAuthenticated?: boolean;
  saving?: boolean;
  onRequireSignIn?: () => void;
  targetVerse?: {
    pageNumber: number;
    verseKey: string;
    surahNumber: number;
    ayahNumber: number;
  };
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [pageFilter, setPageFilter] = useState("");
  const [newType, setNewType] = useState<MarkType>("note");
  const [newNote, setNewNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newNoteRef = useRef<HTMLInputElement>(null);

  const effectivePage = targetVerse?.pageNumber ?? currentPage;

  useEffect(() => {
    if (!open || !targetVerse) return;
    const frame = requestAnimationFrame(() => newNoteRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, targetVerse]);

  const currentMeta = effectivePage ? getPageMeta(effectivePage) : null;
  const effectiveNewType: MarkType = targetVerse ? "note" : newType;
  const currentPageMarks = effectivePage
    ? marks.filter((mark) => mark.pageNumber === effectivePage)
    : [];
  const pageFilterNumber = parsePageInput(pageFilter);
  const normalizedQuery = normalizeArabic(query.trim().toLowerCase());

  const filteredMarks = useMemo(
    () =>
      marks.filter((mark) => {
        if (typeFilter !== "all" && mark.type !== typeFilter) return false;
        if (pageFilterNumber !== null && mark.pageNumber !== pageFilterNumber) return false;
        if (normalizedQuery && !searchableText(mark).includes(normalizedQuery)) return false;
        return true;
      }),
    [marks, normalizedQuery, pageFilterNumber, typeFilter]
  );

  const addCurrentPageNote = () => {
    if (!effectivePage) return;
    const note = newNote.trim();
    if (!note) return;
    const saved = onAddMark(effectivePage, effectiveNewType, {
      note,
      ...(targetVerse
        ? {
            verseKey: targetVerse.verseKey,
            surahNumber: targetVerse.surahNumber,
            ayahNumber: targetVerse.ayahNumber,
          }
        : {}),
    });
    if (!saved) {
      setStatus("سجّل الدخول لحفظ علاماتك وملاحظاتك ومزامنتها بين أجهزتك.");
      return;
    }
    setNewNote("");
    setStatus("تم حفظ الملاحظة.");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportStorage(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mushaf-marks-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("تم تجهيز ملف التصدير.");
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = await importStorage(parsed);
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      setStatus(`تم الاستيراد: ${arNum(result.added)} جديد، ${arNum(result.updated)} محدّث.`);
    } catch {
      setStatus("تعذر قراءة ملف JSON.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="العلامات والملاحظات" maxWidth="max-w-2xl">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-gold/15 px-5 py-3">
          {!isAuthenticated && (
            <section className="mb-3 rounded-lg border border-gold/20 bg-sheet/55 px-3 py-3">
              <p className="text-sm leading-6 text-ink">
                سجّل الدخول لحفظ علاماتك وملاحظاتك ومزامنتها بين أجهزتك.
              </p>
              {onRequireSignIn && (
                <button
                  type="button"
                  onClick={onRequireSignIn}
                  className="pressable mt-2 rounded-full border border-gold/30 px-3 py-1 text-xs text-accent hover:bg-accent/10"
                >
                  تسجيل الدخول بواسطة Google
                </button>
              )}
            </section>
          )}
          {effectivePage && currentMeta && (
            <section className="rounded-lg border border-gold/20 bg-sheet/55 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-ink">
                    {targetVerse ? `الآية ${targetVerse.verseKey}` : "الصفحة الحالية"} {arNum(effectivePage)}
                    <span className="mx-2 text-gold/70">·</span>
                    <span className="font-display text-accent">{currentMeta.surahs[0]}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {currentPageMarks.length > 0
                      ? `${arNum(currentPageMarks.length)} محفوظة في هذه الصفحة`
                      : "لا توجد علامات لهذه الصفحة بعد"}
                  </p>
                </div>
                {onTogglePageBookmark && isPageBookmarked && (
                  <ActionButton onClick={() => onTogglePageBookmark(effectivePage)} disabled={saving}>
                    {isPageBookmarked(effectivePage) ? "إزالة العلامة" : "حفظ علامة"}
                  </ActionButton>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <select
                  value={effectiveNewType}
                  onChange={(e) => setNewType(e.target.value as MarkType)}
                  disabled={Boolean(targetVerse)}
                  className="rounded border border-gold/25 bg-paper px-2 py-2 text-sm text-ink"
                  aria-label="نوع الملاحظة"
                >
                  {MARK_TYPES.filter((type) => type !== "bookmark").map((type) => (
                    <option key={type} value={type}>
                      {MARK_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <input
                  ref={newNoteRef}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={targetVerse ? `أضف ملاحظة للآية ${targetVerse.verseKey}...` : "أضف ملاحظة لهذه الصفحة..."}
                  className="min-w-0 rounded border border-gold/25 bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/55"
                />
                <ActionButton onClick={addCurrentPageNote} disabled={!newNote.trim() || saving}>
                  إضافة
                </ActionButton>
              </div>
            </section>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_120px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في الملاحظات..."
              className="min-w-0 rounded border border-gold/25 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink-soft/55"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="rounded border border-gold/25 bg-paper px-2 py-2 text-sm text-ink"
              aria-label="تصفية النوع"
            >
              <option value="all">كل الأنواع</option>
              {MARK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MARK_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <input
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              inputMode="numeric"
              placeholder="صفحة"
              className="rounded border border-gold/25 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink-soft/55"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {filteredMarks.length === 0 ? (
            <p className="py-8 text-center text-sm leading-7 text-ink-soft">
              لا توجد علامات أو ملاحظات بعد
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredMarks.map((mark) => (
                <li
                  key={mark.id}
                  className="group rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-gold/25 hover:bg-sheet"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => {
                        onGo(mark.pageNumber);
                        onClose();
                      }}
                      className="min-w-0 cursor-pointer text-start"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {mark.type === "bookmark" && <span aria-hidden className="ribbon-mini" />}
                        <TypeBadge type={mark.type} />
                        <span className="text-sm text-ink">{markSummary(mark)}</span>
                        {mark.surahName && (
                          <span className="truncate font-display text-base text-accent">
                            {mark.surahName}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-ink-soft">
                        {hijri.format(new Date(mark.createdAt))}
                        {mark.juzNumber ? ` · الجزء ${arNum(mark.juzNumber)}` : ""}
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        if (!saving && window.confirm("هل تريد حذف هذه العلامة؟")) onRemoveMark(mark.id);
                      }}
                      aria-label="حذف العلامة"
                      disabled={saving}
                      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft opacity-0 transition-[opacity,color,background-color] hover:bg-ink/5 hover:text-ink focus-visible:opacity-100 disabled:cursor-default disabled:opacity-30 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-4 w-4">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr]">
                    <select
                      defaultValue={mark.type}
                      onChange={(e) => onUpdateMark(mark.id, { type: e.target.value as MarkType })}
                      className="rounded border border-transparent bg-transparent px-2 py-1 text-xs text-ink-soft focus:border-gold/30 focus:bg-sheet"
                      aria-label="نوع العلامة"
                    >
                      {MARK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {MARK_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      defaultValue={mark.title ?? ""}
                      placeholder="عنوان اختياري..."
                      onBlur={(e) => {
                        const title = e.target.value.trim();
                        if (title !== (mark.title ?? "")) {
                          onUpdateMark(mark.id, { title: title || undefined });
                        }
                      }}
                      className="rounded border border-transparent bg-transparent px-2 py-1 text-xs text-ink-soft placeholder:text-ink-soft/50 focus:border-gold/30 focus:bg-sheet"
                    />
                  </div>
                  <textarea
                    defaultValue={mark.note ?? ""}
                    placeholder="أضف ملاحظة..."
                    rows={2}
                    onBlur={(e) => {
                      const note = e.target.value.trim();
                      if (note !== (mark.note ?? "")) {
                        onUpdateMark(mark.id, { note: note || undefined });
                      }
                    }}
                    className="mt-1 w-full resize-none rounded border border-transparent bg-transparent px-2 py-1 text-sm leading-6 text-ink placeholder:text-ink-soft/50 focus:border-gold/30 focus:bg-sheet"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gold/15 px-5 py-3">
          <p className="min-h-5 text-xs text-ink-soft">
            {saving ? "جار الحفظ..." : status}
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void importJson(e.target.files?.[0])}
            />
            <ActionButton onClick={() => fileInputRef.current?.click()}>استيراد JSON</ActionButton>
            <ActionButton onClick={exportJson}>تصدير JSON</ActionButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
